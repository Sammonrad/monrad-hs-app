import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { normalizeRecord } from '../records.js'
import { parseRecordHours } from '../weeklyTimesheet.js'

export const SYNC_STATUS = {
  CLOUD: 'cloud',
  LOCAL_ONLY: 'local-only',
  OFFLINE: 'offline',
  CLOUD_FAILED: 'cloud-failed',
}

export function isCloudSaveUnavailable(user) {
  if (!isSupabaseConfigured || !supabase) return true
  if (!user?.id) return true
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  return false
}

export function getUnavailableSyncStatus(user) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return SYNC_STATUS.OFFLINE
  if (!user?.id) return SYNC_STATUS.LOCAL_ONLY
  return SYNC_STATUS.OFFLINE
}

export function getSyncStatusLabel(syncStatus) {
  switch (syncStatus) {
    case SYNC_STATUS.CLOUD:
      return 'Saved to cloud'
    case SYNC_STATUS.CLOUD_FAILED:
      return 'Saved locally only — cloud save failed'
    case SYNC_STATUS.OFFLINE:
    case SYNC_STATUS.LOCAL_ONLY:
    default:
      return 'Offline/local save only'
  }
}

export function getSyncStatusModifier(syncStatus) {
  switch (syncStatus) {
    case SYNC_STATUS.CLOUD:
      return 'cloud-sync-status--cloud'
    case SYNC_STATUS.CLOUD_FAILED:
      return 'cloud-sync-status--failed'
    case SYNC_STATUS.OFFLINE:
    case SYNC_STATUS.LOCAL_ONLY:
    default:
      return 'cloud-sync-status--offline'
  }
}

export function resolveRecordSyncStatus(record) {
  if (!record) return SYNC_STATUS.LOCAL_ONLY
  if (record.syncStatus) return record.syncStatus
  if (record.cloudId || record.storageSource === 'cloud' || record.storageSource === 'both') {
    return SYNC_STATUS.CLOUD
  }
  return SYNC_STATUS.LOCAL_ONLY
}

function withSyncStatus(record) {
  const syncStatus = resolveRecordSyncStatus(record)
  return { ...record, syncStatus }
}

export function mapTimesheetToRow(record, userId) {
  const fields = record.fields ?? {}
  const { total, chargeable, nonChargeable } = parseRecordHours(record)

  return {
    user_id: userId,
    record_data: {
      ...record,
      syncStatus: record.syncStatus ?? SYNC_STATUS.CLOUD,
    },
    record_date: fields.date?.trim() || null,
    employee_name: fields.employeeName?.trim() || null,
    job_name: fields.jobProjectName?.trim() || null,
    site_location: fields.siteLocation?.trim() || null,
    machine_used: fields.machineUsed?.trim() || null,
    total_hours: total,
    chargeable_hours: chargeable,
    non_chargeable_hours: nonChargeable,
  }
}

function withCloudOwnership(record, row) {
  return {
    ...record,
    cloudId: row.id,
    cloudUserId: row.user_id ?? null,
    storageSource: 'cloud',
    syncStatus: record.syncStatus ?? SYNC_STATUS.CLOUD,
  }
}

export function rowToTimesheetRecord(row) {
  const data = row.record_data
  if (data && typeof data === 'object' && data.formType === 'timesheet') {
    return withSyncStatus(
      normalizeRecord(withCloudOwnership(data, row)),
    )
  }

  return withSyncStatus(
    normalizeRecord(
      withCloudOwnership(
        {
          id: row.id,
          formType: 'timesheet',
          formTypeLabel: 'Timesheet / Daily Work Record',
          fields: {
            date: row.record_date ?? '',
            employeeName: row.employee_name ?? '',
            jobProjectName: row.job_name ?? '',
            siteLocation: row.site_location ?? '',
            machineUsed: row.machine_used ?? '',
            totalHoursWorked: row.total_hours != null ? String(row.total_hours) : '',
            chargeableHours: row.chargeable_hours != null ? String(row.chargeable_hours) : '',
            nonChargeableHours: row.non_chargeable_hours != null ? String(row.non_chargeable_hours) : '',
          },
          completedItems: [],
          completedCount: 0,
          totalCount: 0,
          allComplete: true,
          signatureConfirmation: '',
          photos: [],
          submittedAt: row.created_at ?? new Date().toISOString(),
        },
        row,
      ),
    ),
  )
}

function dedupeKey(record) {
  const employee = record.fields?.employeeName?.trim().toLowerCase() ?? ''
  const submittedAt = record.submittedAt ?? ''
  const date = record.fields?.date ?? ''
  return `${submittedAt}|${date}|${employee}`
}

export function mergeTimesheetRecords(localTimesheets, cloudTimesheets) {
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

  localTimesheets.forEach((record) => {
    register({ ...record, storageSource: record.cloudId ? 'both' : 'local' }, 'local')
  })

  cloudTimesheets.forEach((cloudRecord) => {
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

export function getMergedTimesheetRecords(savedRecords, cloudTimesheets) {
  const localTimesheets = savedRecords.filter((record) => record.formType === 'timesheet')
  return mergeTimesheetRecords(localTimesheets, cloudTimesheets ?? [])
}

export async function fetchTimesheetRecords(userId, { isAdmin = false } = {}) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { records: [], error: null }
  }

  let query = supabase
    .from('timesheet_records')
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

  const records = (data ?? []).map(rowToTimesheetRecord)
  return { records, error: null }
}

export async function saveTimesheetRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }

  const userId = user?.id
  if (!userId) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const row = mapTimesheetToRow(record, userId)

  const { data, error } = await supabase
    .from('timesheet_records')
    .insert(row)
    .select()
    .single()

  if (error) {
    return { record: null, error }
  }

  return { record: rowToTimesheetRecord(data), error: null }
}
