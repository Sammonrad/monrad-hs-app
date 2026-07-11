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

function blankToNull(value) {
  if (value === '' || value == null) return null
  return value
}

export function mapDefectToRow(record, userId, { forInsert = false } = {}) {
  const normalized = normalizeDefectRecord(record)
  const row = {
    machine_id: normalized.equipmentId || null,
    reported_at: normalized.reportedAt || new Date().toISOString(),
    severity: normalized.severity?.trim() || 'Minor',
    defect_description: normalized.description?.trim() || null,
    immediate_action: normalized.immediateAction?.trim() || null,
    machine_isolated: normalized.machineIsolated,
    safe_to_operate: normalized.safeToOperate,
    status: normalized.status?.trim() || 'Open',
    assigned_to: normalized.assignedPerson?.trim() || null,
    target_date: blankToNull(normalized.targetDate?.trim?.() ?? normalized.targetDate),
    source_type: normalized.sourceType?.trim() || 'Manual',
    source_record_id: normalized.sourceRecordId?.trim() || null,
    resolution_details: normalized.resolutionDetails?.trim() || null,
    resolved_at: normalized.resolvedAt || null,
    updated_at: new Date().toISOString(),
  }

  if (forInsert && userId) {
    row.reported_by = userId
  }

  if (normalized.status === 'Resolved' && userId) {
    row.resolved_by = userId
  }

  return row
}

export function rowToDefectRecord(row) {
  return normalizeDefectRecord(
    withCloudOwnership(
      {
        id: row.id,
        equipmentId: row.machine_id ?? '',
        reportedAt: row.reported_at ?? row.created_at ?? new Date().toISOString(),
        severity: row.severity ?? 'Minor',
        description: row.defect_description ?? '',
        immediateAction: row.immediate_action ?? '',
        machineIsolated: row.machine_isolated ?? false,
        safeToOperate: row.safe_to_operate !== false,
        status: row.status ?? 'Open',
        assignedPerson: row.assigned_to ?? '',
        targetDate: row.target_date ?? '',
        sourceType: row.source_type ?? 'Manual',
        sourceRecordId: row.source_record_id ?? '',
        resolutionDetails: row.resolution_details ?? '',
        resolvedAt: row.resolved_at ?? null,
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

  const row = mapDefectToRow(record, user.id, { forInsert: true })
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
    .update(row)
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
