import { isSupabaseConfigured, supabase } from '../supabaseClient.js'

export const SYNC_STATUS = {
  CLOUD: 'cloud',
  LOCAL_ONLY: 'local-only',
  OFFLINE: 'offline',
  CLOUD_FAILED: 'cloud-failed',
  CLOUD_MISSING: 'cloud-missing',
  SYNCING: 'syncing',
}

/** User-facing copy when local save succeeded but cloud sync did not. */
export const LOCAL_SAFE_CLOUD_FAILED_MESSAGE =
  'Saved locally. Cloud sync failed — this record is safe on this device and will retry.'

export const CLOUD_VERIFY_MAX_PER_LOAD = 20
export const CLOUD_VERIFY_STALE_MINUTES = 30

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
    case SYNC_STATUS.SYNCING:
      return 'Syncing…'
    case SYNC_STATUS.CLOUD_FAILED:
      return 'Local only — cloud save failed'
    case SYNC_STATUS.CLOUD_MISSING:
      return 'Local only — cloud record missing'
    case SYNC_STATUS.LOCAL_ONLY:
      return NOT_SIGNED_IN_CLOUD_MESSAGE
    case SYNC_STATUS.OFFLINE:
    default:
      return 'Offline/local save only'
  }
}

export function needsCloudRetry(record) {
  if (!record) return false
  return (
    record.syncStatus === SYNC_STATUS.CLOUD_FAILED ||
    record.syncStatus === SYNC_STATUS.CLOUD_MISSING ||
    record.syncStatus === SYNC_STATUS.OFFLINE
  )
}

export function isConfirmedCloudRecord(cloudRecord) {
  return Boolean(cloudRecord?.cloudId ?? cloudRecord?.id)
}

export function selectRecordsForCloudVerification(
  records,
  { maxCount = CLOUD_VERIFY_MAX_PER_LOAD, staleMinutes = CLOUD_VERIFY_STALE_MINUTES } = {},
) {
  const now = Date.now()
  const staleMs = staleMinutes * 60 * 1000

  return (records ?? [])
    .filter((record) => record?.syncStatus === SYNC_STATUS.CLOUD && record?.cloudId)
    .filter((record) => {
      if (!record.lastVerifiedAt) return true
      const verifiedAt = new Date(record.lastVerifiedAt).getTime()
      if (Number.isNaN(verifiedAt)) return true
      return now - verifiedAt > staleMs
    })
    .slice(0, maxCount)
}

export async function verifyCloudRecordExists(table, cloudId) {
  if (!isSupabaseConfigured || !supabase || !cloudId) {
    return { exists: false, error: null }
  }

  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('id', cloudId)
    .maybeSingle()

  if (error) {
    return { exists: false, error }
  }

  return { exists: Boolean(data?.id), error: null }
}

export function logCloudSaveFailure({ table, operation, error }) {
  console.error('[H&S cloud save failed]', {
    table,
    operation,
    code: error?.code ?? null,
    message: error?.message ?? String(error),
    details: error?.details ?? null,
  })
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
    case SYNC_STATUS.SYNCING:
      return 'cloud-sync-status--pending'
    case SYNC_STATUS.CLOUD_FAILED:
    case SYNC_STATUS.CLOUD_MISSING:
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
