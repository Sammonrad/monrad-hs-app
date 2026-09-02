import { DRIVER_DAILY_SHEETS_STORAGE_KEY } from '../../constants/storageKeys.js'
import { createRecordId } from '../ids.js'
import {
  createEmptyDailySheet,
  createEmptySegment,
  SHEET_STATUSES,
} from '../driverDaySegments.js'
import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import {
  SYNC_STATUS,
  withSyncStatus,
  formatCloudSaveError,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
} from './cloudSyncStatus.js'

export {
  SYNC_STATUS,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
  formatCloudSaveError,
} from './cloudSyncStatus.js'

function blankToNull(value) {
  if (value === '' || value == null) return null
  return value
}

export function normalizeDailySheet(record) {
  if (!record || typeof record !== 'object') return null
  const segments = Array.isArray(record.segments)
    ? record.segments.map(normalizeSegment).filter(Boolean)
    : []
  return {
    ...createEmptyDailySheet(),
    ...record,
    segments,
    id: record.id || createRecordId(),
  }
}

export function normalizeSegment(record) {
  if (!record || typeof record !== 'object') return null
  return {
    ...createEmptySegment(),
    ...record,
    id: record.id || createRecordId(),
  }
}

function withCloudOwnership(record, row) {
  return withSyncStatus({
    ...record,
    cloudId: row.id,
    cloudUserId: row.user_id ?? null,
    storageSource: 'cloud',
    syncStatus: record.syncStatus ?? SYNC_STATUS.CLOUD,
  })
}

export function mapDailySheetToRow(record, userId) {
  const normalized = normalizeDailySheet(record)
  const sheetData = { ...normalized, syncStatus: normalized.syncStatus ?? SYNC_STATUS.CLOUD }
  return {
    user_id: userId,
    sheet_date: blankToNull(normalized.sheetDate),
    truck_vehicle: blankToNull(normalized.truckVehicle),
    status: normalized.status || SHEET_STATUSES.DRAFT,
    started_at: blankToNull(normalized.startedAt),
    finished_at: blankToNull(normalized.finishedAt),
    timesheet_id: blankToNull(normalized.timesheetCloudId),
    sheet_data: sheetData,
    updated_at: new Date().toISOString(),
  }
}

export function mapSegmentToRow(segment, dailySheetCloudId) {
  const normalized = normalizeSegment(segment)
  return {
    daily_sheet_id: dailySheetCloudId,
    job_name: blankToNull(normalized.jobName),
    activity_type: normalized.activityType || 'job',
    started_at: blankToNull(normalized.startedAt),
    ended_at: blankToNull(normalized.endedAt),
    sort_order: normalized.sortOrder ?? 0,
    segment_data: normalized,
    updated_at: new Date().toISOString(),
  }
}

export function rowToSegment(row) {
  const data = row.segment_data
  const base =
    data && typeof data === 'object'
      ? data
      : {
          jobName: row.job_name ?? '',
          activityType: row.activity_type ?? 'job',
          startedAt: row.started_at ?? '',
          endedAt: row.ended_at ?? '',
          sortOrder: row.sort_order ?? 0,
        }

  return normalizeSegment({
    ...base,
    id: base.id || row.id,
    cloudId: row.id,
    dailySheetCloudId: row.daily_sheet_id,
    dailySheetId: base.dailySheetId || '',
    createdAt: row.created_at ?? base.createdAt,
    updatedAt: row.updated_at ?? base.updatedAt,
  })
}

export function rowToDailySheet(row, segments = []) {
  const data = row.sheet_data
  const base =
    data && typeof data === 'object'
      ? data
      : {
          sheetDate: row.sheet_date ?? '',
          truckVehicle: row.truck_vehicle ?? '',
          status: row.status ?? SHEET_STATUSES.DRAFT,
          startedAt: row.started_at ?? '',
          finishedAt: row.finished_at ?? '',
          timesheetCloudId: row.timesheet_id ?? null,
        }

  return withSyncStatus(
    normalizeDailySheet(
      withCloudOwnership(
        {
          ...base,
          id: base.id || row.id,
          segments,
          timesheetCloudId: row.timesheet_id ?? base.timesheetCloudId ?? null,
          createdAt: base.createdAt || row.created_at,
          updatedAt: row.updated_at ?? base.updatedAt,
        },
        row,
      ),
    ),
  )
}

export function loadLocalDailySheets() {
  try {
    const raw = localStorage.getItem(DRIVER_DAILY_SHEETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeDailySheet).filter(Boolean)
  } catch {
    return []
  }
}

export function persistLocalDailySheets(sheets) {
  try {
    localStorage.setItem(DRIVER_DAILY_SHEETS_STORAGE_KEY, JSON.stringify(sheets))
    return true
  } catch {
    return false
  }
}

function mergeDailySheets(localSheets, cloudSheets) {
  const byId = new Map()
  const byCloudId = new Map()

  function register(record, source) {
    const entry = withSyncStatus({
      ...record,
      storageSource:
        record.storageSource === 'cloud' && source === 'local'
          ? 'both'
          : record.storageSource === 'local' && source === 'cloud'
            ? 'both'
            : source,
    })
    if (entry.storageSource === 'both' || entry.cloudId) {
      entry.syncStatus = SYNC_STATUS.CLOUD
    }
    byId.set(entry.id, entry)
    if (entry.cloudId) byCloudId.set(entry.cloudId, entry)
  }

  localSheets.forEach((r) => register({ ...r, storageSource: r.cloudId ? 'both' : 'local' }, 'local'))
  cloudSheets.forEach((cloudRecord) => {
    const cloudId = cloudRecord.cloudId
    if (cloudId && byCloudId.has(cloudId)) {
      const existing = byCloudId.get(cloudId)
      const merged = withSyncStatus({
        ...existing,
        ...cloudRecord,
        id: existing.id,
        segments: cloudRecord.segments?.length ? cloudRecord.segments : existing.segments,
        cloudId,
        storageSource: 'both',
        syncStatus: SYNC_STATUS.CLOUD,
      })
      byId.set(existing.id, merged)
      byCloudId.set(cloudId, merged)
      return
    }
    register(cloudRecord, 'cloud')
  })

  return [...byId.values()].sort((a, b) => {
    const dateCmp = (b.sheetDate || '').localeCompare(a.sheetDate || '')
    if (dateCmp !== 0) return dateCmp
    return (b.createdAt || '').localeCompare(a.createdAt || '')
  })
}

export function getMergedDailySheets(localSheets, cloudSheets) {
  return mergeDailySheets(localSheets ?? [], cloudSheets ?? [])
}

export async function fetchDailySheets(userId, { isAdmin = false, dateFrom, dateTo } = {}) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { sheets: [], error: null }
  }

  let query = supabase
    .from('driver_daily_sheets')
    .select('*')
    .order('sheet_date', { ascending: false })

  if (!isAdmin) query = query.eq('user_id', userId)
  if (dateFrom) query = query.gte('sheet_date', dateFrom)
  if (dateTo) query = query.lte('sheet_date', dateTo)

  const { data: sheetRows, error } = await query
  if (error) return { sheets: [], error }

  const sheetIds = (sheetRows ?? []).map((row) => row.id)
  let segmentRows = []
  if (sheetIds.length > 0) {
    const { data, error: segError } = await supabase
      .from('driver_day_segments')
      .select('*')
      .in('daily_sheet_id', sheetIds)
      .order('started_at', { ascending: true })
    if (segError) return { sheets: [], error: segError }
    segmentRows = data ?? []
  }

  const segmentsBySheet = new Map()
  segmentRows.forEach((row) => {
    const sheetId = row.daily_sheet_id
    if (!segmentsBySheet.has(sheetId)) segmentsBySheet.set(sheetId, [])
    segmentsBySheet.get(sheetId).push(rowToSegment(row))
  })

  const sheets = (sheetRows ?? []).map((row) =>
    rowToDailySheet(row, segmentsBySheet.get(row.id) ?? []),
  )

  return { sheets, error: null }
}

export async function saveDailySheet(user, sheet) {
  if (!isSupabaseConfigured || !supabase) {
    return { sheet: null, error: new Error('Supabase is not configured.') }
  }
  const userId = user?.id
  if (!userId) {
    return { sheet: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const row = mapDailySheetToRow(sheet, sheet.cloudUserId || userId)
  const { data, error } = await supabase.from('driver_daily_sheets').insert(row).select().single()
  if (error) return { sheet: null, error }

  const saved = rowToDailySheet(data, sheet.segments ?? [])
  return { sheet: saved, error: null }
}

export async function updateDailySheet(user, sheet, { isAdmin = false } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { sheet: null, error: new Error('Supabase is not configured.') }
  }
  const userId = user?.id
  if (!userId) {
    return { sheet: null, error: new Error('You must be signed in to save to the cloud.') }
  }
  if (!sheet?.cloudId) {
    return { sheet: null, error: new Error('Missing cloud record id for update.') }
  }
  if (!isAdmin && sheet.cloudUserId && sheet.cloudUserId !== userId) {
    return { sheet: null, error: new Error('You can only edit your own daily sheets.') }
  }

  const row = mapDailySheetToRow(sheet, sheet.cloudUserId || userId)
  const { data, error } = await supabase
    .from('driver_daily_sheets')
    .update({
      sheet_date: row.sheet_date,
      truck_vehicle: row.truck_vehicle,
      status: row.status,
      started_at: row.started_at,
      finished_at: row.finished_at,
      timesheet_id: row.timesheet_id,
      sheet_data: row.sheet_data,
      updated_at: row.updated_at,
    })
    .eq('id', sheet.cloudId)
    .select()
    .single()

  if (error) {
    return {
      sheet: null,
      error: new Error(formatCloudSaveError(error) || error.message || 'Cloud update failed.'),
    }
  }

  return { sheet: rowToDailySheet(data, sheet.segments ?? []), error: null }
}

export async function saveSegment(user, segment, dailySheetCloudId) {
  if (!isSupabaseConfigured || !supabase || !dailySheetCloudId) {
    return { segment: null, error: new Error('Cannot save segment without daily sheet.') }
  }

  const row = mapSegmentToRow(segment, dailySheetCloudId)
  const { data, error } = await supabase.from('driver_day_segments').insert(row).select().single()
  if (error) return { segment: null, error }

  return { segment: rowToSegment(data), error: null }
}

export async function updateSegment(user, segment, { isAdmin = false } = {}) {
  if (!isSupabaseConfigured || !supabase || !segment?.cloudId) {
    return { segment: null, error: new Error('Missing segment cloud id.') }
  }

  const row = mapSegmentToRow(segment, segment.dailySheetCloudId)
  const { data, error } = await supabase
    .from('driver_day_segments')
    .update({
      job_name: row.job_name,
      activity_type: row.activity_type,
      started_at: row.started_at,
      ended_at: row.ended_at,
      sort_order: row.sort_order,
      segment_data: row.segment_data,
      updated_at: row.updated_at,
    })
    .eq('id', segment.cloudId)
    .select()
    .single()

  if (error) return { segment: null, error }
  return { segment: rowToSegment(data), error: null }
}

export async function recordDailySheetAudit(sheetCloudId, userId, fieldChanges, reason = '') {
  if (!isSupabaseConfigured || !supabase || !sheetCloudId || !userId) {
    return { error: new Error('Cannot record audit.') }
  }

  const { error } = await supabase.from('driver_daily_sheet_audits').insert({
    daily_sheet_id: sheetCloudId,
    edited_by: userId,
    field_changes: fieldChanges,
    reason: reason?.trim() || null,
  })

  return { error }
}

export async function adminUpdateDailySheet(user, sheet, previousSheet, reason = '') {
  const changes = {}
  const fields = ['sheetDate', 'truckVehicle', 'status', 'startedAt', 'finishedAt']
  fields.forEach((field) => {
    if (String(sheet[field] ?? '') !== String(previousSheet[field] ?? '')) {
      changes[field] = { from: previousSheet[field] ?? '', to: sheet[field] ?? '' }
    }
  })

  const { sheet: updated, error } = await updateDailySheet(user, sheet, { isAdmin: true })
  if (error) return { sheet: null, error }

  if (Object.keys(changes).length > 0) {
    await recordDailySheetAudit(sheet.cloudId, user.id, changes, reason)
    if (sheet.status !== previousSheet.status && sheet.status === SHEET_STATUSES.CORRECTED) {
      await updateDailySheet(user, { ...updated, status: SHEET_STATUSES.CORRECTED }, { isAdmin: true })
    }
  }

  return { sheet: updated, error: null }
}
