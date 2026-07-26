/**
 * Supabase tables: sssp_records, sssp_hazards, sssp_acknowledgements
 * See PROJECT_NOTES.md for schema and RLS SQL.
 */

import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { SSSP_STATUS, SSSP_STAFF_VISIBLE_STATUSES } from '../../constants/ssspStatuses.js'
import {
  normalizeSsspRecord,
  normalizeHazard,
  syncIndexedFieldsFromRecordData,
} from './ssspStorage.js'
import { SYNC_STATUS, withSyncStatus } from './cloudSyncStatus.js'
import { ARCHIVE_RECORD_TYPES, filterArchived } from './archiveFilter.js'

export {
  SYNC_STATUS,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
  getSyncStatusLabel,
  getSyncStatusModifier,
  resolveRecordSyncStatus,
} from './cloudSyncStatus.js'

function withCloudOwnership(record, row) {
  return {
    ...record,
    cloudId: row.id,
    cloudUserId: row.user_id ?? null,
    storageSource: 'cloud',
    syncStatus: record.syncStatus ?? SYNC_STATUS.CLOUD,
  }
}

export function mapSsspToRow(record, userId) {
  const normalized = syncIndexedFieldsFromRecordData(record)
  const recordData = {
    ...normalized.recordData,
    hazards: normalized.hazards,
  }

  return {
    user_id: userId,
    record_data: recordData,
    sssp_number: normalized.ssspNumber?.trim() || null,
    project: normalized.project?.trim() || null,
    client: normalized.client?.trim() || null,
    principal_contractor: normalized.principalContractor?.trim() || null,
    site: normalized.site?.trim() || null,
    contract_ref: normalized.contractRef?.trim() || null,
    status: normalized.status || SSSP_STATUS.DRAFT,
    revision: normalized.revision || 1,
    prepared_by: normalized.preparedBy?.trim() || null,
    prepared_by_user_id: normalized.preparedByUserId || userId,
    effective_date: normalized.effectiveDate || null,
    review_date: normalized.reviewDate || null,
    approved_at: normalized.approvedAt || null,
    approved_by: normalized.approvedBy || null,
    approved_by_name: normalized.approvedByName?.trim() || null,
    submitted_at: normalized.submittedAt || null,
    closed_at: normalized.closedAt || null,
    archived_at: normalized.archivedAt || null,
  }
}

export function rowToSsspRecord(row, hazards = [], acknowledgements = []) {
  const data = row.record_data
  const base = data && typeof data === 'object' ? data : {}

  const hazardsFromData = Array.isArray(base.hazards) ? base.hazards : []
  const mergedHazards =
    hazards.length > 0
      ? hazards.map((h, i) =>
          normalizeHazard(
            {
              ...h.hazard_data,
              id: h.id,
              cloudId: h.id,
              ssspCloudId: h.sssp_id,
              // Live sssp_hazards has no archived column — flag lives in hazard_data JSON.
              archived: Boolean(h.hazard_data?.archived),
              sortOrder: h.hazard_index ?? h.hazard_data?.sortOrder ?? i,
            },
            i,
          ),
        )
      : hazardsFromData.map((h, i) => normalizeHazard(h, i))

  const record = normalizeSsspRecord(
    withCloudOwnership(
      {
        id: row.id,
        cloudId: row.id,
        ssspNumber: row.sssp_number ?? base.ssspNumber ?? '',
        project: row.project ?? '',
        client: row.client ?? '',
        principalContractor: row.principal_contractor ?? '',
        site: row.site ?? '',
        contractRef: row.contract_ref ?? '',
        status: row.status ?? SSSP_STATUS.DRAFT,
        revision: row.revision ?? 1,
        preparedBy: row.prepared_by ?? '',
        preparedByUserId: row.prepared_by_user_id ?? null,
        effectiveDate: row.effective_date ?? '',
        reviewDate: row.review_date ?? '',
        approvedAt: row.approved_at ?? null,
        approvedBy: row.approved_by ?? null,
        approvedByName: row.approved_by_name ?? '',
        submittedAt: row.submitted_at ?? null,
        closedAt: row.closed_at ?? null,
        archivedAt: row.archived_at ?? null,
        recordData: base,
        hazards: mergedHazards,
        acknowledgements: acknowledgements.map((a) => ({
          id: a.id,
          cloudId: a.id,
          ssspId: a.sssp_id,
          userId: a.user_id,
          revision: a.revision,
          acknowledgedAt: a.acknowledged_at,
          userName: a.user_name ?? '',
          notes: a.notes ?? '',
        })),
        createdAt: row.created_at ?? new Date().toISOString(),
        updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
      },
      row,
    ),
  )

  return withSyncStatus(record)
}

async function fetchHazardsForSsspIds(ssspIds) {
  if (!ssspIds.length) return new Map()

  const { data, error } = await supabase
    .from('sssp_hazards')
    .select('*')
    .in('sssp_id', ssspIds)
    .order('hazard_index', { ascending: true })

  if (error || !data) return new Map()

  const bySssp = new Map()
  data.forEach((row) => {
    if (!bySssp.has(row.sssp_id)) bySssp.set(row.sssp_id, [])
    bySssp.get(row.sssp_id).push(row)
  })
  return bySssp
}

async function fetchAcknowledgementsForSsspIds(ssspIds) {
  if (!ssspIds.length) return new Map()

  const { data, error } = await supabase
    .from('sssp_acknowledgements')
    .select('*')
    .in('sssp_id', ssspIds)
    .order('acknowledged_at', { ascending: false })

  if (error || !data) return new Map()

  const bySssp = new Map()
  data.forEach((row) => {
    if (!bySssp.has(row.sssp_id)) bySssp.set(row.sssp_id, [])
    bySssp.get(row.sssp_id).push(row)
  })
  return bySssp
}

export async function fetchSsspRecords(userId, { isAdmin = false, includeArchived = false } = {}) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { records: [], error: null }
  }

  let query = supabase
    .from('sssp_records')
    .select('*')
    .order('updated_at', { ascending: false })

  if (!isAdmin) {
    // Staff allow-list already excludes archived/draft/ready; keep as-is.
    query = query.in('status', SSSP_STAFF_VISIBLE_STATUSES)
  }

  const { data, error } = await query

  if (error) {
    return { records: [], error }
  }

  const rows = data ?? []
  const ids = rows.map((r) => r.id)
  const hazardsBySssp = await fetchHazardsForSsspIds(ids)
  const acksBySssp = await fetchAcknowledgementsForSsspIds(ids)

  const records = filterArchived(
    rows.map((row) =>
      rowToSsspRecord(
        row,
        hazardsBySssp.get(row.id) ?? [],
        acksBySssp.get(row.id) ?? [],
      ),
    ),
    ARCHIVE_RECORD_TYPES.SSSP,
    includeArchived,
  )

  return { records, error: null }
}

/**
 * Map a client hazard to sssp_hazards columns.
 * Soft-archive state is stored only in hazard_data.archived (no archived DB column).
 */
export function mapHazardToRow(ssspId, hazard, hazardIndex) {
  const normalized = normalizeHazard(hazard, hazardIndex)
  return {
    sssp_id: ssspId,
    hazard_index: hazardIndex,
    hazard_data: normalized,
    activity: normalized.activity?.trim() || null,
    hazard: normalized.hazard?.trim() || null,
    initial_risk: normalized.initialRisk ?? null,
    residual_risk: normalized.residualRisk ?? null,
    updated_at: new Date().toISOString(),
  }
}

function resolveExistingHazardId(hazard, existingById) {
  if (hazard.cloudId && existingById.has(hazard.cloudId)) return hazard.cloudId
  if (hazard.id && existingById.has(hazard.id)) return hazard.id
  return null
}

/**
 * Non-destructive hazard sync: update by cloud id, insert new rows, soft-archive
 * orphans inside hazard_data. Never DELETEs from sssp_hazards.
 */
async function syncHazards(ssspId, hazards) {
  const list = hazards ?? []

  const { data: existingRows, error: fetchError } = await supabase
    .from('sssp_hazards')
    .select('id, hazard_data')
    .eq('sssp_id', ssspId)

  if (fetchError) return { error: fetchError }

  const existingById = new Map((existingRows ?? []).map((row) => [row.id, row]))
  const seenIds = new Set()

  const ordered = [...list].sort((a, b) => {
    const aArchived = Boolean(a.archived)
    const bArchived = Boolean(b.archived)
    if (aArchived !== bArchived) return aArchived ? 1 : -1
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  })

  for (let index = 0; index < ordered.length; index += 1) {
    const hazard = ordered[index]
    const row = mapHazardToRow(ssspId, hazard, index)
    const existingId = resolveExistingHazardId(hazard, existingById)

    if (existingId) {
      const { error } = await supabase
        .from('sssp_hazards')
        .update({
          hazard_index: row.hazard_index,
          hazard_data: row.hazard_data,
          activity: row.activity,
          hazard: row.hazard,
          initial_risk: row.initial_risk,
          residual_risk: row.residual_risk,
          updated_at: row.updated_at,
        })
        .eq('id', existingId)
        .eq('sssp_id', ssspId)

      if (error) return { error }
      seenIds.add(existingId)
      continue
    }

    const { error } = await supabase.from('sssp_hazards').insert({
      sssp_id: row.sssp_id,
      hazard_index: row.hazard_index,
      hazard_data: row.hazard_data,
      activity: row.activity,
      hazard: row.hazard,
      initial_risk: row.initial_risk,
      residual_risk: row.residual_risk,
      updated_at: row.updated_at,
    })

    if (error) return { error }
  }

  for (const [id, existing] of existingById) {
    if (seenIds.has(id)) continue

    const prev =
      existing.hazard_data && typeof existing.hazard_data === 'object'
        ? existing.hazard_data
        : {}
    if (prev.archived === true) continue

    const { error } = await supabase
      .from('sssp_hazards')
      .update({
        hazard_data: { ...prev, archived: true },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('sssp_id', ssspId)

    if (error) return { error }
  }

  return { error: null }
}

export async function saveSsspRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }

  const userId = user?.id
  if (!userId) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const row = mapSsspToRow(record, userId)

  const { data, error } = await supabase
    .from('sssp_records')
    .insert(row)
    .select()
    .single()

  if (error) {
    return { record: null, error }
  }

  const hazardSync = await syncHazards(data.id, record.hazards ?? [])
  if (hazardSync.error) {
    return { record: null, error: hazardSync.error }
  }

  const { records: refreshed } = await fetchSsspRecords(userId, {
    isAdmin: true,
    includeArchived: true,
  })
  const saved = refreshed.find((r) => r.cloudId === data.id)
  return { record: saved ?? rowToSsspRecord(data, record.hazards ?? []), error: null }
}

export async function updateSsspRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }

  const userId = user?.id
  if (!userId) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  if (!record.cloudId) {
    return saveSsspRecord(user, record)
  }

  const row = mapSsspToRow(record, userId)

  const { data, error } = await supabase
    .from('sssp_records')
    .update({
      ...row,
      updated_at: new Date().toISOString(),
    })
    .eq('id', record.cloudId)
    .select()
    .single()

  if (error) {
    return { record: null, error }
  }

  const hazardSync = await syncHazards(data.id, record.hazards ?? [])
  if (hazardSync.error) {
    return { record: null, error: hazardSync.error }
  }

  const hazardsBySssp = await fetchHazardsForSsspIds([data.id])
  const acksBySssp = await fetchAcknowledgementsForSsspIds([data.id])

  return {
    record: rowToSsspRecord(
      data,
      hazardsBySssp.get(data.id) ?? [],
      acksBySssp.get(data.id) ?? [],
    ),
    error: null,
  }
}

export async function saveSsspAcknowledgement(user, { ssspId, revision, userName, notes = '' }) {
  if (!isSupabaseConfigured || !supabase) {
    return { acknowledgement: null, error: new Error('Supabase is not configured.') }
  }

  const userId = user?.id
  if (!userId) {
    return { acknowledgement: null, error: new Error('You must be signed in.') }
  }

  const { data, error } = await supabase
    .from('sssp_acknowledgements')
    .insert({
      sssp_id: ssspId,
      user_id: userId,
      revision,
      user_name: userName?.trim() || user.email || '',
      notes: notes?.trim() || null,
      acknowledged_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return { acknowledgement: null, error }
  }

  return {
    acknowledgement: {
      id: data.id,
      cloudId: data.id,
      ssspId: data.sssp_id,
      userId: data.user_id,
      revision: data.revision,
      acknowledgedAt: data.acknowledged_at,
      userName: data.user_name,
      notes: data.notes,
    },
    error: null,
  }
}

export async function fetchUserAcknowledgementForSssp(userId, ssspId, revision) {
  if (!isSupabaseConfigured || !supabase || !userId || !ssspId) {
    return { acknowledgement: null, error: null }
  }

  const { data, error } = await supabase
    .from('sssp_acknowledgements')
    .select('*')
    .eq('sssp_id', ssspId)
    .eq('user_id', userId)
    .eq('revision', revision)
    .maybeSingle()

  if (error) {
    return { acknowledgement: null, error }
  }

  if (!data) return { acknowledgement: null, error: null }

  return {
    acknowledgement: {
      id: data.id,
      cloudId: data.id,
      ssspId: data.sssp_id,
      userId: data.user_id,
      revision: data.revision,
      acknowledgedAt: data.acknowledged_at,
      userName: data.user_name,
      notes: data.notes,
    },
    error: null,
  }
}

export async function fetchSsspById(cloudId) {
  if (!isSupabaseConfigured || !supabase || !cloudId) {
    return { record: null, error: null }
  }

  const { data, error } = await supabase
    .from('sssp_records')
    .select('*')
    .eq('id', cloudId)
    .maybeSingle()

  if (error) return { record: null, error }
  if (!data) return { record: null, error: null }

  const hazardsBySssp = await fetchHazardsForSsspIds([data.id])
  const acksBySssp = await fetchAcknowledgementsForSsspIds([data.id])

  return {
    record: rowToSsspRecord(
      data,
      hazardsBySssp.get(data.id) ?? [],
      acksBySssp.get(data.id) ?? [],
    ),
    error: null,
  }
}

export function duplicateSsspRecord(record, { newNumber, preparedBy, userId }) {
  const now = new Date().toISOString()
  const copy = normalizeSsspRecord({
    ...record,
    id: crypto.randomUUID(),
    cloudId: null,
    ssspNumber: newNumber,
    status: SSSP_STATUS.DRAFT,
    revision: 1,
    preparedBy,
    preparedByUserId: userId,
    approvedAt: null,
    approvedBy: null,
    approvedByName: '',
    submittedAt: null,
    closedAt: null,
    archivedAt: null,
    acknowledgements: [],
    createdAt: now,
    updatedAt: now,
    storageSource: 'local',
    syncStatus: null,
    recordData: {
      ...record.recordData,
      changeLog: [
        {
          id: crypto.randomUUID(),
          at: now,
          action: 'duplicated',
          detail: `Duplicated from ${record.ssspNumber} rev ${record.revision}`,
          userName: preparedBy,
        },
      ],
    },
    hazards: (record.hazards ?? []).map((h) => ({
      ...normalizeHazard(h),
      id: crypto.randomUUID(),
      cloudId: null,
    })),
  })
  return copy
}

export function createSsspRevision(record, { preparedBy, userId, changeDetail }) {
  const now = new Date().toISOString()
  const nextRevision = (record.revision ?? 1) + 1

  return normalizeSsspRecord({
    ...record,
    status: SSSP_STATUS.DRAFT,
    revision: nextRevision,
    preparedBy,
    preparedByUserId: userId,
    approvedAt: null,
    approvedBy: null,
    approvedByName: '',
    submittedAt: null,
    closedAt: null,
    archivedAt: null,
    updatedAt: now,
    recordData: {
      ...record.recordData,
      changeLog: [
        {
          id: crypto.randomUUID(),
          at: now,
          action: 'revision',
          detail: changeDetail || `Revision ${nextRevision} created from rev ${record.revision}`,
          userName: preparedBy,
        },
        ...(record.recordData?.changeLog ?? []),
      ],
    },
  })
}
