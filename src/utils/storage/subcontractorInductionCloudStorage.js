import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { normalizeSubcontractorInduction } from './subcontractorInductionStorage.js'
import { SYNC_STATUS, logCloudSaveFailure, isConfirmedCloudRecord, verifyCloudRecordExists, selectRecordsForCloudVerification } from './cloudSyncStatus.js'
export {
  SYNC_STATUS,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
  formatCloudSaveError,
  needsCloudRetry,
  logCloudSaveFailure,
  isConfirmedCloudRecord,
  verifyCloudRecordExists,
  selectRecordsForCloudVerification,
  LOCAL_SAFE_CLOUD_FAILED_MESSAGE,
} from './cloudSyncStatus.js'

export const SUBCONTRACTOR_CLOUD_TABLE = 'subcontractor_induction_records'

function rowToRecord(row) {
  return normalizeSubcontractorInduction({ ...(row.record_data || {}), cloudId: row.id, cloudUserId: row.user_id,
    inductionDate: row.induction_date, siteName: row.site_name || '', subcontractorName: row.subcontractor_name || '',
    companyName: row.company_name || '', status: row.status || 'draft', createdAt: row.created_at,
    updatedAt: row.updated_at, storageSource: 'cloud', syncStatus: SYNC_STATUS.CLOUD })
}
function recordToRow(record, userId) {
  const value = normalizeSubcontractorInduction(record)
  return { user_id: userId, record_data: { ...value, syncStatus: SYNC_STATUS.CLOUD }, induction_date: value.inductionDate,
    site_name: value.siteName.trim() || null, subcontractor_name: value.subcontractorName.trim() || null,
    company_name: value.companyName.trim() || null, status: value.status || 'draft', updated_at: new Date().toISOString() }
}
export async function fetchSubcontractorInductions(userId, { isAdmin = false } = {}) {
  if (!isSupabaseConfigured || !supabase || !userId) return { records: [], error: null }
  let query = supabase.from(SUBCONTRACTOR_CLOUD_TABLE).select('*').order('induction_date', { ascending: false }).order('created_at', { ascending: false })
  if (!isAdmin) query = query.eq('user_id', userId)
  const { data, error } = await query
  return { records: error ? [] : (data || []).map(rowToRecord), error }
}
export async function saveSubcontractorInduction(user, record) {
  if (!isSupabaseConfigured || !supabase) return { record: null, error: new Error('Supabase is not configured.') }
  if (!user?.id) return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  const row = recordToRow(record, user.id)
  const query = record.cloudId
    ? supabase.from(SUBCONTRACTOR_CLOUD_TABLE).update(row).eq('id', record.cloudId)
    : supabase.from(SUBCONTRACTOR_CLOUD_TABLE).insert(row)
  const { data, error } = await query.select().single()
  if (error) {
    const operation = record.cloudId ? 'update' : 'insert'
    logCloudSaveFailure({ table: SUBCONTRACTOR_CLOUD_TABLE, operation, error })
    return { record: null, error }
  }
  if (!isConfirmedCloudRecord({ cloudId: data?.id })) {
    const missingIdError = new Error('Cloud save did not return a record id.')
    const operation = record.cloudId ? 'update' : 'insert'
    logCloudSaveFailure({ table: SUBCONTRACTOR_CLOUD_TABLE, operation, error: missingIdError })
    return { record: null, error: missingIdError }
  }
  return { record: rowToRecord(data), error: null }
}

export async function retrySubcontractorCloudSave(user, record) {
  return saveSubcontractorInduction(user, record)
}

export async function deleteSubcontractorInduction(user, record, { isAdmin = false } = {}) {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: new Error('Supabase is not configured.') }
  if (!user?.id) return { ok: false, error: new Error('You must be signed in to delete a cloud record.') }
  if (!record?.cloudId) return { ok: true, error: null }
  let query = supabase.from(SUBCONTRACTOR_CLOUD_TABLE).delete().eq('id', record.cloudId)
  if (!isAdmin) query = query.eq('user_id', user.id)
  const { error } = await query
  return { ok: !error, error }
}

export async function verifySubcontractorCloudRecords(records, options = {}) {
  const candidates = selectRecordsForCloudVerification(records, options)
  const patches = []

  for (const record of candidates) {
    const { exists, error } = await verifyCloudRecordExists(SUBCONTRACTOR_CLOUD_TABLE, record.cloudId)
    const lastVerifiedAt = new Date().toISOString()

    if (error) {
      patches.push({ id: record.id, patch: { lastVerifiedAt } })
      continue
    }

    if (!exists) {
      patches.push({
        id: record.id,
        patch: {
          syncStatus: SYNC_STATUS.CLOUD_MISSING,
          cloudId: null,
          storageSource: 'local',
          lastVerifiedAt,
        },
      })
    } else {
      patches.push({ id: record.id, patch: { lastVerifiedAt } })
    }
  }

  return patches
}
