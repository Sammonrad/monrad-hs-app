import { JOB_START_CHECKLIST } from '../../constants/index.js'
import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { normalizeRecord } from '../records.js'
import {
  SYNC_STATUS,
  withSyncStatus,
} from './cloudSyncStatus.js'

export {
  SYNC_STATUS,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
  getSyncStatusLabel,
  getSyncStatusModifier,
  resolveRecordSyncStatus,
} from './cloudSyncStatus.js'

const CHECKLIST_LABELS = {
  hazards: 'Checked job hazards',
  services: 'Checked underground services',
  ppe: 'PPE is being worn',
  emergencyAccess: 'Emergency access confirmed',
}

function isChecklistItemChecked(record, label) {
  return (record.completedItems ?? []).some((item) => item === label)
}

export function mapJobStartToRow(record, userId) {
  const fields = record.fields ?? {}

  return {
    user_id: userId,
    record_data: {
      ...record,
      syncStatus: record.syncStatus ?? SYNC_STATUS.CLOUD,
    },
    record_date: fields.date?.trim() || null,
    operator_name: fields.employeeName?.trim() || null,
    job_name: fields.jobName?.trim() || null,
    site_location: fields.siteLocation?.trim() || null,
    machine_used: fields.machineUsed?.trim() || null,
    hazards_checked: isChecklistItemChecked(record, CHECKLIST_LABELS.hazards),
    services_checked: isChecklistItemChecked(record, CHECKLIST_LABELS.services),
    ppe_confirmed: isChecklistItemChecked(record, CHECKLIST_LABELS.ppe),
    emergency_access_confirmed: isChecklistItemChecked(record, CHECKLIST_LABELS.emergencyAccess),
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
  }
}

export function rowToJobStartRecord(row) {
  const data = row.record_data
  if (data && typeof data === 'object' && data.formType === 'job-start') {
    return withSyncStatus(
      normalizeRecord(withCloudOwnership(data, row)),
    )
  }

  const completedItems = []
  if (row.hazards_checked) completedItems.push(CHECKLIST_LABELS.hazards)
  if (row.services_checked) completedItems.push(CHECKLIST_LABELS.services)
  if (row.ppe_confirmed) completedItems.push(CHECKLIST_LABELS.ppe)
  if (row.emergency_access_confirmed) completedItems.push(CHECKLIST_LABELS.emergencyAccess)

  const totalCount = JOB_START_CHECKLIST.length
  const completedCount = completedItems.length

  return withSyncStatus(
    normalizeRecord(
      withCloudOwnership(
        {
          id: row.id,
          formType: 'job-start',
          formTypeLabel: 'Job Start Checklist',
          fields: {
            jobName: row.job_name ?? '',
            siteLocation: row.site_location ?? '',
            employeeName: row.operator_name ?? '',
            machineUsed: row.machine_used ?? '',
            date: row.record_date ?? '',
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
  const jobName = record.fields?.jobName?.trim().toLowerCase() ?? ''
  const submittedAt = record.submittedAt ?? ''
  const date = record.fields?.date ?? ''
  return `${submittedAt}|${date}|${jobName}`
}

export function mergeJobStartRecords(localJobStarts, cloudJobStarts) {
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

  localJobStarts.forEach((record) => {
    register({ ...record, storageSource: record.cloudId ? 'both' : 'local' }, 'local')
  })

  cloudJobStarts.forEach((cloudRecord) => {
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

export function getMergedJobStartRecords(savedRecords, cloudJobStarts) {
  const localJobStarts = savedRecords.filter((record) => record.formType === 'job-start')
  return mergeJobStartRecords(localJobStarts, cloudJobStarts ?? [])
}

export async function fetchJobStartRecords(userId, { isAdmin = false } = {}) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { records: [], error: null }
  }

  let query = supabase
    .from('job_start_records')
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

  const records = (data ?? []).map(rowToJobStartRecord)
  return { records, error: null }
}

export async function saveJobStartRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }

  const userId = user?.id
  if (!userId) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const row = mapJobStartToRow(record, userId)

  const { data, error } = await supabase
    .from('job_start_records')
    .insert(row)
    .select()
    .single()

  if (error) {
    return { record: null, error }
  }

  return { record: rowToJobStartRecord(data), error: null }
}
