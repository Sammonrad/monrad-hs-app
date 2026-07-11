/**
 * Supabase table: public.machine_service_records
 */

import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { createRecordId } from '../ids.js'
import { SYNC_STATUS } from './cloudSyncStatus.js'

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
    syncStatus: SYNC_STATUS.CLOUD,
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
  return {
    ...record,
    cloudId: row.id,
    syncStatus: SYNC_STATUS.CLOUD,
  }
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
