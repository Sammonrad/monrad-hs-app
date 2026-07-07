import { INCIDENT_CHECKLIST } from '../../constants/index.js'
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

export function mapIncidentToRow(record, userId) {
  const fields = record.fields ?? {}

  return {
    user_id: userId,
    record_data: {
      ...record,
      syncStatus: record.syncStatus ?? SYNC_STATUS.CLOUD,
    },
    record_date: fields.date?.trim() || null,
    incident_time: fields.time?.trim() || null,
    reported_by: fields.reportedBy?.trim() || null,
    site_location: fields.siteLocation?.trim() || null,
    report_type: fields.reportType?.trim() || null,
    person_involved: fields.personInvolved?.trim() || null,
    what_happened: fields.whatHappened?.trim() || null,
    immediate_action_taken: fields.immediateActionTaken?.trim() || null,
    possible_cause: fields.possibleCause?.trim() || null,
    corrective_action_required: fields.correctiveActionRequired?.trim() || null,
    person_responsible: fields.correctiveActionPerson?.trim() || null,
    follow_up_date: fields.followUpDate?.trim() || null,
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

export function rowToIncidentRecord(row) {
  const data = row.record_data
  if (data && typeof data === 'object' && data.formType === 'incident') {
    return withSyncStatus(
      normalizeRecord(withCloudOwnership(data, row)),
    )
  }

  const totalCount = INCIDENT_CHECKLIST.length
  const completedCount = row.checklist_completed ? totalCount : 0
  const completedItems = row.checklist_completed ? [...INCIDENT_CHECKLIST] : []

  return withSyncStatus(
    normalizeRecord(
      withCloudOwnership(
        {
          id: row.id,
          formType: 'incident',
          formTypeLabel: 'Incident / Near Miss',
          fields: {
            date: row.record_date ?? '',
            time: row.incident_time ?? '',
            reportedBy: row.reported_by ?? '',
            siteLocation: row.site_location ?? '',
            reportType: row.report_type ?? '',
            personInvolved: row.person_involved ?? '',
            whatHappened: row.what_happened ?? '',
            immediateActionTaken: row.immediate_action_taken ?? '',
            possibleCause: row.possible_cause ?? '',
            correctiveActionRequired: row.corrective_action_required ?? '',
            correctiveActionPerson: row.person_responsible ?? '',
            followUpDate: row.follow_up_date ?? '',
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
  const site = record.fields?.siteLocation?.trim().toLowerCase() ?? ''
  const reportType = record.fields?.reportType?.trim().toLowerCase() ?? ''
  const whatHappened = record.fields?.whatHappened?.trim().toLowerCase() ?? ''
  const submittedAt = record.submittedAt ?? ''
  const date = record.fields?.date ?? ''
  return `${submittedAt}|${date}|${site}|${reportType}|${whatHappened}`
}

export function mergeIncidentRecords(localIncidents, cloudIncidents) {
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

  localIncidents.forEach((record) => {
    register({ ...record, storageSource: record.cloudId ? 'both' : 'local' }, 'local')
  })

  cloudIncidents.forEach((cloudRecord) => {
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

export function getMergedIncidentRecords(savedRecords, cloudIncidents) {
  const localIncidents = savedRecords.filter((record) => record.formType === 'incident')
  return mergeIncidentRecords(localIncidents, cloudIncidents ?? [])
}

export async function fetchIncidentRecords(userId, { isAdmin = false } = {}) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { records: [], error: null }
  }

  let query = supabase
    .from('incident_near_miss_records')
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

  const records = (data ?? []).map(rowToIncidentRecord)
  return { records, error: null }
}

export async function saveIncidentRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }

  const userId = user?.id
  if (!userId) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const row = mapIncidentToRow(record, userId)

  const { data, error } = await supabase
    .from('incident_near_miss_records')
    .insert(row)
    .select()
    .single()

  if (error) {
    return { record: null, error }
  }

  return { record: rowToIncidentRecord(data), error: null }
}
