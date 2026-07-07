import { isSupabaseConfigured, supabase } from '../supabaseClient.js'

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

export function withSyncStatus(record) {
  const syncStatus = resolveRecordSyncStatus(record)
  return { ...record, syncStatus }
}
