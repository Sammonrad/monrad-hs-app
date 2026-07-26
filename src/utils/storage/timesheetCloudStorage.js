import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { normalizeRecord } from '../records.js'
import { parseRecordHours } from '../weeklyTimesheet.js'
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
    ...(typeof row.archived === 'boolean' ? { archived: row.archived } : {}),
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

export function getMergedTimesheetRecords(savedRecords, cloudTimesheets, { includeArchived = false } = {}) {
  const localTimesheets = savedRecords.filter((record) => record.formType === 'timesheet')
  const merged = mergeTimesheetRecords(localTimesheets, cloudTimesheets ?? [])
  return filterArchived(merged, ARCHIVE_RECORD_TYPES.TIMESHEET, includeArchived)
}

export async function fetchTimesheetRecords(userId, { isAdmin = false, includeArchived = false } = {}) {
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

  const records = filterArchived(
    (data ?? []).map(rowToTimesheetRecord),
    ARCHIVE_RECORD_TYPES.TIMESHEET,
    includeArchived,
  )
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
