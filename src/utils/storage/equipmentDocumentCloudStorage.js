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

function blankToNull(value) {
  if (value === '' || value == null) return null
  return value
}

function withCloudOwnership(record, row) {
  return {
    ...record,
    cloudId: row.id,
    syncStatus: SYNC_STATUS.CLOUD,
  }
}

export function mapDocumentToRow(record) {
  const normalized = normalizeDocumentRecord(record)
  return {
    machine_id: normalized.equipmentId || null,
    document_type: normalized.documentType?.trim() || null,
    document_title: normalized.documentTitle?.trim() || null,
    reference_number: normalized.referenceNumber?.trim() || null,
    issuing_organisation: normalized.issuingOrganisation?.trim() || null,
    issue_date: blankToNull(normalized.issueDate?.trim?.() ?? normalized.issueDate),
    expiry_date: blankToNull(normalized.expiryDate?.trim?.() ?? normalized.expiryDate),
    document_location: normalized.documentLocation?.trim() || null,
    notes: normalized.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }
}

export function rowToDocumentRecord(row) {
  return normalizeDocumentRecord(
    withCloudOwnership(
      {
        id: row.id,
        equipmentId: row.machine_id ?? '',
        documentType: row.document_type ?? '',
        documentTitle: row.document_title ?? '',
        referenceNumber: row.reference_number ?? '',
        issuingOrganisation: row.issuing_organisation ?? '',
        issueDate: row.issue_date ?? '',
        expiryDate: row.expiry_date ?? '',
        documentLocation: row.document_location ?? '',
        notes: row.notes ?? '',
        createdAt: row.created_at ?? new Date().toISOString(),
        updatedAt: row.updated_at ?? null,
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

  const row = {
    ...mapDocumentToRow(record),
    created_by: user.id,
  }
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

  const row = mapDocumentToRow(record)
  const { data, error } = await supabase
    .from('machine_document_records')
    .update(row)
    .eq('id', record.cloudId)
    .select()
    .single()

  if (error) return { record: null, error }
  return { record: rowToDocumentRecord(data), error: null }
}

export function getDocumentsForEquipment(documentRecords, equipmentId) {
  return documentRecords.filter((record) => record.equipmentId === equipmentId)
}
