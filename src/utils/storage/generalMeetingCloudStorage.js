/**
 * Supabase table: public.hs_general_meeting_records
 *
 * Ownership columns: created_by / updated_by (defaults/triggers via auth.uid()).
 * No user_id column — do not send or filter on user_id.
 */

import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { normalizeMeeting } from './generalMeetingStorage.js'
import { SYNC_STATUS, withSyncStatus } from './cloudSyncStatus.js'
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

function withCloudOwnership(record, row) {
  return {
    ...record,
    cloudId: row.id,
    cloudUserId: row.created_by ?? null,
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    storageSource: 'cloud',
    syncStatus: SYNC_STATUS.CLOUD,
    ...(typeof row.archived === 'boolean' ? { archived: row.archived } : {}),
  }
}

export function mapMeetingToRow(record) {
  const normalized = normalizeMeeting(record)
  return {
    record_data: { ...normalized, syncStatus: SYNC_STATUS.CLOUD },
    meeting_date: normalized.meetingDate?.trim() || null,
    meeting_time: normalized.meetingTime?.trim() || null,
    location: normalized.location?.trim() || null,
    meeting_type: normalized.meetingType?.trim() || null,
    status: normalized.status?.trim() || 'draft',
    chairperson: normalized.chairperson?.trim() || null,
    next_meeting_date: normalized.nextMeetingDate?.trim() || null,
    schedule_frequency: normalized.scheduleFrequency?.trim() || null,
    updated_at: new Date().toISOString(),
    ...(typeof normalized.archived === 'boolean' ? { archived: normalized.archived } : {}),
  }
}

export function rowToMeeting(row) {
  const data = row.record_data
  if (data && typeof data === 'object' && data.meetingDate != null) {
    return normalizeMeeting(
      withSyncStatus(
        withCloudOwnership(
          {
            ...data,
            cloudId: row.id,
            meetingDate: row.meeting_date ?? data.meetingDate,
            meetingTime: row.meeting_time ?? data.meetingTime,
            location: row.location ?? data.location,
            meetingType: row.meeting_type ?? data.meetingType,
            status: row.status ?? data.status,
            chairperson: row.chairperson ?? data.chairperson,
            nextMeetingDate: row.next_meeting_date ?? data.nextMeetingDate,
            scheduleFrequency: row.schedule_frequency ?? data.scheduleFrequency,
          },
          row,
        ),
      ),
    )
  }

  return normalizeMeeting(
    withSyncStatus(
      withCloudOwnership(
        {
          id: row.id,
          meetingDate: row.meeting_date ?? '',
          meetingTime: row.meeting_time ?? '',
          location: row.location ?? '',
          meetingType: row.meeting_type ?? 'weekly',
          status: row.status ?? 'draft',
          chairperson: row.chairperson ?? '',
          nextMeetingDate: row.next_meeting_date ?? '',
          scheduleFrequency: row.schedule_frequency ?? 'weekly',
          createdAt: row.created_at ?? new Date().toISOString(),
        },
        row,
      ),
    ),
  )
}

function dedupeKey(record) {
  return `${record.meetingDate}|${record.meetingTime}|${record.location}|${record.chairperson}|${record.createdAt}`
}

export function mergeMeetings(localMeetings, cloudMeetings) {
  const byId = new Map()
  const byCloudId = new Map()
  const byDedupeKey = new Map()

  function register(record, source) {
    const entry = withSyncStatus({
      ...normalizeMeeting(record),
      storageSource:
        record.storageSource === 'cloud' && source === 'local'
          ? 'both'
          : record.storageSource === 'local' && source === 'cloud'
            ? 'both'
            : source,
    })
    if (entry.cloudId) entry.syncStatus = SYNC_STATUS.CLOUD
    byId.set(entry.id, entry)
    if (entry.cloudId) byCloudId.set(entry.cloudId, entry)
    byDedupeKey.set(dedupeKey(entry), entry)
    return entry
  }

  localMeetings.forEach((record) => {
    register({ ...record, storageSource: record.cloudId ? 'both' : 'local' }, 'local')
  })

  cloudMeetings.forEach((cloudRecord) => {
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

  return [...byId.values()].sort((a, b) => (b.meetingDate || '').localeCompare(a.meetingDate || ''))
}

export function getMergedMeetings(localMeetings, cloudMeetings, { includeArchived = false } = {}) {
  const merged = mergeMeetings(localMeetings ?? [], cloudMeetings ?? [])
  return filterArchived(merged, ARCHIVE_RECORD_TYPES.GENERAL_MEETING, includeArchived)
}

export async function fetchGeneralMeetingRecords(userId, { isAdmin = false, includeArchived = false } = {}) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { records: [], error: null }
  }

  // RLS allows authenticated SELECT for all rows; do not filter by user_id
  // (column does not exist). isAdmin kept for call-site compatibility.
  void isAdmin

  const query = supabase
    .from('hs_general_meeting_records')
    .select('*')
    .order('meeting_date', { ascending: false })
    .order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) return { records: [], error }
  return {
    records: filterArchived(
      (data ?? []).map(rowToMeeting),
      ARCHIVE_RECORD_TYPES.GENERAL_MEETING,
      includeArchived,
    ),
    error: null,
  }
}

export async function saveGeneralMeetingRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }
  if (!user?.id) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const row = mapMeetingToRow(record)
  const { data, error } = await supabase
    .from('hs_general_meeting_records')
    .insert(row)
    .select()
    .single()

  if (error) return { record: null, error }
  return { record: rowToMeeting(data), error: null }
}

export async function updateGeneralMeetingRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }
  if (!user?.id) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }
  if (!record.cloudId) return saveGeneralMeetingRecord(user, record)

  const row = mapMeetingToRow(record)
  const { data, error } = await supabase
    .from('hs_general_meeting_records')
    .update({
      record_data: row.record_data,
      meeting_date: row.meeting_date,
      meeting_time: row.meeting_time,
      location: row.location,
      meeting_type: row.meeting_type,
      status: row.status,
      chairperson: row.chairperson,
      next_meeting_date: row.next_meeting_date,
      schedule_frequency: row.schedule_frequency,
      updated_at: row.updated_at,
      ...(typeof row.archived === 'boolean' ? { archived: row.archived } : {}),
    })
    .eq('id', record.cloudId)
    .select()
    .single()

  if (error) return { record: null, error }
  return { record: rowToMeeting(data), error: null }
}
