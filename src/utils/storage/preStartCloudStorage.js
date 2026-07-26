import { PRE_START_CHECKLIST } from '../../constants/index.js'
import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { normalizeRecord } from '../records.js'
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
} from './cloudSyncStatus.js'

const MACHINE_SAFE_LABEL = 'Machine safe to operate'

function isChecklistItemChecked(record, label) {
  return (record.completedItems ?? []).some((item) => item === label)
}

export function resolveMachineSafe(record) {
  if (record.defectsFound === 'found') {
    if (record.machineOperableSafely === 'yes') return true
    if (record.machineOperableSafely === 'no') return false
    return null
  }
  return isChecklistItemChecked(record, MACHINE_SAFE_LABEL)
}

export function mapPreStartToRow(record, userId) {
  const fields = record.fields ?? {}
  const defectsFound = record.defectsFound === 'found'

  return {
    user_id: userId,
    record_data: {
      ...record,
      syncStatus: record.syncStatus ?? SYNC_STATUS.CLOUD,
    },
    record_date: fields.date?.trim() || null,
    operator_name: fields.operatorName?.trim() || null,
    machine_name: fields.machineNameId?.trim() || null,
    machine_type: fields.machineType?.trim() || '',
    site_location: fields.siteLocation?.trim() || null,
    machine_safe: resolveMachineSafe(record),
    defects_found: defectsFound,
    defect_severity: defectsFound ? record.defectSeverity ?? null : null,
    defect_description: defectsFound ? record.defectDescription?.trim() || null : null,
    action_required: defectsFound ? record.actionRequired?.trim() || null : null,
  }
}

function withCloudOwnership(record, row) {
  return {
    ...record,
    cloudId: row.id,
    cloudUserId: row.user_id ?? null,
    storageSource: 'cloud',
    syncStatus: record.syncStatus ?? SYNC_STATUS.CLOUD,
    ...(typeof row.archived === 'boolean' ? { archived: row.archived } : {}),
  }
}

function machineOperableFromSafe(machineSafe) {
  if (machineSafe === true) return 'yes'
  if (machineSafe === false) return 'no'
  return ''
}

export function rowToPreStartRecord(row) {
  const data = row.record_data
  if (data && typeof data === 'object' && data.formType === 'pre-start') {
    return withSyncStatus(
      normalizeRecord(withCloudOwnership(data, row)),
    )
  }

  const completedItems = PRE_START_CHECKLIST.filter((label) => {
    if (label === MACHINE_SAFE_LABEL) return row.machine_safe === true
    return false
  })

  const defectsFound = row.defects_found ? 'found' : 'none'
  const machineOperableSafely = row.defects_found
    ? machineOperableFromSafe(row.machine_safe)
    : ''

  return withSyncStatus(
    normalizeRecord(
      withCloudOwnership(
        {
          id: row.id,
          formType: 'pre-start',
          formTypeLabel: 'Machine Pre-Start',
          fields: {
            date: row.record_date ?? '',
            operatorName: row.operator_name ?? '',
            machineNameId: row.machine_name ?? '',
            machineHours: '',
            siteLocation: row.site_location ?? '',
            notes: '',
            ...(row.machine_type ? { machineType: row.machine_type } : {}),
          },
          completedItems,
          completedCount: completedItems.length,
          totalCount: PRE_START_CHECKLIST.length,
          allComplete: completedItems.length === PRE_START_CHECKLIST.length,
          signatureConfirmation: '',
          photos: [],
          defectsFound,
          submittedAt: row.created_at ?? new Date().toISOString(),
          ...(defectsFound === 'found'
            ? {
                defectDescription: row.defect_description ?? '',
                defectSeverity: row.defect_severity ?? '',
                machineOperableSafely,
                actionRequired: row.action_required ?? '',
                reportedTo: '',
                defectPhotos: [],
              }
            : {}),
        },
        row,
      ),
    ),
  )
}

function dedupeKey(record) {
  const operator = record.fields?.operatorName?.trim().toLowerCase() ?? ''
  const machine = record.fields?.machineNameId?.trim().toLowerCase() ?? ''
  const submittedAt = record.submittedAt ?? ''
  const date = record.fields?.date ?? ''
  return `${submittedAt}|${date}|${operator}|${machine}`
}

export function mergePreStartRecords(localPreStarts, cloudPreStarts) {
  const byId = new Map()
  const byCloudId = new Map()
  const byDedupeKey = new Map()

  function register(record, source) {
    const entry = withSyncStatus({
      ...record,
      storageSource: record.storageSource === 'cloud' && source === 'local'
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

  localPreStarts.forEach((record) => {
    register({ ...record, storageSource: record.cloudId ? 'both' : 'local' }, 'local')
  })

  cloudPreStarts.forEach((cloudRecord) => {
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

  return [...byId.values()].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
}

export function getMergedPreStartRecords(savedRecords, cloudPreStarts, { includeArchived = false } = {}) {
  const localPreStarts = savedRecords.filter((record) => record.formType === 'pre-start')
  const merged = mergePreStartRecords(localPreStarts, cloudPreStarts ?? [])
  return filterArchived(merged, ARCHIVE_RECORD_TYPES.PRE_START, includeArchived)
}

export async function fetchPreStartRecords(userId, { isAdmin = false, includeArchived = false } = {}) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { records: [], error: null }
  }

  let query = supabase
    .from('machine_prestart_records')
    .select('*')
    .order('record_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error) {
    return { records: [], error }
  }

  const records = filterArchived(
    (data ?? []).map(rowToPreStartRecord),
    ARCHIVE_RECORD_TYPES.PRE_START,
    includeArchived,
  )
  return { records, error: null }
}

export async function savePreStartRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }

  const userId = user?.id
  if (!userId) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const row = mapPreStartToRow(record, userId)

  const { data, error } = await supabase
    .from('machine_prestart_records')
    .insert(row)
    .select()
    .single()

  if (error) {
    return { record: null, error }
  }

  return { record: rowToPreStartRecord(data), error: null }
}
