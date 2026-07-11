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
    storageSource: 'cloud',
    syncStatus: SYNC_STATUS.CLOUD,
  }
}

export function mapEquipmentToRow(record) {
  const normalized = normalizeEquipment(record)
  return {
    asset_number: normalized.assetNumber?.trim() || null,
    asset_name: normalized.assetName?.trim() || null,
    asset_type: normalized.assetType?.trim() || null,
    make: normalized.make?.trim() || null,
    model: normalized.model?.trim() || null,
    manufacture_year: blankNumberToNull(normalized.manufactureYear),
    serial_number: normalized.serialNumber?.trim() || null,
    registration_number: normalized.registrationNumber?.trim() || null,
    ownership_status: normalized.ownershipStatus?.trim() || null,
    operational_status: normalized.operationalStatus?.trim() || 'Available',
    assigned_operator: normalized.assignedOperator?.trim() || null,
    normal_location: normalized.normalLocation?.trim() || null,
    current_hours: blankNumberToNull(normalized.currentHours),
    current_odometer: blankNumberToNull(normalized.currentOdometer),
    next_service_date: blankToNull(normalized.nextServiceDate?.trim?.() ?? normalized.nextServiceDate),
    next_service_hours: blankNumberToNull(normalized.nextServiceHours),
    next_service_odometer: blankNumberToNull(normalized.nextServiceOdometer),
    prestart_required: normalized.prestartRequired,
    road_legal: normalized.roadLegal,
    archived: normalized.archived,
    notes: normalized.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }
}

export function rowToEquipment(row) {
  return normalizeEquipment(
    withCloudOwnership(
      {
        id: row.id,
        assetNumber: row.asset_number ?? '',
        assetName: row.asset_name ?? '',
        assetType: row.asset_type ?? '',
        make: row.make ?? '',
        model: row.model ?? '',
        manufactureYear: row.manufacture_year ?? '',
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

  const row = {
    ...mapEquipmentToRow(record),
    created_by: user.id,
  }
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

  const row = mapEquipmentToRow(record)
  const { data, error } = await supabase
    .from('machine_equipment')
    .update(row)
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
