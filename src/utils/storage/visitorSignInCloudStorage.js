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
  logCloudSaveFailure,
  isConfirmedCloudRecord,
  verifyCloudRecordExists,
  selectRecordsForCloudVerification,
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
  needsCloudRetry,
  logCloudSaveFailure,
  isConfirmedCloudRecord,
  verifyCloudRecordExists,
  selectRecordsForCloudVerification,
  LOCAL_SAFE_CLOUD_FAILED_MESSAGE,
} from './cloudSyncStatus.js'

export const VISITOR_CLOUD_TABLE = 'visitor_sign_in_records'

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

function prefersLocalSyncState(record) {
  return (
    record?.syncStatus === SYNC_STATUS.CLOUD_FAILED ||
    record?.syncStatus === SYNC_STATUS.CLOUD_MISSING ||
    record?.syncStatus === SYNC_STATUS.OFFLINE ||
    record?.syncStatus === SYNC_STATUS.LOCAL_ONLY ||
    record?.syncStatus === SYNC_STATUS.SYNCING
  )
}

function isLocalUnsyncedVisitor(record) {
  if (!record) return false
  if (!record.cloudId) return true
  return prefersLocalSyncState(record)
}

function mergePair(local, cloud) {
  const preferLocalSync = prefersLocalSyncState(local)

  return withSyncStatus(
    normalizeVisitorRecord({
      ...cloud,
      ...local,
      id: local.id,
      cloudId: cloud.cloudId || local.cloudId,
      cloudUserId: cloud.cloudUserId || local.cloudUserId,
      storageSource: 'both',
      // Cloud is source of truth for archive when a row exists in Supabase.
      archived: cloud.archived === true,
      departureTime:
        preferLocalSync && local.departureTime
          ? local.departureTime
          : cloud.departureTime || local.departureTime,
      signedOutBy:
        preferLocalSync && local.signedOutBy
          ? local.signedOutBy
          : cloud.signedOutBy || local.signedOutBy,
      syncStatus: preferLocalSync ? local.syncStatus : SYNC_STATUS.CLOUD,
    }),
  )
}

/**
 * Cloud rows are the primary history source on every device.
 * localStorage only supplements unsynced / local-only rows.
 */
export function mergeVisitorRecords(localRecords, cloudRecords) {
  const byId = new Map()
  const byCloudId = new Map()

  function register(record, source) {
    const entry = withSyncStatus(
      normalizeVisitorRecord({
        ...record,
        storageSource:
          record.storageSource === 'cloud' && source === 'local'
            ? 'both'
            : record.storageSource === 'local' && source === 'cloud'
              ? 'both'
              : source,
      }),
    )

    if (entry.storageSource === 'both' || entry.cloudId) {
      if (!prefersLocalSyncState(entry)) {
        entry.syncStatus = SYNC_STATUS.CLOUD
      }
    }

    byId.set(entry.id, entry)
    if (entry.cloudId) byCloudId.set(entry.cloudId, entry)
    return entry
  }

  function replaceEntry(existing, merged) {
    byId.delete(existing.id)
    if (existing.cloudId) byCloudId.delete(existing.cloudId)

    byId.set(merged.id, merged)
    if (merged.cloudId) byCloudId.set(merged.cloudId, merged)
  }

  ;(cloudRecords ?? []).forEach((cloudRecord) => {
    const cloud = normalizeVisitorRecord({ ...cloudRecord, storageSource: 'cloud' })
    register(
      {
        ...cloud,
        id: cloud.cloudId || cloud.id,
        syncStatus: SYNC_STATUS.CLOUD,
      },
      'cloud',
    )
  })

  ;(localRecords ?? []).forEach((localRecord) => {
    const local = normalizeVisitorRecord({
      ...localRecord,
      storageSource: localRecord.cloudId ? 'both' : 'local',
    })
    const cloudId = local.cloudId

    if (cloudId && byCloudId.has(cloudId)) {
      const existing = byCloudId.get(cloudId)
      const merged = mergePair(local, existing)
      replaceEntry(existing, merged)
      return
    }

    if (cloudId && byId.has(cloudId)) {
      const existing = byId.get(cloudId)
      const merged = mergePair(local, existing)
      replaceEntry(existing, merged)
      return
    }

    if (!isLocalUnsyncedVisitor(local)) {
      return
    }

    register(local, 'local')
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
    .from(VISITOR_CLOUD_TABLE)
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
    .from(VISITOR_CLOUD_TABLE)
    .insert(row)
    .select()
    .single()

  if (error) {
    logCloudSaveFailure({ table: VISITOR_CLOUD_TABLE, operation: 'insert', error })
    return { record: null, error }
  }

  if (!isConfirmedCloudRecord({ cloudId: data?.id })) {
    const missingIdError = new Error('Cloud save did not return a record id.')
    logCloudSaveFailure({ table: VISITOR_CLOUD_TABLE, operation: 'insert', error: missingIdError })
    return { record: null, error: missingIdError }
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
    .from(VISITOR_CLOUD_TABLE)
    .update({
      departure_time: record.departureTime || null,
      signed_out_by: record.signedOutBy || userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', record.cloudId)
    .select()
    .single()

  if (error) {
    logCloudSaveFailure({ table: VISITOR_CLOUD_TABLE, operation: 'update', error })
    return { record: null, error }
  }

  if (!isConfirmedCloudRecord({ cloudId: data?.id })) {
    const missingIdError = new Error('Cloud update did not return a record id.')
    logCloudSaveFailure({ table: VISITOR_CLOUD_TABLE, operation: 'update', error: missingIdError })
    return { record: null, error: missingIdError }
  }

  return { record: rowToVisitorRecord(data), error: null }
}

export async function verifyVisitorCloudRecords(records, options = {}) {
  const candidates = selectRecordsForCloudVerification(records, options)
  const patches = []

  for (const record of candidates) {
    const { exists, error } = await verifyCloudRecordExists(VISITOR_CLOUD_TABLE, record.cloudId)
    const lastVerifiedAt = new Date().toISOString()

    if (error) {
      patches.push({ id: record.id, patch: { lastVerifiedAt } })
      continue
    }

    if (!exists) {
      patches.push({
        id: record.id,
        patch: {
          syncStatus: SYNC_STATUS.CLOUD_MISSING,
          cloudId: null,
          storageSource: 'local',
          lastVerifiedAt,
        },
      })
    } else {
      patches.push({ id: record.id, patch: { lastVerifiedAt } })
    }
  }

  return patches
}

export async function retryVisitorCloudSave(user, record) {
  const normalized = normalizeVisitorRecord(record)
  if (!normalized.cloudId) {
    return saveVisitorSignInRecord(user, normalized)
  }
  return updateVisitorSignInRecord(user, normalized)
}
