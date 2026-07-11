/**
 * Supabase table: public.machine_document_records
 */

import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { createRecordId } from '../ids.js'
import { SYNC_STATUS } from './cloudSyncStatus.js'

export function createEmptyDocumentRecord(equipmentId = '') {
  return {
    id: createRecordId(),
    cloudId: null,
    equipmentId,
    documentType: '',
    documentTitle: '',
    referenceNumber: '',
    issuingOrganisation: '',
    issueDate: '',
    expiryDate: '',
    documentLocation: '',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    syncStatus: SYNC_STATUS.CLOUD,
  }
}

export function normalizeDocumentRecord(record) {
  if (!record || typeof record !== 'object') return createEmptyDocumentRecord()
  return {
    ...createEmptyDocumentRecord(),
    ...record,
    id: record.id || createRecordId(),
  }
}

function withCloudOwnership(record, row) {
  return {
    ...record,
    cloudId: row.id,
    syncStatus: SYNC_STATUS.CLOUD,
  }
}

export function mapDocumentToRow(record, userId) {
  const normalized = normalizeDocumentRecord(record)
  return {
    user_id: userId,
    equipment_id: normalized.equipmentId,
    record_data: { ...normalized, syncStatus: SYNC_STATUS.CLOUD },
    document_type: normalized.documentType?.trim() || null,
    document_title: normalized.documentTitle?.trim() || null,
    reference_number: normalized.referenceNumber?.trim() || null,
    issuing_organisation: normalized.issuingOrganisation?.trim() || null,
    issue_date: normalized.issueDate?.trim() || null,
    expiry_date: normalized.expiryDate?.trim() || null,
    document_location: normalized.documentLocation?.trim() || null,
    notes: normalized.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }
}

export function rowToDocumentRecord(row) {
  const data = row.record_data
  if (data && typeof data === 'object') {
    return normalizeDocumentRecord(
      withCloudOwnership({ ...data, equipmentId: row.equipment_id ?? data.equipmentId, cloudId: row.id }, row),
    )
  }

  return normalizeDocumentRecord(
    withCloudOwnership(
      {
        id: row.id,
        equipmentId: row.equipment_id ?? '',
        documentType: row.document_type ?? '',
        documentTitle: row.document_title ?? '',
        referenceNumber: row.reference_number ?? '',
        issuingOrganisation: row.issuing_organisation ?? '',
        issueDate: row.issue_date ?? '',
        expiryDate: row.expiry_date ?? '',
        documentLocation: row.document_location ?? '',
        notes: row.notes ?? '',
        createdAt: row.created_at ?? new Date().toISOString(),
      },
      row,
    ),
  )
}

export async function fetchDocumentRecords(userId) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { records: [], error: null }
  }

  const { data, error } = await supabase
    .from('machine_document_records')
    .select('*')
    .order('expiry_date', { ascending: true, nullsFirst: false })

  if (error) return { records: [], error }
  return { records: (data ?? []).map(rowToDocumentRecord), error: null }
}

export async function saveDocumentRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }
  if (!user?.id) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const row = mapDocumentToRow(record, user.id)
  const { data, error } = await supabase
    .from('machine_document_records')
    .insert(row)
    .select()
    .single()

  if (error) return { record: null, error }
  return { record: rowToDocumentRecord(data), error: null }
}

export async function updateDocumentRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }
  if (!user?.id) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }
  if (!record.cloudId) return saveDocumentRecord(user, record)

  const row = mapDocumentToRow(record, user.id)
  const { data, error } = await supabase
    .from('machine_document_records')
    .update({
      record_data: row.record_data,
      document_type: row.document_type,
      document_title: row.document_title,
      reference_number: row.reference_number,
      issuing_organisation: row.issuing_organisation,
      issue_date: row.issue_date,
      expiry_date: row.expiry_date,
      document_location: row.document_location,
      notes: row.notes,
      updated_at: row.updated_at,
    })
    .eq('id', record.cloudId)
    .select()
    .single()

  if (error) return { record: null, error }
  return { record: rowToDocumentRecord(data), error: null }
}

export function getDocumentsForEquipment(documentRecords, equipmentId) {
  return documentRecords.filter((record) => record.equipmentId === equipmentId)
}
