/**
 * Supabase table: public.machine_service_records
 * Local fallback key: monrad-earthworx-machine-service-records
 */

import { MACHINE_SERVICE_RECORDS_KEY } from '../../constants/storageKeys.js'
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

export function createEmptyServiceRecord(equipmentId = '') {
  return {
    id: createRecordId(),
    cloudId: null,
    equipmentId,
    serviceDate: '',
    serviceType: '',
    operatingHours: '',
    odometer: '',
    serviceProvider: '',
    workCompleted: '',
    partsOrFluids: '',
    recommendations: '',
    nextServiceDate: '',
    nextServiceHours: '',
    nextServiceOdometer: '',
    completedBy: '',
    invoiceReference: '',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    syncStatus: null,
    storageSource: 'local',
  }
}

export function normalizeServiceRecord(record) {
  if (!record || typeof record !== 'object') return createEmptyServiceRecord()
  return {
    ...createEmptyServiceRecord(),
    ...record,
    id: record.id || createRecordId(),
  }
}

export function loadLocalServiceRecords() {
  try {
    const raw = localStorage.getItem(MACHINE_SERVICE_RECORDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeServiceRecord)
  } catch {
    return []
  }
}

export function persistLocalServiceRecords(records) {
  try {
    localStorage.setItem(MACHINE_SERVICE_RECORDS_KEY, JSON.stringify(records))
    return true
  } catch {
    return false
  }
}

function blankToNull(value) {
  if (value === '' || value == null) return null
  return value
}

function blankNumberToNull(value) {
  if (value === '' || value == null) return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

function withCloudOwnership(record, row) {
  return withSyncStatus({
    ...record,
    cloudId: row.id,
    storageSource: 'cloud',
    syncStatus: SYNC_STATUS.CLOUD,
  })
}

export function mapServiceToRow(record) {
  const normalized = normalizeServiceRecord(record)
  return {
    machine_id: normalized.equipmentId || null,
    service_date: blankToNull(normalized.serviceDate?.trim?.() ?? normalized.serviceDate),
    service_type: normalized.serviceType?.trim() || null,
    hours_at_service: blankNumberToNull(normalized.operatingHours),
    odometer_at_service: blankNumberToNull(normalized.odometer),
    service_provider: normalized.serviceProvider?.trim() || null,
    work_completed: normalized.workCompleted?.trim() || null,
    parts_or_fluids: normalized.partsOrFluids?.trim() || null,
    recommendations: normalized.recommendations?.trim() || null,
    next_service_date: blankToNull(normalized.nextServiceDate?.trim?.() ?? normalized.nextServiceDate),
    next_service_hours: blankNumberToNull(normalized.nextServiceHours),
    next_service_odometer: blankNumberToNull(normalized.nextServiceOdometer),
    completed_by: normalized.completedBy?.trim() || null,
    reference_number: normalized.invoiceReference?.trim() || null,
    updated_at: new Date().toISOString(),
  }
}

export function rowToServiceRecord(row) {
  return normalizeServiceRecord(
    withCloudOwnership(
      {
        id: row.id,
        equipmentId: row.machine_id ?? '',
        serviceDate: row.service_date ?? '',
        serviceType: row.service_type ?? '',
        operatingHours: row.hours_at_service ?? '',
        odometer: row.odometer_at_service ?? '',
        serviceProvider: row.service_provider ?? '',
        workCompleted: row.work_completed ?? '',
        partsOrFluids: row.parts_or_fluids ?? '',
        recommendations: row.recommendations ?? '',
        nextServiceDate: row.next_service_date ?? '',
        nextServiceHours: row.next_service_hours ?? '',
        nextServiceOdometer: row.next_service_odometer ?? '',
        completedBy: row.completed_by ?? '',
        invoiceReference: row.reference_number ?? '',
        createdAt: row.created_at ?? new Date().toISOString(),
        updatedAt: row.updated_at ?? null,
      },
      row,
    ),
  )
}

function serviceDedupeKey(record) {
  return [
    record.equipmentId,
    record.serviceDate,
    record.serviceType,
    record.operatingHours,
    record.invoiceReference,
  ]
    .map((part) => String(part ?? '').trim().toLowerCase())
    .join('|')
}

export function mergeServiceRecords(localRecords, cloudRecords) {
  const byId = new Map()
  const byCloudId = new Map()
  const byDedupe = new Map()

  function register(record, source) {
    const entry = withSyncStatus({
      ...normalizeServiceRecord(record),
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
    byDedupe.set(serviceDedupeKey(entry), entry)
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

    const key = serviceDedupeKey(cloudRecord)
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

  return [...byId.values()].sort((a, b) => (b.serviceDate || '').localeCompare(a.serviceDate || ''))
}

export function getMergedServiceRecords(localRecords, cloudRecords) {
  return mergeServiceRecords(localRecords ?? [], cloudRecords ?? [])
}

export async function fetchServiceRecords(userId) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { records: [], error: null }
  }

  const { data, error } = await supabase
    .from('machine_service_records')
    .select('*')
    .order('service_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return { records: [], error }
  return { records: (data ?? []).map(rowToServiceRecord), error: null }
}

export async function saveServiceRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }
  if (!user?.id) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const row = {
    ...mapServiceToRow(record),
    created_by: user.id,
  }
  const { data, error } = await supabase
    .from('machine_service_records')
    .insert(row)
    .select()
    .single()

  if (error) return { record: null, error }
  return { record: rowToServiceRecord(data), error: null }
}

export async function updateServiceRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }
  if (!user?.id) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }
  if (!record.cloudId) return saveServiceRecord(user, record)

  const row = mapServiceToRow(record)
  const { data, error } = await supabase
    .from('machine_service_records')
    .update(row)
    .eq('id', record.cloudId)
    .select()
    .single()

  if (error) return { record: null, error }
  return { record: rowToServiceRecord(data), error: null }
}

export function getServicesForEquipment(serviceRecords, equipmentId) {
  return serviceRecords
    .filter((record) => record.equipmentId === equipmentId)
    .sort((a, b) => (b.serviceDate || '').localeCompare(a.serviceDate || ''))
}
