/**
 * Supabase table: public.machine_equipment
 */

import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { createRecordId } from '../ids.js'
import { SYNC_STATUS } from './cloudSyncStatus.js'

export function createEmptyEquipment() {
  return {
    id: createRecordId(),
    cloudId: null,
    assetNumber: '',
    assetName: '',
    assetType: '',
    make: '',
    model: '',
    manufactureYear: '',
    serialNumber: '',
    registrationNumber: '',
    ownershipStatus: 'Owned',
    operationalStatus: 'Available',
    assignedOperator: '',
    normalLocation: '',
    currentHours: '',
    currentOdometer: '',
    nextServiceDate: '',
    nextServiceHours: '',
    nextServiceOdometer: '',
    prestartRequired: true,
    roadLegal: false,
    notes: '',
    archived: false,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    syncStatus: null,
    storageSource: 'local',
  }
}

export function normalizeEquipment(record) {
  if (!record || typeof record !== 'object') return createEmptyEquipment()
  return {
    ...createEmptyEquipment(),
    ...record,
    id: record.id || createRecordId(),
    prestartRequired: Boolean(record.prestartRequired),
    roadLegal: Boolean(record.roadLegal),
    archived: Boolean(record.archived),
  }
}

function withCloudOwnership(record, row) {
  return {
    ...record,
    cloudId: row.id,
    storageSource: 'cloud',
    syncStatus: SYNC_STATUS.CLOUD,
  }
}

export function mapEquipmentToRow(record, userId) {
  const normalized = normalizeEquipment(record)
  return {
    user_id: userId,
    record_data: { ...normalized, syncStatus: SYNC_STATUS.CLOUD },
    asset_number: normalized.assetNumber?.trim() || null,
    asset_name: normalized.assetName?.trim() || null,
    asset_type: normalized.assetType?.trim() || null,
    make: normalized.make?.trim() || null,
    model: normalized.model?.trim() || null,
    serial_number: normalized.serialNumber?.trim() || null,
    registration_number: normalized.registrationNumber?.trim() || null,
    ownership_status: normalized.ownershipStatus?.trim() || null,
    operational_status: normalized.operationalStatus?.trim() || 'Available',
    assigned_operator: normalized.assignedOperator?.trim() || null,
    normal_location: normalized.normalLocation?.trim() || null,
    current_hours: normalized.currentHours === '' ? null : Number(normalized.currentHours),
    current_odometer: normalized.currentOdometer === '' ? null : Number(normalized.currentOdometer),
    next_service_date: normalized.nextServiceDate?.trim() || null,
    next_service_hours: normalized.nextServiceHours === '' ? null : Number(normalized.nextServiceHours),
    next_service_odometer:
      normalized.nextServiceOdometer === '' ? null : Number(normalized.nextServiceOdometer),
    prestart_required: normalized.prestartRequired,
    road_legal: normalized.roadLegal,
    archived: normalized.archived,
    archived_at: normalized.archivedAt || null,
    notes: normalized.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }
}

export function rowToEquipment(row) {
  const data = row.record_data
  if (data && typeof data === 'object' && data.assetNumber != null) {
    return normalizeEquipment(
      withCloudOwnership(
        {
          ...data,
          cloudId: row.id,
          archived: row.archived ?? data.archived ?? false,
          archivedAt: row.archived_at ?? data.archivedAt ?? null,
        },
        row,
      ),
    )
  }

  return normalizeEquipment(
    withCloudOwnership(
      {
        id: row.id,
        assetNumber: row.asset_number ?? '',
        assetName: row.asset_name ?? '',
        assetType: row.asset_type ?? '',
        make: row.make ?? '',
        model: row.model ?? '',
        serialNumber: row.serial_number ?? '',
        registrationNumber: row.registration_number ?? '',
        ownershipStatus: row.ownership_status ?? 'Owned',
        operationalStatus: row.operational_status ?? 'Available',
        assignedOperator: row.assigned_operator ?? '',
        normalLocation: row.normal_location ?? '',
        currentHours: row.current_hours ?? '',
        currentOdometer: row.current_odometer ?? '',
        nextServiceDate: row.next_service_date ?? '',
        nextServiceHours: row.next_service_hours ?? '',
        nextServiceOdometer: row.next_service_odometer ?? '',
        prestartRequired: row.prestart_required ?? true,
        roadLegal: row.road_legal ?? false,
        notes: row.notes ?? '',
        archived: row.archived ?? false,
        archivedAt: row.archived_at ?? null,
        createdAt: row.created_at ?? new Date().toISOString(),
        updatedAt: row.updated_at ?? null,
      },
      row,
    ),
  )
}

export async function fetchEquipmentRecords(userId) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { records: [], error: null }
  }

  const { data, error } = await supabase
    .from('machine_equipment')
    .select('*')
    .order('asset_number', { ascending: true })

  if (error) return { records: [], error }

  return { records: (data ?? []).map(rowToEquipment), error: null }
}

export async function checkAssetNumberExists(assetNumber, excludeCloudId = null) {
  if (!isSupabaseConfigured || !supabase || !assetNumber?.trim()) {
    return { exists: false, error: null }
  }

  let query = supabase
    .from('machine_equipment')
    .select('id')
    .eq('asset_number', assetNumber.trim())

  if (excludeCloudId) {
    query = query.neq('id', excludeCloudId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) return { exists: false, error }
  return { exists: Boolean(data), error: null }
}

export async function saveEquipmentRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }
  if (!user?.id) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const row = mapEquipmentToRow(record, user.id)
  const { data, error } = await supabase
    .from('machine_equipment')
    .insert(row)
    .select()
    .single()

  if (error) return { record: null, error }
  return { record: rowToEquipment(data), error: null }
}

export async function updateEquipmentRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }
  if (!user?.id) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }
  if (!record.cloudId) {
    return saveEquipmentRecord(user, record)
  }

  const row = mapEquipmentToRow(record, user.id)
  const { data, error } = await supabase
    .from('machine_equipment')
    .update({
      record_data: row.record_data,
      asset_number: row.asset_number,
      asset_name: row.asset_name,
      asset_type: row.asset_type,
      make: row.make,
      model: row.model,
      serial_number: row.serial_number,
      registration_number: row.registration_number,
      ownership_status: row.ownership_status,
      operational_status: row.operational_status,
      assigned_operator: row.assigned_operator,
      normal_location: row.normal_location,
      current_hours: row.current_hours,
      current_odometer: row.current_odometer,
      next_service_date: row.next_service_date,
      next_service_hours: row.next_service_hours,
      next_service_odometer: row.next_service_odometer,
      prestart_required: row.prestart_required,
      road_legal: row.road_legal,
      archived: row.archived,
      archived_at: row.archived_at,
      notes: row.notes,
      updated_at: row.updated_at,
    })
    .eq('id', record.cloudId)
    .select()
    .single()

  if (error) return { record: null, error }
  return { record: rowToEquipment(data), error: null }
}

export function getEquipmentById(equipmentList, id) {
  return equipmentList.find((item) => item.cloudId === id || item.id === id) ?? null
}

export function getEquipmentByReadableName(equipmentList, name) {
  const trimmed = name?.trim()?.toLowerCase()
  if (!trimmed) return null
  return (
    equipmentList.find((item) => {
      const readable = `${item.assetNumber?.trim()} — ${item.assetName?.trim()}`.toLowerCase()
      return (
        readable === trimmed ||
        item.assetNumber?.trim().toLowerCase() === trimmed ||
        item.assetName?.trim().toLowerCase() === trimmed
      )
    }) ?? null
  )
}
