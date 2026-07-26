/**
 * Supabase table: public.visitor_sign_in_records
 *
 * Explicit columns only (no record_data jsonb):
 *   id, visitor_name, company, phone, person_visiting, site_name, purpose,
 *   vehicle_registration, arrival_time, departure_time,
 *   induction_acknowledged, critical_risks_acknowledged,
 *   emergency_procedure_acknowledged, ppe_acknowledged,
 *   hazards_reported, notes, signed_in_by, signed_out_by, created_at, updated_at
 *
 * UI acknowledgement keys → columns:
 *   siteRules → induction_acknowledged
 *   ppeRequired → ppe_acknowledged
 *   emergencyProcedures → emergency_procedure_acknowledged
 *   criticalRisksReviewed → critical_risks_acknowledged
 *
 * RLS: authenticated active users SELECT/INSERT (signed_in_by = auth.uid());
 * UPDATE allowed for sign-out; trigger limits staff to departure fields.
 */

import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { normalizeVisitorRecord } from './visitorSignInStorage.js'
import {
  SYNC_STATUS,
  withSyncStatus,
} from './cloudSyncStatus.js'
import { ARCHIVE_RECORD_TYPES, filterArchived } from './archiveFilter.js'

export {
  SYNC_STATUS,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
  getSyncStatusLabel,
  getSyncStatusModifier,
  resolveRecordSyncStatus,
  formatCloudSaveError,
} from './cloudSyncStatus.js'

function blankToNull(value) {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}

function withCloudOwnership(record, row) {
  return {
    ...record,
    cloudId: row.id,
    cloudUserId: row.signed_in_by ?? null,
    storageSource: 'cloud',
    syncStatus: record.syncStatus ?? SYNC_STATUS.CLOUD,
    ...(typeof row.archived === 'boolean' ? { archived: row.archived } : {}),
  }
}

function acknowledgementsToColumns(acknowledgements) {
  const ack = acknowledgements ?? {}
  return {
    induction_acknowledged: Boolean(ack.siteRules),
    ppe_acknowledged: Boolean(ack.ppeRequired),
    emergency_procedure_acknowledged: Boolean(ack.emergencyProcedures),
    critical_risks_acknowledged: Boolean(ack.criticalRisksReviewed),
  }
}

function columnsToAcknowledgements(row) {
  return {
    siteRules: Boolean(row.induction_acknowledged),
    ppeRequired: Boolean(row.ppe_acknowledged),
    emergencyProcedures: Boolean(row.emergency_procedure_acknowledged),
    criticalRisksReviewed: Boolean(row.critical_risks_acknowledged),
  }
}

export function mapVisitorToRow(record, userId) {
  const normalized = normalizeVisitorRecord(record)
  const now = new Date().toISOString()

  return {
    visitor_name: normalized.visitorName?.trim() || '',
    company: blankToNull(normalized.company),
    phone: blankToNull(normalized.phone),
    person_visiting: blankToNull(normalized.personVisited),
    site_name: normalized.siteName?.trim() || '',
    purpose: blankToNull(normalized.purpose),
    vehicle_registration: blankToNull(normalized.vehicleReg),
    arrival_time: normalized.arrivalTime,
    departure_time: normalized.departureTime || null,
    ...acknowledgementsToColumns(normalized.acknowledgements),
    hazards_reported: blankToNull(normalized.hazardsReported),
    notes: blankToNull(normalized.notes),
    signed_in_by: userId,
    signed_out_by: normalized.signedOutBy || null,
    created_at: normalized.createdAt ?? normalized.arrivalTime ?? now,
    updated_at: now,
  }
}

export function rowToVisitorRecord(row) {
  return withSyncStatus(
    normalizeVisitorRecord(
      withCloudOwnership(
        {
          id: row.id,
          visitorName: row.visitor_name ?? '',
          siteName: row.site_name ?? '',
          purpose: row.purpose ?? '',
          company: row.company ?? '',
          phone: row.phone ?? '',
          personVisited: row.person_visiting ?? '',
          vehicleReg: row.vehicle_registration ?? '',
          hazardsReported: row.hazards_reported ?? '',
          notes: row.notes ?? '',
          arrivalTime: row.arrival_time ?? row.created_at ?? new Date().toISOString(),
          departureTime: row.departure_time ?? null,
          signedOutBy: row.signed_out_by ?? null,
          acknowledgements: columnsToAcknowledgements(row),
          declarationName: '',
          createdAt: row.created_at ?? new Date().toISOString(),
        },
        row,
      ),
    ),
  )
}

function dedupeKey(record) {
  const name = record.visitorName?.trim().toLowerCase() ?? ''
  const arrival = record.arrivalTime ?? ''
  const site = record.siteName?.trim().toLowerCase() ?? ''
  return `${arrival}|${site}|${name}`
}

export function mergeVisitorRecords(localRecords, cloudRecords) {
  const byId = new Map()
  const byCloudId = new Map()
  const byDedupeKey = new Map()

  function register(record, source) {
    const entry = withSyncStatus({
      ...normalizeVisitorRecord(record),
      storageSource:
        record.storageSource === 'cloud' && source === 'local'
          ? 'both'
          : record.storageSource === 'local' && source === 'cloud'
            ? 'both'
            : source,
    })

    if (entry.storageSource === 'both' || entry.cloudId) {
      entry.syncStatus = SYNC_STATUS.CLOUD
    }

    byId.set(entry.id, entry)
    if (entry.cloudId) byCloudId.set(entry.cloudId, entry)
    byDedupeKey.set(dedupeKey(entry), entry)
    return entry
  }

  localRecords.forEach((record) => {
    register({ ...record, storageSource: record.cloudId ? 'both' : 'local' }, 'local')
  })

  cloudRecords.forEach((cloudRecord) => {
    const cloudId = cloudRecord.cloudId
    if (cloudId && byCloudId.has(cloudId)) {
      const existing = byCloudId.get(cloudId)
      const merged = withSyncStatus({
        ...existing,
        ...cloudRecord,
        id: existing.id,
        cloudId,
        storageSource: 'both',
        syncStatus: SYNC_STATUS.CLOUD,
      })
      byId.set(existing.id, merged)
      byCloudId.set(cloudId, merged)
      byDedupeKey.set(dedupeKey(merged), merged)
      return
    }

    const localId = cloudRecord.id
    if (localId && byId.has(localId)) {
      const existing = byId.get(localId)
      const merged = withSyncStatus({
        ...existing,
        ...cloudRecord,
        cloudId: cloudId ?? existing.cloudId,
        storageSource: 'both',
        syncStatus: SYNC_STATUS.CLOUD,
      })
      byId.set(localId, merged)
      if (merged.cloudId) byCloudId.set(merged.cloudId, merged)
      byDedupeKey.set(dedupeKey(merged), merged)
      return
    }

    const dupKey = dedupeKey(cloudRecord)
    if (byDedupeKey.has(dupKey)) {
      const existing = byDedupeKey.get(dupKey)
      const merged = withSyncStatus({
        ...existing,
        ...cloudRecord,
        cloudId: cloudId ?? existing.cloudId,
        storageSource: 'both',
        syncStatus: SYNC_STATUS.CLOUD,
      })
      byId.set(existing.id, merged)
      if (merged.cloudId) byCloudId.set(merged.cloudId, merged)
      byDedupeKey.set(dupKey, merged)
      return
    }

    register(cloudRecord, 'cloud')
  })

  return [...byId.values()].sort(
    (a, b) => new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime(),
  )
}

export function getMergedVisitorRecords(localRecords, cloudRecords, { includeArchived = false } = {}) {
  const merged = mergeVisitorRecords(localRecords ?? [], cloudRecords ?? [])
  return filterArchived(merged, ARCHIVE_RECORD_TYPES.VISITOR, includeArchived)
}

export async function fetchVisitorSignInRecords(userId, { includeArchived = false } = {}) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { records: [], error: null }
  }

  const { data, error } = await supabase
    .from('visitor_sign_in_records')
    .select('*')
    .order('arrival_time', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return { records: [], error }
  }

  const records = filterArchived(
    (data ?? []).map(rowToVisitorRecord),
    ARCHIVE_RECORD_TYPES.VISITOR,
    includeArchived,
  )
  return { records, error: null }
}

export async function saveVisitorSignInRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }

  const userId = user?.id
  if (!userId) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const row = mapVisitorToRow(record, userId)

  const { data, error } = await supabase
    .from('visitor_sign_in_records')
    .insert(row)
    .select()
    .single()

  if (error) {
    return { record: null, error }
  }

  return { record: rowToVisitorRecord(data), error: null }
}

export async function updateVisitorSignInRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }

  const userId = user?.id
  if (!userId) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  if (!record.cloudId) {
    return saveVisitorSignInRecord(user, record)
  }

  // Sign-out path: only columns staff are allowed to change (RLS trigger).
  const { data, error } = await supabase
    .from('visitor_sign_in_records')
    .update({
      departure_time: record.departureTime || null,
      signed_out_by: record.signedOutBy || userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', record.cloudId)
    .select()
    .single()

  if (error) {
    return { record: null, error }
  }

  return { record: rowToVisitorRecord(data), error: null }
}
