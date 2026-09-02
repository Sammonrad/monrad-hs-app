import { DRIVER_LOADS_STORAGE_KEY } from '../../constants/storageKeys.js'
import { createRecordId } from '../ids.js'
import { parseWeightTonnes, applyDuplicateFlagToLoad, normalizeTicketNumberKey } from '../driverLoads.js'
import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import {
  SYNC_STATUS,
  withSyncStatus,
  formatCloudSaveError,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
} from './cloudSyncStatus.js'
import { deleteDriverTicketImage } from './driverLoadsImageStorage.js'

export const DRIVER_LOAD_TICKETS_BUCKET = 'driver-load-tickets'

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

export function normalizeDriverLoad(record) {
  if (!record || typeof record !== 'object') {
    return null
  }
  return {
    id: record.id || createRecordId(),
    cloudId: record.cloudId ?? null,
    cloudUserId: record.cloudUserId ?? null,
    timesheetLocalId: record.timesheetLocalId ?? '',
    timesheetCloudId: record.timesheetCloudId ?? null,
    dailySheetId: record.dailySheetId ?? '',
    dailySheetCloudId: record.dailySheetCloudId ?? null,
    segmentId: record.segmentId ?? '',
    segmentCloudId: record.segmentCloudId ?? null,
    loadDate: record.loadDate ?? '',
    driverName: record.driverName ?? '',
    jobProjectName: record.jobProjectName ?? '',
    truckVehicle: record.truckVehicle ?? '',
    quarrySupplier: record.quarrySupplier ?? '',
    materialProduct: record.materialProduct ?? '',
    deliveryDestination: record.deliveryDestination ?? '',
    ticketNumber: record.ticketNumber ?? '',
    grossWeightTonnes:
      record.grossWeightTonnes != null && record.grossWeightTonnes !== ''
        ? String(record.grossWeightTonnes)
        : '',
    tareWeightTonnes:
      record.tareWeightTonnes != null && record.tareWeightTonnes !== ''
        ? String(record.tareWeightTonnes)
        : '',
    netWeightTonnes:
      record.netWeightTonnes != null && record.netWeightTonnes !== ''
        ? String(record.netWeightTonnes)
        : '',
    netWeightOverridden: Boolean(record.netWeightOverridden),
    tripStartTime: record.tripStartTime ?? '',
    deliveryFinishTime: record.deliveryFinishTime ?? '',
    notes: record.notes ?? '',
    ticketImagePath: record.ticketImagePath ?? '',
    ticketImagePreviewUrl: record.ticketImagePreviewUrl ?? '',
    duplicateTicketFlag: Boolean(record.duplicateTicketFlag),
    createdAt: record.createdAt ?? new Date().toISOString(),
    updatedAt: record.updatedAt ?? null,
    syncStatus: record.syncStatus ?? null,
    storageSource: record.storageSource ?? (record.cloudId ? 'cloud' : 'local'),
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

export function mapDriverLoadToRow(record, userId) {
  const normalized = normalizeDriverLoad(record)
  const loadData = {
    ...normalized,
    syncStatus: normalized.syncStatus ?? SYNC_STATUS.CLOUD,
  }

  return {
    user_id: userId,
    timesheet_id: blankToNull(normalized.timesheetCloudId),
    timesheet_local_id: blankToNull(normalized.timesheetLocalId),
    daily_sheet_id: blankToNull(normalized.dailySheetCloudId),
    segment_id: blankToNull(normalized.segmentCloudId),
    load_date: blankToNull(normalized.loadDate),
    driver_name: blankToNull(normalized.driverName),
    job_name: blankToNull(normalized.jobProjectName),
    truck_vehicle: blankToNull(normalized.truckVehicle),
    quarry_supplier: blankToNull(normalized.quarrySupplier),
    material_product: blankToNull(normalized.materialProduct),
    delivery_destination: blankToNull(normalized.deliveryDestination),
    ticket_number: blankToNull(normalized.ticketNumber),
    gross_weight_tonnes: parseWeightTonnes(normalized.grossWeightTonnes),
    tare_weight_tonnes: parseWeightTonnes(normalized.tareWeightTonnes),
    net_weight_tonnes: parseWeightTonnes(normalized.netWeightTonnes),
    trip_start_time: blankToNull(normalized.tripStartTime),
    delivery_finish_time: blankToNull(normalized.deliveryFinishTime),
    notes: blankToNull(normalized.notes),
    ticket_image_path: blankToNull(normalized.ticketImagePath),
    duplicate_ticket_flag: Boolean(normalized.duplicateTicketFlag),
    load_data: loadData,
    updated_at: new Date().toISOString(),
  }
}

export function rowToDriverLoad(row) {
  const data = row.load_data
  const base =
    data && typeof data === 'object'
      ? data
      : {
          id: row.id,
          loadDate: row.load_date ?? '',
          driverName: row.driver_name ?? '',
          jobProjectName: row.job_name ?? '',
          truckVehicle: row.truck_vehicle ?? '',
          quarrySupplier: row.quarry_supplier ?? '',
          materialProduct: row.material_product ?? '',
          deliveryDestination: row.delivery_destination ?? '',
          ticketNumber: row.ticket_number ?? '',
          grossWeightTonnes: row.gross_weight_tonnes != null ? String(row.gross_weight_tonnes) : '',
          tareWeightTonnes: row.tare_weight_tonnes != null ? String(row.tare_weight_tonnes) : '',
          netWeightTonnes: row.net_weight_tonnes != null ? String(row.net_weight_tonnes) : '',
          tripStartTime: row.trip_start_time ?? '',
          deliveryFinishTime: row.delivery_finish_time ?? '',
          notes: row.notes ?? '',
          ticketImagePath: row.ticket_image_path ?? '',
          duplicateTicketFlag: Boolean(row.duplicate_ticket_flag),
          timesheetCloudId: row.timesheet_id ?? null,
          timesheetLocalId: row.timesheet_local_id ?? '',
          dailySheetCloudId: row.daily_sheet_id ?? null,
          segmentCloudId: row.segment_id ?? null,
          createdAt: row.created_at ?? new Date().toISOString(),
          updatedAt: row.updated_at ?? null,
        }

  return withSyncStatus(
    normalizeDriverLoad(
      withCloudOwnership(
        {
          ...base,
          id: base.id || row.id,
          timesheetCloudId: row.timesheet_id ?? base.timesheetCloudId ?? null,
          timesheetLocalId: row.timesheet_local_id ?? base.timesheetLocalId ?? '',
          dailySheetCloudId: row.daily_sheet_id ?? base.dailySheetCloudId ?? null,
          segmentCloudId: row.segment_id ?? base.segmentCloudId ?? null,
          createdAt: base.createdAt || row.created_at,
          updatedAt: row.updated_at ?? base.updatedAt,
        },
        row,
      ),
    ),
  )
}

export function loadLocalDriverLoads() {
  try {
    const raw = localStorage.getItem(DRIVER_LOADS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeDriverLoad).filter(Boolean)
  } catch {
    return []
  }
}

export function persistLocalDriverLoads(loads) {
  try {
    localStorage.setItem(DRIVER_LOADS_STORAGE_KEY, JSON.stringify(loads))
    return true
  } catch {
    return false
  }
}

function mergeDriverLoads(localLoads, cloudLoads) {
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
    return entry
  }

  localLoads.forEach((r) => register({ ...r, storageSource: r.cloudId ? 'both' : 'local' }, 'local'))
  cloudLoads.forEach((cloudRecord) => {
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
    const localId = cloudRecord.id
    if (localId && byId.has(localId)) {
      const existing = byId.get(localId)
      const merged = withSyncStatus({
        ...existing,
        ...cloudRecord,
        cloudId: cloudId ?? existing.cloudId,
        storageSource: 'both',
        syncStatus: SYNC_STATUS.CLOUD,
      })
      byId.set(localId, merged)
      if (merged.cloudId) byCloudId.set(merged.cloudId, merged)
      return
    }
    register(cloudRecord, 'cloud')
  })

  return [...byId.values()].sort((a, b) => {
    const dateCmp = (b.loadDate || '').localeCompare(a.loadDate || '')
    if (dateCmp !== 0) return dateCmp
    return (b.createdAt || '').localeCompare(a.createdAt || '')
  })
}

export function getMergedDriverLoads(localLoads, cloudLoads) {
  return mergeDriverLoads(localLoads ?? [], cloudLoads ?? [])
}

export function resolveDriverLoadOwnerId(load, actingUser, timesheetOwnerId = null) {
  return (
    timesheetOwnerId ||
    load?.cloudUserId ||
    actingUser?.id ||
    null
  )
}

/**
 * Persist duplicate_ticket_flag for all loads sharing a ticket number (company-wide).
 */
export async function syncDuplicateFlagsForTicket(ticketNumber) {
  if (!isSupabaseConfigured || !supabase) {
    return { updated: 0, error: null }
  }

  const key = normalizeTicketNumberKey(ticketNumber)
  if (!key) return { updated: 0, error: null }

  const { data, error } = await supabase.from('driver_loads').select('id, ticket_number')
  if (error) return { updated: 0, error }

  const matching = (data ?? []).filter(
    (row) => normalizeTicketNumberKey(row.ticket_number) === key,
  )
  const isDuplicate = matching.length > 1
  const now = new Date().toISOString()

  let updated = 0
  for (const row of matching) {
    const { error: updateError } = await supabase
      .from('driver_loads')
      .update({ duplicate_ticket_flag: isDuplicate, updated_at: now })
      .eq('id', row.id)
    if (!updateError) updated += 1
  }

  return { updated, error: null, isDuplicate, matchingIds: matching.map((r) => r.id) }
}

export async function prepareDriverLoadForSave(load, actingUser, { timesheetOwnerId = null, peerLoads = [] } = {}) {
  const ownerUserId = resolveDriverLoadOwnerId(load, actingUser, timesheetOwnerId)
  const withFlag = applyDuplicateFlagToLoad(load, peerLoads.length ? peerLoads : [load])
  return { load: { ...withFlag, cloudUserId: ownerUserId }, ownerUserId }
}

export async function fetchDriverLoads(userId, { isAdmin = false } = {}) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { loads: [], error: null }
  }

  let query = supabase
    .from('driver_loads')
    .select('*')
    .order('load_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query
  if (error) return { loads: [], error }

  return { loads: (data ?? []).map(rowToDriverLoad), error: null }
}

export async function saveDriverLoad(user, load, { ownerUserId = null, timesheetOwnerId = null } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { load: null, error: new Error('Supabase is not configured.') }
  }
  const actingUserId = user?.id
  if (!actingUserId) {
    return { load: null, error: new Error('You must be signed in to save to the cloud.') }
  }

  const resolvedOwnerId = ownerUserId || resolveDriverLoadOwnerId(load, user, timesheetOwnerId)
  if (!resolvedOwnerId) {
    return { load: null, error: new Error('Missing driver ownership for this load.') }
  }

  const row = mapDriverLoadToRow({ ...load, cloudUserId: resolvedOwnerId }, resolvedOwnerId)
  const { data, error } = await supabase.from('driver_loads').insert(row).select().single()
  if (error) return { load: null, error }

  const saved = rowToDriverLoad(data)
  await syncDuplicateFlagsForTicket(load.ticketNumber)

  return { load: saved, error: null }
}

export async function updateDriverLoad(user, load, { isAdmin = false, previousTicketNumber = null } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { load: null, error: new Error('Supabase is not configured.') }
  }
  const userId = user?.id
  if (!userId) {
    return { load: null, error: new Error('You must be signed in to save to the cloud.') }
  }
  if (!load?.cloudId) {
    return { load: null, error: new Error('Missing cloud record id for update.') }
  }
  if (!isAdmin && load.cloudUserId && load.cloudUserId !== userId) {
    return { load: null, error: new Error('You can only edit your own loads.') }
  }

  const row = mapDriverLoadToRow(load, load.cloudUserId || userId)
  const { data, error } = await supabase
    .from('driver_loads')
    .update({
      timesheet_id: row.timesheet_id,
      timesheet_local_id: row.timesheet_local_id,
      daily_sheet_id: row.daily_sheet_id,
      segment_id: row.segment_id,
      load_date: row.load_date,
      driver_name: row.driver_name,
      job_name: row.job_name,
      truck_vehicle: row.truck_vehicle,
      quarry_supplier: row.quarry_supplier,
      material_product: row.material_product,
      delivery_destination: row.delivery_destination,
      ticket_number: row.ticket_number,
      gross_weight_tonnes: row.gross_weight_tonnes,
      tare_weight_tonnes: row.tare_weight_tonnes,
      net_weight_tonnes: row.net_weight_tonnes,
      trip_start_time: row.trip_start_time,
      delivery_finish_time: row.delivery_finish_time,
      notes: row.notes,
      ticket_image_path: row.ticket_image_path,
      duplicate_ticket_flag: row.duplicate_ticket_flag,
      load_data: row.load_data,
      updated_at: row.updated_at,
    })
    .eq('id', load.cloudId)
    .select()
    .single()

  if (error) {
    return {
      load: null,
      error: new Error(formatCloudSaveError(error) || error.message || 'Cloud update failed.'),
    }
  }

  const updated = rowToDriverLoad(data)
  const ticketNumbers = new Set(
    [load.ticketNumber, previousTicketNumber].filter((t) => t?.trim()),
  )
  for (const ticket of ticketNumbers) {
    await syncDuplicateFlagsForTicket(ticket)
  }

  return { load: updated, error: null }
}

export async function deleteDriverLoad(user, load, { isAdmin = false } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: new Error('Supabase is not configured.') }
  }
  const userId = user?.id
  if (!userId) {
    return { ok: false, error: new Error('You must be signed in to delete loads.') }
  }
  if (!load?.cloudId) {
    return { ok: true, error: null, localOnly: true }
  }
  if (!isAdmin && load.cloudUserId && load.cloudUserId !== userId) {
    return { ok: false, error: new Error('You can only delete your own loads.') }
  }

  const imagePath = load.ticketImagePath || null
  const ticketNumber = load.ticketNumber

  const { error } = await supabase.from('driver_loads').delete().eq('id', load.cloudId)
  if (error) {
    return {
      ok: false,
      error: new Error(formatCloudSaveError(error) || error.message || 'Cloud delete failed.'),
    }
  }

  if (ticketNumber?.trim()) {
    await syncDuplicateFlagsForTicket(ticketNumber)
  }

  if (!imagePath) {
    return { ok: true, error: null, localOnly: false, imageDeleteFailed: false }
  }

  const { ok: imageOk, error: imageError } = await deleteDriverTicketImage(imagePath)
  if (!imageOk) {
    console.warn('Driver load deleted but ticket image orphaned:', imagePath, imageError)
    return {
      ok: true,
      error: new Error(
        'Load removed from records, but the ticket photo could not be deleted from storage. Please contact an administrator.',
      ),
      localOnly: false,
      imageDeleteFailed: true,
      orphanedImagePath: imagePath,
    }
  }

  return { ok: true, error: null, localOnly: false, imageDeleteFailed: false }
}

export async function linkLoadsToTimesheet(
  user,
  { timesheetLocalId, timesheetCloudId, timesheetOwnerId = null },
) {
  if (!isSupabaseConfigured || !supabase || !user?.id || !timesheetCloudId) {
    return { updated: 0, error: null }
  }

  if (!timesheetLocalId) {
    return { updated: 0, error: null }
  }

  const ownerId = timesheetOwnerId || user.id

  const { data, error } = await supabase
    .from('driver_loads')
    .update({
      timesheet_id: timesheetCloudId,
      timesheet_local_id: timesheetLocalId,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', ownerId)
    .eq('timesheet_local_id', timesheetLocalId)
    .select('id')

  if (error) return { updated: 0, error }
  return { updated: data?.length ?? 0, error: null }
}

export async function recordDriverLoadAudit(loadCloudId, userId, fieldChanges, reason = '') {
  if (!isSupabaseConfigured || !supabase || !loadCloudId || !userId) {
    return { error: new Error('Cannot record audit.') }
  }

  const { error } = await supabase.from('driver_load_audits').insert({
    driver_load_id: loadCloudId,
    edited_by: userId,
    field_changes: fieldChanges,
    reason: reason?.trim() || null,
  })

  return { error }
}

export async function adminUpdateDriverLoad(user, load, previousLoad, reason = '') {
  const changes = {}
  const fields = [
    'loadDate',
    'driverName',
    'jobProjectName',
    'truckVehicle',
    'quarrySupplier',
    'materialProduct',
    'deliveryDestination',
    'ticketNumber',
    'grossWeightTonnes',
    'tareWeightTonnes',
    'netWeightTonnes',
    'tripStartTime',
    'deliveryFinishTime',
    'notes',
    'ticketImagePath',
    'duplicateTicketFlag',
  ]
  fields.forEach((field) => {
    if (String(load[field] ?? '') !== String(previousLoad[field] ?? '')) {
      changes[field] = { from: previousLoad[field] ?? '', to: load[field] ?? '' }
    }
  })

  const { load: updated, error } = await updateDriverLoad(user, load, {
    isAdmin: true,
    previousTicketNumber: previousLoad?.ticketNumber ?? null,
  })
  if (error) return { load: null, error }

  if (Object.keys(changes).length > 0) {
    await recordDriverLoadAudit(load.cloudId, user.id, changes, reason)
  }

  return { load: updated, error: null }
}
