import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { normalizeSubcontractorInduction } from './subcontractorInductionStorage.js'
import { SYNC_STATUS } from './cloudSyncStatus.js'
export { SYNC_STATUS, isCloudSaveUnavailable, getUnavailableSyncStatus, formatCloudSaveError } from './cloudSyncStatus.js'

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
  let query = supabase.from('subcontractor_induction_records').select('*').order('induction_date', { ascending: false }).order('created_at', { ascending: false })
  if (!isAdmin) query = query.eq('user_id', userId)
  const { data, error } = await query
  return { records: error ? [] : (data || []).map(rowToRecord), error }
}
export async function saveSubcontractorInduction(user, record) {
  if (!isSupabaseConfigured || !supabase) return { record: null, error: new Error('Supabase is not configured.') }
  if (!user?.id) return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  const row = recordToRow(record, user.id)
  const query = record.cloudId
    ? supabase.from('subcontractor_induction_records').update(row).eq('id', record.cloudId)
    : supabase.from('subcontractor_induction_records').insert(row)
  const { data, error } = await query.select().single()
  return { record: data ? rowToRecord(data) : null, error }
}

export async function deleteSubcontractorInduction(user, record, { isAdmin = false } = {}) {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: new Error('Supabase is not configured.') }
  if (!user?.id) return { ok: false, error: new Error('You must be signed in to delete a cloud record.') }
  if (!record?.cloudId) return { ok: true, error: null }
  let query = supabase.from('subcontractor_induction_records').delete().eq('id', record.cloudId)
  if (!isAdmin) query = query.eq('user_id', user.id)
  const { error } = await query
  return { ok: !error, error }
}
