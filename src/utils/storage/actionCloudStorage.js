import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { normalizeAction } from './actionsStorage.js'
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

function withCloudOwnership(action, row) {
  return {
    ...action,
    cloudId: row.id,
    cloudUserId: row.user_id ?? null,
    storageSource: 'cloud',
    syncStatus: action.syncStatus ?? SYNC_STATUS.CLOUD,
  }
}

export function mapActionToRow(action, userId) {
  const normalized = normalizeAction(action)
  const isCompleted = normalized.status === 'completed'

  return {
    user_id: userId,
    record_data: {
      ...normalized,
      syncStatus: normalized.syncStatus ?? SYNC_STATUS.CLOUD,
    },
    source_type: normalized.sourceType || 'manual',
    source_record_id: normalized.sourceRecordId || null,
    action_description: normalized.description?.trim() || null,
    person_responsible: normalized.personResponsible?.trim() || null,
    due_date: normalized.dueDate?.trim() || null,
    priority: normalized.priority || 'medium',
    status: normalized.status || 'open',
    site_location: normalized.site?.trim() || null,
    notes: normalized.notes?.trim() || null,
    completed_at: isCompleted
      ? action.completedAt || normalized.completedAt || new Date().toISOString()
      : null,
  }
}

export function rowToActionRecord(row) {
  const data = row.record_data
  if (data && typeof data === 'object' && data.description != null) {
    return withSyncStatus(
      normalizeAction(
        withCloudOwnership(
          {
            ...data,
            completedAt: row.completed_at ?? data.completedAt ?? null,
          },
          row,
        ),
      ),
    )
  }

  return withSyncStatus(
    normalizeAction(
      withCloudOwnership(
        {
          id: row.id,
          sourceType: row.source_type ?? 'manual',
          sourceRecordId: row.source_record_id ?? null,
          date: row.record_data?.date ?? '',
          site: row.site_location ?? '',
          description: row.action_description ?? '',
          personResponsible: row.person_responsible ?? '',
          dueDate: row.due_date ?? '',
          status: row.status ?? 'open',
          priority: row.priority ?? 'medium',
          notes: row.notes ?? '',
          createdAt: row.created_at ?? new Date().toISOString(),
          completedAt: row.completed_at ?? null,
          autoCreated: Boolean(row.source_record_id),
          serious: row.record_data?.serious ?? false,
        },
        row,
      ),
    ),
  )
}

function sourceKey(action) {
  if (!action.sourceRecordId || !action.sourceType || action.sourceType === 'manual') return null
  return `${action.sourceType}|${action.sourceRecordId}`
}

export function mergeActions(localActions, cloudActions) {
  const byId = new Map()
  const byCloudId = new Map()
  const bySourceKey = new Map()

  function register(action, source) {
    const entry = withSyncStatus({
      ...normalizeAction(action),
      storageSource:
        action.storageSource === 'cloud' && source === 'local'
          ? 'both'
          : action.storageSource === 'local' && source === 'cloud'
            ? 'both'
            : source,
    })

    if (entry.storageSource === 'both' || entry.cloudId) {
      entry.syncStatus = SYNC_STATUS.CLOUD
    }

    byId.set(entry.id, entry)
    if (entry.cloudId) byCloudId.set(entry.cloudId, entry)
    const sk = sourceKey(entry)
    if (sk) bySourceKey.set(sk, entry)
    return entry
  }

  function replaceEntry(existing, merged) {
    byId.delete(existing.id)
    if (existing.cloudId) byCloudId.delete(existing.cloudId)
    const oldSk = sourceKey(existing)
    if (oldSk) bySourceKey.delete(oldSk)

    byId.set(merged.id, merged)
    if (merged.cloudId) byCloudId.set(merged.cloudId, merged)
    const newSk = sourceKey(merged)
    if (newSk) bySourceKey.set(newSk, merged)
  }

  localActions.forEach((action) => {
    register({ ...action, storageSource: action.cloudId ? 'both' : 'local' }, 'local')
  })

  cloudActions.forEach((cloudAction) => {
    const cloudId = cloudAction.cloudId
    if (cloudId && byCloudId.has(cloudId)) {
      const existing = byCloudId.get(cloudId)
      const merged = withSyncStatus({
        ...existing,
        ...cloudAction,
        id: existing.id,
        cloudId,
        storageSource: 'both',
        syncStatus: SYNC_STATUS.CLOUD,
      })
      replaceEntry(existing, merged)
      return
    }

    const localId = cloudAction.id
    if (localId && byId.has(localId)) {
      const existing = byId.get(localId)
      const merged = withSyncStatus({
        ...existing,
        ...cloudAction,
        cloudId: cloudId ?? existing.cloudId,
        storageSource: 'both',
        syncStatus: SYNC_STATUS.CLOUD,
      })
      replaceEntry(existing, merged)
      return
    }

    const sk = sourceKey(cloudAction)
    if (sk && bySourceKey.has(sk)) {
      const existing = bySourceKey.get(sk)
      const merged = withSyncStatus({
        ...existing,
        ...cloudAction,
        id: existing.id,
        cloudId: cloudId ?? existing.cloudId,
        storageSource: 'both',
        syncStatus: SYNC_STATUS.CLOUD,
      })
      replaceEntry(existing, merged)
      return
    }

    register(cloudAction, 'cloud')
  })

  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function getMergedActions(localActions, cloudActions) {
  return mergeActions(localActions ?? [], cloudActions ?? [])
}

export async function fetchActionRecords(userId, { isAdmin = false } = {}) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { records: [], error: null }
  }

  let query = supabase
    .from('action_register_records')
    .select('*')
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error) {
    return { records: [], error }
  }

  const records = (data ?? []).map(rowToActionRecord)
  return { records, error: null }
}

export async function saveActionRecord(user, action) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }

  const userId = user?.id
  if (!userId) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const row = mapActionToRow(action, userId)

  const { data, error } = await supabase
    .from('action_register_records')
    .insert(row)
    .select()
    .single()

  if (error) {
    return { record: null, error }
  }

  return { record: rowToActionRecord(data), error: null }
}

export async function updateActionRecord(user, action) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }

  const userId = user?.id
  if (!userId) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  if (!action.cloudId) {
    return saveActionRecord(user, action)
  }

  const row = mapActionToRow(action, userId)
  const isCompleted = action.status === 'completed'

  const { data, error } = await supabase
    .from('action_register_records')
    .update({
      record_data: row.record_data,
      source_type: row.source_type,
      source_record_id: row.source_record_id,
      action_description: row.action_description,
      person_responsible: row.person_responsible,
      due_date: row.due_date,
      priority: row.priority,
      status: row.status,
      site_location: row.site_location,
      notes: row.notes,
      completed_at: isCompleted
        ? action.completedAt || row.completed_at || new Date().toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', action.cloudId)
    .select()
    .single()

  if (error) {
    return { record: null, error }
  }

  return { record: rowToActionRecord(data), error: null }
}
