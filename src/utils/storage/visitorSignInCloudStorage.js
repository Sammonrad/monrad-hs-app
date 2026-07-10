/**
 * Supabase table: public.visitor_sign_in_records
 *
 * Expected columns (create in Supabase if not exists):
 *   id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
 *   user_id         uuid NOT NULL REFERENCES auth.users(id)  -- staff who signed visitor in
 *   record_data     jsonb NOT NULL                            -- full local record snapshot
 *   visitor_name    text
 *   site_name       text
 *   purpose         text
 *   company         text
 *   phone           text
 *   person_visited  text
 *   vehicle_reg     text
 *   arrival_time    timestamptz NOT NULL
 *   departure_time  timestamptz                               -- null = still on site
 *   signed_out_by   uuid REFERENCES auth.users(id)            -- staff who signed visitor out
 *   created_at      timestamptz DEFAULT now()
 *   updated_at      timestamptz DEFAULT now()
 *
 * RLS (recommended): authenticated users with active profile can SELECT all rows;
 * INSERT/UPDATE allowed for authenticated users. Enforce via user_profiles check in policies.
 * All approved active users need shared visibility for roll-call / on-site lists.
 */

import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { normalizeVisitorRecord } from './visitorSignInStorage.js'
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

function withCloudOwnership(record, row) {
  return {
    ...record,
    cloudId: row.id,
    cloudUserId: row.user_id ?? null,
    storageSource: 'cloud',
    syncStatus: record.syncStatus ?? SYNC_STATUS.CLOUD,
  }
}

export function mapVisitorToRow(record, userId) {
  const normalized = normalizeVisitorRecord(record)

  return {
    user_id: userId,
    record_data: {
      ...normalized,
      syncStatus: normalized.syncStatus ?? SYNC_STATUS.CLOUD,
    },
    visitor_name: normalized.visitorName?.trim() || null,
    site_name: normalized.siteName?.trim() || null,
    purpose: normalized.purpose?.trim() || null,
    company: normalized.company?.trim() || null,
    phone: normalized.phone?.trim() || null,
    person_visited: normalized.personVisited?.trim() || null,
    vehicle_reg: normalized.vehicleReg?.trim() || null,
    arrival_time: normalized.arrivalTime,
    departure_time: normalized.departureTime || null,
    signed_out_by: normalized.signedOutBy || null,
  }
}

export function rowToVisitorRecord(row) {
  const data = row.record_data
  if (data && typeof data === 'object' && data.visitorName != null) {
    return withSyncStatus(
      normalizeVisitorRecord(
        withCloudOwnership(
          {
            ...data,
            arrivalTime: row.arrival_time ?? data.arrivalTime,
            departureTime: row.departure_time ?? data.departureTime ?? null,
            signedOutBy: row.signed_out_by ?? data.signedOutBy ?? null,
          },
          row,
        ),
      ),
    )
  }

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
          personVisited: row.person_visited ?? '',
          vehicleReg: row.vehicle_reg ?? '',
          hazardsReported: '',
          notes: '',
          arrivalTime: row.arrival_time ?? row.created_at ?? new Date().toISOString(),
          departureTime: row.departure_time ?? null,
          signedOutBy: row.signed_out_by ?? null,
          acknowledgements: {},
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

export function getMergedVisitorRecords(localRecords, cloudRecords) {
  return mergeVisitorRecords(localRecords ?? [], cloudRecords ?? [])
}

export async function fetchVisitorSignInRecords(userId) {
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

  const records = (data ?? []).map(rowToVisitorRecord)
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

  const row = mapVisitorToRow(record, userId)

  const { data, error } = await supabase
    .from('visitor_sign_in_records')
    .update({
      record_data: row.record_data,
      visitor_name: row.visitor_name,
      site_name: row.site_name,
      purpose: row.purpose,
      company: row.company,
      phone: row.phone,
      person_visited: row.person_visited,
      vehicle_reg: row.vehicle_reg,
      arrival_time: row.arrival_time,
      departure_time: row.departure_time,
      signed_out_by: row.signed_out_by,
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
