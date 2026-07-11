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

function withCloudOwnership(record, row) {
  return {
    ...record,
    cloudId: row.id,
    syncStatus: SYNC_STATUS.CLOUD,
  }
}

export function mapServiceToRow(record, userId) {
  const normalized = normalizeServiceRecord(record)
  return {
    user_id: userId,
    equipment_id: normalized.equipmentId,
    record_data: { ...normalized, syncStatus: SYNC_STATUS.CLOUD },
    service_date: normalized.serviceDate?.trim() || null,
    service_type: normalized.serviceType?.trim() || null,
    operating_hours: normalized.operatingHours === '' ? null : Number(normalized.operatingHours),
    odometer: normalized.odometer === '' ? null : Number(normalized.odometer),
    service_provider: normalized.serviceProvider?.trim() || null,
    work_completed: normalized.workCompleted?.trim() || null,
    next_service_date: normalized.nextServiceDate?.trim() || null,
    next_service_hours: normalized.nextServiceHours === '' ? null : Number(normalized.nextServiceHours),
    next_service_odometer:
      normalized.nextServiceOdometer === '' ? null : Number(normalized.nextServiceOdometer),
    completed_by: normalized.completedBy?.trim() || null,
    invoice_reference: normalized.invoiceReference?.trim() || null,
    updated_at: new Date().toISOString(),
  }
}

export function rowToServiceRecord(row) {
  const data = row.record_data
  if (data && typeof data === 'object') {
    return normalizeServiceRecord(
      withCloudOwnership({ ...data, equipmentId: row.equipment_id ?? data.equipmentId, cloudId: row.id }, row),
    )
  }

  return normalizeServiceRecord(
    withCloudOwnership(
      {
        id: row.id,
        equipmentId: row.equipment_id ?? '',
        serviceDate: row.service_date ?? '',
        serviceType: row.service_type ?? '',
        operatingHours: row.operating_hours ?? '',
        odometer: row.odometer ?? '',
        serviceProvider: row.service_provider ?? '',
        workCompleted: row.work_completed ?? '',
        nextServiceDate: row.next_service_date ?? '',
        nextServiceHours: row.next_service_hours ?? '',
        nextServiceOdometer: row.next_service_odometer ?? '',
        completedBy: row.completed_by ?? '',
        invoiceReference: row.invoice_reference ?? '',
        createdAt: row.created_at ?? new Date().toISOString(),
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

  const row = mapServiceToRow(record, user.id)
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

  const row = mapServiceToRow(record, user.id)
  const { data, error } = await supabase
    .from('machine_service_records')
    .update({
      record_data: row.record_data,
      service_date: row.service_date,
      service_type: row.service_type,
      operating_hours: row.operating_hours,
      odometer: row.odometer,
      service_provider: row.service_provider,
      work_completed: row.work_completed,
      next_service_date: row.next_service_date,
      next_service_hours: row.next_service_hours,
      next_service_odometer: row.next_service_odometer,
      completed_by: row.completed_by,
      invoice_reference: row.invoice_reference,
      updated_at: row.updated_at,
    })
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
