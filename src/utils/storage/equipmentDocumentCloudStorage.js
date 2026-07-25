/**
 * Supabase table: public.machine_document_records
 * Local fallback key: monrad-earthworx-machine-document-records
 */

import { MACHINE_DOCUMENT_RECORDS_KEY } from '../../constants/storageKeys.js'
import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { createRecordId } from '../ids.js'
import {
  SYNC_STATUS,
  withSyncStatus,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
  formatCloudSaveError,
} from './cloudSyncStatus.js'

export {
  SYNC_STATUS,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
  formatCloudSaveError,
} from './cloudSyncStatus.js'

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
    syncStatus: null,
    storageSource: 'local',
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

export function loadLocalDocumentRecords() {
  try {
    const raw = localStorage.getItem(MACHINE_DOCUMENT_RECORDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeDocumentRecord)
  } catch {
    return []
  }
}

export function persistLocalDocumentRecords(records) {
  try {
    localStorage.setItem(MACHINE_DOCUMENT_RECORDS_KEY, JSON.stringify(records))
    return true
  } catch {
    return false
  }
}

function blankToNull(value) {
  if (value === '' || value == null) return null
  return value
}

function withCloudOwnership(record, row) {
  return withSyncStatus({
    ...record,
    cloudId: row.id,
    storageSource: 'cloud',
    syncStatus: SYNC_STATUS.CLOUD,
  })
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

function documentDedupeKey(record) {
  return [
    record.equipmentId,
    record.documentType,
    record.documentTitle,
    record.referenceNumber,
    record.expiryDate,
  ]
    .map((part) => String(part ?? '').trim().toLowerCase())
    .join('|')
}

export function mergeDocumentRecords(localRecords, cloudRecords) {
  const byId = new Map()
  const byCloudId = new Map()
  const byDedupe = new Map()

  function register(record, source) {
    const entry = withSyncStatus({
      ...normalizeDocumentRecord(record),
      storageSource:
        record.storageSource === 'cloud' && source === 'local'
          ? 'both'
          : record.storageSource === 'local' && source === 'cloud'
            ? 'both'
            : source,
    })
    if (entry.cloudId && entry.syncStatus !== SYNC_STATUS.CLOUD_FAILED) {
      entry.syncStatus = SYNC_STATUS.CLOUD
    }
    byId.set(entry.id, entry)
    if (entry.cloudId) byCloudId.set(entry.cloudId, entry)
    byDedupe.set(documentDedupeKey(entry), entry)
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
      return
    }

    const key = documentDedupeKey(cloudRecord)
    if (key && byDedupe.has(key)) {
      const existing = byDedupe.get(key)
      const merged = withSyncStatus({
        ...existing,
        ...cloudRecord,
        id: existing.id,
        cloudId: cloudId ?? existing.cloudId,
        storageSource: 'both',
        syncStatus: SYNC_STATUS.CLOUD,
      })
      byId.set(existing.id, merged)
      if (merged.cloudId) byCloudId.set(merged.cloudId, merged)
      return
    }

    register(cloudRecord, 'cloud')
  })

  return [...byId.values()]
}

export function getMergedDocumentRecords(localRecords, cloudRecords) {
  return mergeDocumentRecords(localRecords ?? [], cloudRecords ?? [])
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
