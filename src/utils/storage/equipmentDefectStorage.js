/**
 * Supabase table: public.machine_defect_records
 * Local fallback key: machine_defect_records
 */

import { MACHINE_DEFECT_RECORDS_KEY } from '../../constants/storageKeys.js'
import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { createRecordId } from '../ids.js'
import {
  SYNC_STATUS,
  withSyncStatus,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
} from './cloudSyncStatus.js'

export {
  SYNC_STATUS,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
} from './cloudSyncStatus.js'

export function createEmptyDefectRecord(equipmentId = '') {
  return {
    id: createRecordId(),
    cloudId: null,
    equipmentId,
    equipmentName: '',
    reportedAt: new Date().toISOString(),
    severity: 'Minor',
    description: '',
    immediateAction: '',
    machineIsolated: false,
    safeToOperate: true,
    assignedPerson: '',
    targetDate: '',
    sourceType: 'Manual',
    sourceRecordId: '',
    status: 'Open',
    resolutionDetails: '',
    resolvedAt: null,
    resolvedByName: '',
    reportedByName: '',
    createdAt: new Date().toISOString(),
    syncStatus: null,
    storageSource: 'local',
  }
}

export function normalizeDefectRecord(record) {
  if (!record || typeof record !== 'object') return createEmptyDefectRecord()
  return {
    ...createEmptyDefectRecord(),
    ...record,
    id: record.id || createRecordId(),
    machineIsolated: Boolean(record.machineIsolated),
    safeToOperate: record.safeToOperate !== false,
  }
}

export function loadLocalDefectRecords() {
  try {
    const raw = localStorage.getItem(MACHINE_DEFECT_RECORDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeDefectRecord)
  } catch {
    return []
  }
}

export function persistLocalDefectRecords(records) {
  try {
    localStorage.setItem(MACHINE_DEFECT_RECORDS_KEY, JSON.stringify(records))
    return true
  } catch {
    return false
  }
}

function withCloudOwnership(record, row) {
  return withSyncStatus({
    ...record,
    cloudId: row.id,
    storageSource: 'cloud',
    syncStatus: SYNC_STATUS.CLOUD,
  })
}

export function mapDefectToRow(record, userId) {
  const normalized = normalizeDefectRecord(record)
  return {
    user_id: userId,
    equipment_id: normalized.equipmentId || null,
    record_data: { ...normalized, syncStatus: SYNC_STATUS.CLOUD },
    reported_at: normalized.reportedAt || new Date().toISOString(),
    severity: normalized.severity?.trim() || 'Minor',
    description: normalized.description?.trim() || null,
    status: normalized.status?.trim() || 'Open',
    assigned_person: normalized.assignedPerson?.trim() || null,
    target_date: normalized.targetDate?.trim() || null,
    source_type: normalized.sourceType?.trim() || 'Manual',
    source_record_id: normalized.sourceRecordId?.trim() || null,
    resolution_details: normalized.resolutionDetails?.trim() || null,
    resolved_at: normalized.resolvedAt || null,
    resolved_by_name: normalized.resolvedByName?.trim() || null,
    reported_by_name: normalized.reportedByName?.trim() || null,
    equipment_name: normalized.equipmentName?.trim() || null,
    updated_at: new Date().toISOString(),
  }
}

export function rowToDefectRecord(row) {
  const data = row.record_data
  if (data && typeof data === 'object') {
    return normalizeDefectRecord(
      withCloudOwnership(
        {
          ...data,
          equipmentId: row.equipment_id ?? data.equipmentId,
          equipmentName: row.equipment_name ?? data.equipmentName,
          cloudId: row.id,
        },
        row,
      ),
    )
  }

  return normalizeDefectRecord(
    withCloudOwnership(
      {
        id: row.id,
        equipmentId: row.equipment_id ?? '',
        equipmentName: row.equipment_name ?? '',
        reportedAt: row.reported_at ?? row.created_at ?? new Date().toISOString(),
        severity: row.severity ?? 'Minor',
        description: row.description ?? '',
        status: row.status ?? 'Open',
        assignedPerson: row.assigned_person ?? '',
        targetDate: row.target_date ?? '',
        sourceType: row.source_type ?? 'Manual',
        sourceRecordId: row.source_record_id ?? '',
        resolutionDetails: row.resolution_details ?? '',
        resolvedAt: row.resolved_at ?? null,
        resolvedByName: row.resolved_by_name ?? '',
        reportedByName: row.reported_by_name ?? '',
        createdAt: row.created_at ?? new Date().toISOString(),
      },
      row,
    ),
  )
}

function dedupeKey(record) {
  return `${record.sourceType}|${record.sourceRecordId}|${record.equipmentId}|${record.reportedAt}`
}

export function mergeDefectRecords(localRecords, cloudRecords) {
  const byId = new Map()
  const byCloudId = new Map()
  const byDedupeKey = new Map()

  function register(record, source) {
    const entry = withSyncStatus({
      ...normalizeDefectRecord(record),
      storageSource:
        record.storageSource === 'cloud' && source === 'local'
          ? 'both'
          : record.storageSource === 'local' && source === 'cloud'
            ? 'both'
            : source,
    })
    if (entry.cloudId) entry.syncStatus = SYNC_STATUS.CLOUD
    byId.set(entry.id, entry)
    if (entry.cloudId) byCloudId.set(entry.cloudId, entry)
    if (entry.sourceRecordId) byDedupeKey.set(dedupeKey(entry), entry)
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

    const dupKey = dedupeKey(cloudRecord)
    if (dupKey && byDedupeKey.has(dupKey)) {
      const existing = byDedupeKey.get(dupKey)
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

  return [...byId.values()].sort((a, b) => (b.reportedAt || '').localeCompare(a.reportedAt || ''))
}

export function getMergedDefectRecords(localRecords, cloudRecords) {
  return mergeDefectRecords(localRecords ?? [], cloudRecords ?? [])
}

export async function fetchDefectRecords(userId) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { records: [], error: null }
  }

  const { data, error } = await supabase
    .from('machine_defect_records')
    .select('*')
    .order('reported_at', { ascending: false })

  if (error) return { records: [], error }
  return { records: (data ?? []).map(rowToDefectRecord), error: null }
}

export async function saveDefectRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }
  if (!user?.id) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const row = mapDefectToRow(record, user.id)
  const { data, error } = await supabase
    .from('machine_defect_records')
    .insert(row)
    .select()
    .single()

  if (error) return { record: null, error }
  return { record: rowToDefectRecord(data), error: null }
}

export async function updateDefectRecord(user, record) {
  if (!isSupabaseConfigured || !supabase) {
    return { record: null, error: new Error('Supabase is not configured.') }
  }
  if (!user?.id) {
    return { record: null, error: new Error('You must be signed in to save to the cloud.') }
  }
  if (!record.cloudId) return saveDefectRecord(user, record)

  const row = mapDefectToRow(record, user.id)
  const { data, error } = await supabase
    .from('machine_defect_records')
    .update({
      record_data: row.record_data,
      equipment_id: row.equipment_id,
      reported_at: row.reported_at,
      severity: row.severity,
      description: row.description,
      status: row.status,
      assigned_person: row.assigned_person,
      target_date: row.target_date,
      source_type: row.source_type,
      source_record_id: row.source_record_id,
      resolution_details: row.resolution_details,
      resolved_at: row.resolved_at,
      resolved_by_name: row.resolved_by_name,
      reported_by_name: row.reported_by_name,
      equipment_name: row.equipment_name,
      updated_at: row.updated_at,
    })
    .eq('id', record.cloudId)
    .select()
    .single()

  if (error) return { record: null, error }
  return { record: rowToDefectRecord(data), error: null }
}

export function getDefectsForEquipment(defectRecords, equipmentId) {
  return defectRecords.filter((record) => record.equipmentId === equipmentId)
}

export function getOpenDefects(defectRecords) {
  return defectRecords.filter((record) => record.status !== 'Resolved')
}

export function getOpenDefectCountForEquipment(defectRecords, equipmentId) {
  return getDefectsForEquipment(defectRecords, equipmentId).filter((d) => d.status !== 'Resolved')
    .length
}

export function hasOpenCriticalDefect(defectRecords, equipmentId) {
  return getDefectsForEquipment(defectRecords, equipmentId).some(
    (d) => d.status !== 'Resolved' && d.severity === 'Critical',
  )
}

export function sortDefectsForDisplay(defects) {
  const severityOrder = { Critical: 0, Major: 1, Minor: 2 }
  const statusOrder = { Open: 0, 'In Progress': 1, Deferred: 2, Resolved: 3 }
  return [...defects].sort((a, b) => {
    const aOpen = a.status !== 'Resolved' ? 0 : 1
    const bOpen = b.status !== 'Resolved' ? 0 : 1
    if (aOpen !== bOpen) return aOpen - bOpen
    const sevDiff = (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
    if (sevDiff !== 0) return sevDiff
    const statDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
    if (statDiff !== 0) return statDiff
    return (b.reportedAt || '').localeCompare(a.reportedAt || '')
  })
}

export function findDefectBySource(defectRecords, sourceType, sourceRecordId) {
  return (
    defectRecords.find(
      (d) => d.sourceType === sourceType && d.sourceRecordId === sourceRecordId,
    ) ?? null
  )
}
