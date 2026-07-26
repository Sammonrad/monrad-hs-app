/**
 * Supabase table: public.machine_equipment
 * Local fallback key: monrad-earthworx-machine-equipment
 */

import { MACHINE_EQUIPMENT_KEY } from '../../constants/storageKeys.js'
import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { createRecordId } from '../ids.js'
import {
  SYNC_STATUS,
  withSyncStatus,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
  formatCloudSaveError,
  NOT_SIGNED_IN_CLOUD_MESSAGE,
  AUTH_REQUIRED_CODE,
  isAuthRequiredError,
} from './cloudSyncStatus.js'
import { ARCHIVE_RECORD_TYPES, filterArchived } from './archiveFilter.js'

export {
  SYNC_STATUS,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
  formatCloudSaveError,
  NOT_SIGNED_IN_CLOUD_MESSAGE,
  AUTH_REQUIRED_CODE,
  isAuthRequiredError,
} from './cloudSyncStatus.js'

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

export function loadLocalEquipmentRecords() {
  try {
    const raw = localStorage.getItem(MACHINE_EQUIPMENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeEquipment)
  } catch {
    return []
  }
}

export function persistLocalEquipmentRecords(records) {
  try {
    localStorage.setItem(MACHINE_EQUIPMENT_KEY, JSON.stringify(records))
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

function assetDedupeKey(record) {
  return (record.assetNumber || '').trim().toLowerCase()
}

export function mergeEquipmentRecords(localRecords, cloudRecords) {
  const byId = new Map()
  const byCloudId = new Map()
  const byAsset = new Map()

  function register(record, source) {
    const entry = withSyncStatus({
      ...normalizeEquipment(record),
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
    const key = assetDedupeKey(entry)
    if (key) byAsset.set(key, entry)
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
      const key = assetDedupeKey(merged)
      if (key) byAsset.set(key, merged)
      return
    }

    const key = assetDedupeKey(cloudRecord)
    if (key && byAsset.has(key)) {
      const existing = byAsset.get(key)
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
      byAsset.set(key, merged)
      return
    }

    register(cloudRecord, 'cloud')
  })

  return [...byId.values()].sort((a, b) =>
    (a.assetNumber || '').localeCompare(b.assetNumber || ''),
  )
}

export function getMergedEquipmentRecords(localRecords, cloudRecords, { includeArchived = false } = {}) {
  const merged = mergeEquipmentRecords(localRecords ?? [], cloudRecords ?? [])
  return filterArchived(merged, ARCHIVE_RECORD_TYPES.EQUIPMENT, includeArchived)
}

export async function fetchEquipmentRecords(userId, { includeArchived = false } = {}) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { records: [], error: null }
  }

  const { data, error } = await supabase
    .from('machine_equipment')
    .select('*')
    .order('asset_number', { ascending: true })

  if (error) return { records: [], error }

  return {
    records: filterArchived(
      (data ?? []).map(rowToEquipment),
      ARCHIVE_RECORD_TYPES.EQUIPMENT,
      includeArchived,
    ),
    error: null,
  }
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

function authRequiredError(message = 'Not signed into cloud.') {
  return Object.assign(new Error(message), {
    code: AUTH_REQUIRED_CODE,
    message,
  })
}

function firstInsertedRow(data) {
  if (Array.isArray(data)) return data[0] ?? null
  if (data && typeof data === 'object') return data
  return null
}

/** Verifies a live Supabase session before any equipment cloud write. */
export async function requireEquipmentCloudUser() {
  if (!isSupabaseConfigured || !supabase) {
    console.log('Equipment cloud save auth.getUser(): Supabase is not configured.')
    return { user: null, error: authRequiredError('Supabase is not configured.') }
  }

  const authResult = await supabase.auth.getUser()
  console.log('Equipment cloud save auth.getUser():', {
    user: authResult?.data?.user
      ? { id: authResult.data.user.id, email: authResult.data.user.email }
      : null,
    error: authResult?.error ?? null,
  })

  if (authResult?.error) {
    return { user: null, error: authResult.error }
  }

  const user = authResult?.data?.user ?? null
  if (!user?.id) {
    return { user: null, error: authRequiredError() }
  }

  return { user, error: null }
}

export async function saveEquipmentRecord(_user, record) {
  const { user, error: authError } = await requireEquipmentCloudUser()
  if (authError || !user?.id) {
    return { record: null, error: authError ?? authRequiredError() }
  }

  // Do not send a client-generated id — DB generates uuid via gen_random_uuid().
  const row = {
    ...mapEquipmentToRow(record),
    created_by: user.id,
  }
  const { data, error } = await supabase.from('machine_equipment').insert(row).select()

  console.log('Equipment cloud save result:', { data, error })

  const inserted = firstInsertedRow(data)
  if (error) return { record: null, error }
  if (!inserted?.id) {
    return {
      record: null,
      error: Object.assign(new Error('Insert returned no row.'), {
        code: 'NO_ROW',
        message: 'Insert returned no row.',
      }),
    }
  }

  return { record: rowToEquipment(inserted), error: null }
}

export async function updateEquipmentRecord(_user, record) {
  const { user, error: authError } = await requireEquipmentCloudUser()
  if (authError || !user?.id) {
    return { record: null, error: authError ?? authRequiredError() }
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

  console.log('Equipment cloud save result:', { data, error })

  const updated = firstInsertedRow(data)
  if (error) return { record: null, error }
  if (!updated?.id) {
    return {
      record: null,
      error: Object.assign(new Error('Update returned no row.'), {
        code: 'NO_ROW',
        message: 'Update returned no row.',
      }),
    }
  }

  return { record: rowToEquipment(updated), error: null }
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
