import { TOOLBOX_CHECKLIST } from '../../constants/index.js'
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

export function mapToolboxToRow(record, userId) {
  const fields = record.fields ?? {}

  return {
    user_id: userId,
    record_data: {
      ...record,
      syncStatus: record.syncStatus ?? SYNC_STATUS.CLOUD,
    },
    record_date: fields.date?.trim() || null,
    job_name: fields.jobProjectName?.trim() || null,
    site_location: fields.siteLocation?.trim() || null,
    meeting_led_by: fields.meetingLedBy?.trim() || null,
    attendees: fields.attendees?.trim() || null,
    work_planned: fields.workPlannedToday?.trim() || null,
    hazards_discussed: fields.mainHazardsDiscussed?.trim() || null,
    controls_agreed: fields.controlsAgreed?.trim() || null,
    weather_ground_conditions: fields.weatherGroundConditions?.trim() || null,
    checklist_completed: Boolean(
      record.allComplete ??
        (record.totalCount > 0 && record.completedCount === record.totalCount),
    ),
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

export function rowToToolboxRecord(row) {
  const data = row.record_data
  if (data && typeof data === 'object' && data.formType === 'toolbox') {
    return withSyncStatus(
      normalizeRecord(withCloudOwnership(data, row)),
    )
  }

  const totalCount = TOOLBOX_CHECKLIST.length
  const completedCount = row.checklist_completed ? totalCount : 0
  const completedItems = row.checklist_completed ? [...TOOLBOX_CHECKLIST] : []

  return withSyncStatus(
    normalizeRecord(
      withCloudOwnership(
        {
          id: row.id,
          formType: 'toolbox',
          formTypeLabel: 'Toolbox Meeting',
          fields: {
            date: row.record_date ?? '',
            jobProjectName: row.job_name ?? '',
            siteLocation: row.site_location ?? '',
            meetingLedBy: row.meeting_led_by ?? '',
            attendees: row.attendees ?? '',
            workPlannedToday: row.work_planned ?? '',
            mainHazardsDiscussed: row.hazards_discussed ?? '',
            controlsAgreed: row.controls_agreed ?? '',
            weatherGroundConditions: row.weather_ground_conditions ?? '',
            notes: '',
          },
          completedItems,
          completedCount,
          totalCount,
          allComplete: Boolean(row.checklist_completed),
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
  const jobName = record.fields?.jobProjectName?.trim().toLowerCase() ?? ''
  const meetingLedBy = record.fields?.meetingLedBy?.trim().toLowerCase() ?? ''
  const submittedAt = record.submittedAt ?? ''
  const date = record.fields?.date ?? ''
  return `${submittedAt}|${date}|${jobName}|${meetingLedBy}`
}

export function mergeToolboxRecords(localToolboxRecords, cloudToolboxRecords) {
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

  localToolboxRecords.forEach((record) => {
    register({ ...record, storageSource: record.cloudId ? 'both' : 'local' }, 'local')
  })

  cloudToolboxRecords.forEach((cloudRecord) => {
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

export function getMergedToolboxRecords(savedRecords, cloudToolboxRecords, { includeArchived = false } = {}) {
  const localToolboxRecords = savedRecords.filter((record) => record.formType === 'toolbox')
  const merged = mergeToolboxRecords(localToolboxRecords, cloudToolboxRecords ?? [])
  return filterArchived(merged, ARCHIVE_RECORD_TYPES.TOOLBOX, includeArchived)
}

export async function fetchToolboxRecords(userId, { isAdmin = false, includeArchived = false } = {}) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { records: [], error: null }
  }

  let query = supabase
    .from('toolbox_meeting_records')
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
    (data ?? []).map(rowToToolboxRecord),
    ARCHIVE_RECORD_TYPES.TOOLBOX,
    includeArchived,
  )
  return { records, error: null }
}

export async function saveToolboxRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }

  const userId = user?.id
  if (!userId) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const row = mapToolboxToRow(record, userId)

  const { data, error } = await supabase
    .from('toolbox_meeting_records')
    .insert(row)
    .select()
    .single()

  if (error) {
    return { record: null, error }
  }

  return { record: rowToToolboxRecord(data), error: null }
}
