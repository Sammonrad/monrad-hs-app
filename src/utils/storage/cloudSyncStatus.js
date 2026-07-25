import { isSupabaseConfigured, supabase } from '../supabaseClient.js'

export const SYNC_STATUS = {
  CLOUD: 'cloud',
  LOCAL_ONLY: 'local-only',
  OFFLINE: 'offline',
  CLOUD_FAILED: 'cloud-failed',
}

/** Exact UI copy when cloud save is skipped because there is no Supabase session. */
export const NOT_SIGNED_IN_CLOUD_MESSAGE = 'Saved to device only — not signed into cloud'

export const AUTH_REQUIRED_CODE = 'AUTH_REQUIRED'

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
    case SYNC_STATUS.LOCAL_ONLY:
      return NOT_SIGNED_IN_CLOUD_MESSAGE
    case SYNC_STATUS.OFFLINE:
    default:
      return 'Offline/local save only'
  }
}

/** User-facing cloud error text; never treat a failed insert as success. */
export function formatCloudSaveError(error, { adminRequired = false } = {}) {
  const code = error?.code ? String(error.code).trim() : ''
  const message = error?.message?.trim() || 'Unknown cloud save error.'
  const withCode = code && code !== AUTH_REQUIRED_CODE ? `[${code}] ${message}` : message
  if (
    adminRequired &&
    /row-level security|violates row-level|permission denied|42501/i.test(message)
  ) {
    return `${withCode} Equipment cloud writes require an admin profile (user_profiles.role = admin).`
  }
  if (/JWT|not authenticated|sign in|session/i.test(message)) {
    return `${withCode} Sign in again, then retry cloud save.`
  }
  return withCode
}

export function isAuthRequiredError(error) {
  return error?.code === AUTH_REQUIRED_CODE
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
