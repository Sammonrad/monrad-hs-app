/**
 * Archive / restore soft-archive helpers, plus permanent delete for allowed archived types.
 * Form tables may not have an `archived` column yet — cloud update errors are returned.
 */

import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { SSSP_STATUS } from '../../constants/ssspStatuses.js'
import { ARCHIVE_RECORD_TYPES, isArchived } from './archiveFilter.js'
import { formatCloudSaveError } from './cloudSyncStatus.js'
import { persistSavedRecords, loadSavedRecords } from './recordsStorage.js'
import { persistActions, loadActions, normalizeAction } from './actionsStorage.js'
import {
  persistVisitorRecords,
  loadVisitorRecords,
  normalizeVisitorRecord,
} from './visitorSignInStorage.js'
import { persistMeetings, loadMeetings, normalizeMeeting } from './generalMeetingStorage.js'
import {
  updateEquipmentRecord,
  persistLocalEquipmentRecords,
  loadLocalEquipmentRecords,
} from './equipmentCloudStorage.js'
import { updateSsspRecord } from './ssspCloudStorage.js'
import { appendChangeLog, syncIndexedFieldsFromRecordData } from './ssspStorage.js'
import { updateActionRecord } from './actionCloudStorage.js'
import { updateGeneralMeetingRecord } from './generalMeetingCloudStorage.js'
import { isAdminProfile } from './userProfileStorage.js'

export const FORM_ARCHIVE_TABLES = {
  [ARCHIVE_RECORD_TYPES.JOB_START]: 'job_start_records',
  [ARCHIVE_RECORD_TYPES.PRE_START]: 'machine_prestart_records',
  [ARCHIVE_RECORD_TYPES.TOOLBOX]: 'toolbox_meeting_records',
  [ARCHIVE_RECORD_TYPES.INCIDENT]: 'incident_near_miss_records',
  [ARCHIVE_RECORD_TYPES.TIMESHEET]: 'timesheet_records',
}

/** Cloud tables eligible for hard delete (subset of archiveable types). */
export const PERMANENT_DELETE_TABLES = {
  [ARCHIVE_RECORD_TYPES.JOB_START]: 'job_start_records',
  [ARCHIVE_RECORD_TYPES.PRE_START]: 'machine_prestart_records',
  [ARCHIVE_RECORD_TYPES.TOOLBOX]: 'toolbox_meeting_records',
  [ARCHIVE_RECORD_TYPES.TIMESHEET]: 'timesheet_records',
  [ARCHIVE_RECORD_TYPES.ACTION]: 'action_register_records',
  [ARCHIVE_RECORD_TYPES.GENERAL_MEETING]: 'hs_general_meeting_records',
}

const PERMANENT_DELETE_TYPES = new Set(Object.keys(PERMANENT_DELETE_TABLES))

function patchLocalSavedRecord(recordId, cloudId, patch) {
  const records = loadSavedRecords()
  let changed = false
  const next = records.map((item) => {
    const match =
      (recordId && item.id === recordId) || (cloudId && item.cloudId === cloudId)
    if (!match) return item
    changed = true
    return { ...item, ...patch }
  })
  if (changed) persistSavedRecords(next)
  return next
}

function patchLocalActions(recordId, cloudId, patch) {
  const actions = loadActions()
  let changed = false
  const next = actions.map((item) => {
    const match =
      (recordId && item.id === recordId) || (cloudId && item.cloudId === cloudId)
    if (!match) return item
    changed = true
    return normalizeAction({ ...item, ...patch })
  })
  if (changed) persistActions(next)
  return next
}

function patchLocalVisitors(recordId, cloudId, patch) {
  const records = loadVisitorRecords()
  let changed = false
  const next = records.map((item) => {
    const match =
      (recordId && item.id === recordId) || (cloudId && item.cloudId === cloudId)
    if (!match) return item
    changed = true
    return normalizeVisitorRecord({ ...item, ...patch })
  })
  if (changed) persistVisitorRecords(next)
  return next
}

function patchLocalMeetings(recordId, cloudId, patch) {
  const meetings = loadMeetings()
  let changed = false
  const next = meetings.map((item) => {
    const match =
      (recordId && item.id === recordId) || (cloudId && item.cloudId === cloudId)
    if (!match) return item
    changed = true
    return normalizeMeeting({ ...item, ...patch })
  })
  if (changed) persistMeetings(next)
  return next
}

function patchLocalEquipment(recordId, cloudId, patch) {
  const records = loadLocalEquipmentRecords()
  let changed = false
  const next = records.map((item) => {
    const match =
      (recordId && item.id === recordId) || (cloudId && item.cloudId === cloudId)
    if (!match) return item
    changed = true
    return { ...item, ...patch }
  })
  if (changed) persistLocalEquipmentRecords(next)
  return next
}

async function setBooleanCloudArchived(table, cloudId, archived) {
  if (!isSupabaseConfigured || !supabase) {
    return { error: new Error('Supabase is not configured.') }
  }
  if (!cloudId) {
    return { error: null }
  }

  const { data, error } = await supabase
    .from(table)
    .update({
      archived: Boolean(archived),
      updated_at: new Date().toISOString(),
    })
    .eq('id', cloudId)
    .select()
    .single()

  if (error) return { error }
  return { error: null, row: data }
}

async function restoreBooleanCloudColumn(table, cloudId) {
  return setBooleanCloudArchived(table, cloudId, false)
}

/**
 * Soft-archive a record. Cloud rows must succeed in Supabase before local is patched.
 * Local-only records (no cloudId) archive on-device and appear as Local in Archived Records.
 *
 * @param {string} type ARCHIVE_RECORD_TYPES value
 * @param {object} record
 * @param {object} user
 * @param {object} profile
 * @param {{ preparedByName?: string }} [options]
 * @returns {Promise<{ record: object|null, error: Error|null, localOnly?: boolean }>}
 */
export async function archiveRecord(type, record, user, profile, options = {}) {
  if (!isAdminProfile(profile)) {
    return { record: null, error: new Error('Only admins can archive records.') }
  }
  if (!record) {
    return { record: null, error: new Error('No record to archive.') }
  }

  const cloudId = record.cloudId ?? null
  const recordId = record.id ?? null

  try {
    if (type === ARCHIVE_RECORD_TYPES.EQUIPMENT || type === 'equipment') {
      const next = { ...record, archived: true }
      if (cloudId) {
        const { record: saved, error } = await updateEquipmentRecord(user, next)
        if (error || !saved) {
          return {
            record: null,
            error: new Error(formatCloudSaveError(error) || 'Cloud archive failed.'),
          }
        }
        patchLocalEquipment(recordId, cloudId, { archived: true })
        return { record: saved, error: null }
      }
      patchLocalEquipment(recordId, null, { archived: true })
      return { record: next, error: null, localOnly: true }
    }

    if (type === ARCHIVE_RECORD_TYPES.SSSP || type === 'sssp') {
      if (!cloudId) {
        return { record: null, error: new Error('SSSP archive requires a cloud record.') }
      }
      const now = new Date().toISOString()
      let next = syncIndexedFieldsFromRecordData({
        ...record,
        status: SSSP_STATUS.ARCHIVED,
        archivedAt: now,
        updatedAt: now,
      })
      next = appendChangeLog(next, {
        action: 'archived',
        detail: 'SSSP archived from record page',
        userName: options.preparedByName || user?.email || 'Admin',
      })
      const { record: saved, error } = await updateSsspRecord(user, next)
      if (error || !saved) {
        return { record: null, error: new Error(formatCloudSaveError(error) || 'Cloud archive failed.') }
      }
      return { record: saved, error: null }
    }

    if (type === ARCHIVE_RECORD_TYPES.ACTION || type === 'action') {
      const next = normalizeAction({ ...record, archived: true })
      if (cloudId) {
        const { record: saved, error } = await updateActionRecord(user, next)
        if (error || !saved) {
          return {
            record: null,
            error: new Error(formatCloudSaveError(error) || 'Cloud archive failed.'),
          }
        }
        patchLocalActions(recordId, cloudId, { archived: true })
        return { record: saved ?? next, error: null }
      }
      patchLocalActions(recordId, null, { archived: true })
      return { record: next, error: null, localOnly: true }
    }

    if (type === ARCHIVE_RECORD_TYPES.VISITOR || type === 'visitor') {
      const next = normalizeVisitorRecord({ ...record, archived: true })
      if (cloudId) {
        const { error } = await setBooleanCloudArchived('visitor_sign_in_records', cloudId, true)
        if (error) {
          return {
            record: null,
            error: new Error(formatCloudSaveError(error) || 'Cloud archive failed.'),
          }
        }
        patchLocalVisitors(recordId, cloudId, { archived: true })
        return { record: next, error: null }
      }
      patchLocalVisitors(recordId, null, { archived: true })
      return { record: next, error: null, localOnly: true }
    }

    if (type === ARCHIVE_RECORD_TYPES.GENERAL_MEETING || type === 'general-meeting') {
      const next = normalizeMeeting({ ...record, archived: true })
      if (cloudId) {
        const { record: saved, error } = await updateGeneralMeetingRecord(user, next)
        if (error || !saved) {
          return {
            record: null,
            error: new Error(formatCloudSaveError(error) || 'Cloud archive failed.'),
          }
        }
        patchLocalMeetings(recordId, cloudId, { archived: true })
        return { record: saved ?? next, error: null }
      }
      patchLocalMeetings(recordId, null, { archived: true })
      return { record: next, error: null, localOnly: true }
    }

    const table = FORM_ARCHIVE_TABLES[type]
    if (table) {
      const next = { ...record, archived: true }
      if (cloudId) {
        const { error } = await setBooleanCloudArchived(table, cloudId, true)
        if (error) {
          return {
            record: null,
            error: new Error(formatCloudSaveError(error) || 'Cloud archive failed.'),
          }
        }
        patchLocalSavedRecord(recordId, cloudId, { archived: true })
        return { record: next, error: null }
      }
      patchLocalSavedRecord(recordId, null, { archived: true })
      return { record: next, error: null, localOnly: true }
    }

    return { record: null, error: new Error(`Unsupported record type: ${type}`) }
  } catch (error) {
    return {
      record: null,
      error: new Error(formatCloudSaveError(error) || error?.message || 'Archive failed.'),
    }
  }
}

/**
 * Soft-restore an archived record. Cloud rows must succeed in Supabase before local is patched.
 * Local-only records (no cloudId) restore on-device and return localOnly: true.
 *
 * @param {string} type ARCHIVE_RECORD_TYPES value
 * @param {object} record
 * @param {object} user
 * @param {object} profile
 * @param {{ preparedByName?: string }} [options]
 * @returns {Promise<{ record: object|null, error: Error|null, localOnly?: boolean }>}
 */
export async function restoreArchivedRecord(type, record, user, profile, options = {}) {
  if (!isAdminProfile(profile)) {
    return { record: null, error: new Error('Admin access is required.') }
  }
  if (!record) {
    return { record: null, error: new Error('No record to restore.') }
  }

  const cloudId = record.cloudId ?? null
  const recordId = record.id ?? null

  try {
    if (type === ARCHIVE_RECORD_TYPES.EQUIPMENT || type === 'equipment') {
      const next = { ...record, archived: false }
      if (cloudId) {
        const { record: saved, error } = await updateEquipmentRecord(user, next)
        if (error || !saved) {
          return {
            record: null,
            error: new Error(formatCloudSaveError(error) || 'Cloud restore failed.'),
          }
        }
        patchLocalEquipment(recordId, cloudId, { archived: false })
        return { record: saved, error: null }
      }
      patchLocalEquipment(recordId, null, { archived: false })
      return { record: next, error: null, localOnly: true }
    }

    if (type === ARCHIVE_RECORD_TYPES.SSSP || type === 'sssp') {
      if (!cloudId) {
        return { record: null, error: new Error('SSSP restore requires a cloud record.') }
      }
      const now = new Date().toISOString()
      let next = syncIndexedFieldsFromRecordData({
        ...record,
        status: SSSP_STATUS.DRAFT,
        archivedAt: null,
        updatedAt: now,
      })
      next = appendChangeLog(next, {
        action: 'reactivated',
        detail: 'SSSP restored from Archived Records',
        userName: options.preparedByName || user?.email || 'Admin',
      })
      const { record: saved, error } = await updateSsspRecord(user, next)
      if (error || !saved) {
        return {
          record: null,
          error: new Error(formatCloudSaveError(error) || 'Cloud restore failed.'),
        }
      }
      return { record: saved, error: null }
    }

    if (type === ARCHIVE_RECORD_TYPES.ACTION || type === 'action') {
      const next = normalizeAction({ ...record, archived: false })
      if (cloudId) {
        const { record: saved, error } = await updateActionRecord(user, next)
        if (error || !saved) {
          return {
            record: null,
            error: new Error(formatCloudSaveError(error) || 'Cloud restore failed.'),
          }
        }
        patchLocalActions(recordId, cloudId, { archived: false })
        return { record: saved ?? next, error: null }
      }
      patchLocalActions(recordId, null, { archived: false })
      return { record: next, error: null, localOnly: true }
    }

    if (type === ARCHIVE_RECORD_TYPES.VISITOR || type === 'visitor') {
      const next = normalizeVisitorRecord({ ...record, archived: false })
      if (cloudId) {
        const { error } = await restoreBooleanCloudColumn('visitor_sign_in_records', cloudId)
        if (error) {
          return {
            record: null,
            error: new Error(formatCloudSaveError(error) || 'Cloud restore failed.'),
          }
        }
        patchLocalVisitors(recordId, cloudId, { archived: false })
        return { record: next, error: null }
      }
      patchLocalVisitors(recordId, null, { archived: false })
      return { record: next, error: null, localOnly: true }
    }

    if (type === ARCHIVE_RECORD_TYPES.GENERAL_MEETING || type === 'general-meeting') {
      const next = normalizeMeeting({ ...record, archived: false })
      if (cloudId) {
        const { record: saved, error } = await updateGeneralMeetingRecord(user, next)
        if (error || !saved) {
          return {
            record: null,
            error: new Error(formatCloudSaveError(error) || 'Cloud restore failed.'),
          }
        }
        patchLocalMeetings(recordId, cloudId, { archived: false })
        return { record: saved ?? next, error: null }
      }
      patchLocalMeetings(recordId, null, { archived: false })
      return { record: next, error: null, localOnly: true }
    }

    const table = FORM_ARCHIVE_TABLES[type]
    if (table) {
      const next = { ...record, archived: false }
      if (cloudId) {
        const { error } = await restoreBooleanCloudColumn(table, cloudId)
        if (error) {
          return {
            record: null,
            error: new Error(formatCloudSaveError(error) || 'Cloud restore failed.'),
          }
        }
        patchLocalSavedRecord(recordId, cloudId, { archived: false })
        return { record: next, error: null }
      }
      patchLocalSavedRecord(recordId, null, { archived: false })
      return { record: next, error: null, localOnly: true }
    }

    return { record: null, error: new Error(`Unsupported record type: ${type}`) }
  } catch (error) {
    return {
      record: null,
      error: new Error(formatCloudSaveError(error) || error?.message || 'Restore failed.'),
    }
  }
}

/** Match helper for React list updates after archive/restore. */
export function matchesArchiveTarget(item, target) {
  if (!item || !target) return false
  if (target.cloudId && item.cloudId === target.cloudId) return true
  if (target.id && item.id === target.id) return true
  return false
}

/**
 * Whether Permanently Delete may be offered for this archived row.
 * Protected types (incident, visitor, SSSP, equipment, completed GM, etc.) always return false.
 *
 * @param {string} type ARCHIVE_RECORD_TYPES value
 * @param {object} record
 * @returns {boolean}
 */
export function canPermanentlyDelete(type, record) {
  if (!record || !PERMANENT_DELETE_TYPES.has(type)) return false
  if (!isArchived(record, type)) return false

  if (type === ARCHIVE_RECORD_TYPES.GENERAL_MEETING) {
    return String(record.status || '').toLowerCase() === 'draft'
  }

  return true
}

function removeLocalSavedRecord(recordId, cloudId) {
  const records = loadSavedRecords()
  const next = records.filter(
    (item) =>
      !((recordId && item.id === recordId) || (cloudId && item.cloudId === cloudId)),
  )
  if (next.length !== records.length) persistSavedRecords(next)
  return next
}

function removeLocalAction(recordId, cloudId) {
  const actions = loadActions()
  const next = actions.filter(
    (item) =>
      !((recordId && item.id === recordId) || (cloudId && item.cloudId === cloudId)),
  )
  if (next.length !== actions.length) persistActions(next)
  return next
}

function removeLocalMeeting(recordId, cloudId) {
  const meetings = loadMeetings()
  const next = meetings.filter(
    (item) =>
      !((recordId && item.id === recordId) || (cloudId && item.cloudId === cloudId)),
  )
  if (next.length !== meetings.length) persistMeetings(next)
  return next
}

async function deleteCloudRow(table, cloudId) {
  if (!isSupabaseConfigured || !supabase) {
    return { error: new Error('Supabase is not configured.') }
  }
  if (!cloudId) {
    return { error: new Error('Missing cloud record id.') }
  }

  const { error } = await supabase.from(table).delete().eq('id', cloudId)
  if (error) return { error }
  return { error: null }
}

/**
 * Permanently delete an allowed archived record.
 * Cloud rows must succeed in Supabase before local copies are removed.
 * Local-only rows (no cloudId) are removed from device storage only.
 *
 * @param {string} type ARCHIVE_RECORD_TYPES value
 * @param {object} record
 * @param {object} user
 * @param {object} profile
 * @returns {Promise<{ ok: boolean, error: Error|null, localOnly?: boolean }>}
 */
export async function permanentlyDeleteArchivedRecord(type, record, user, profile) {
  if (!isAdminProfile(profile)) {
    return { ok: false, error: new Error('Admin access is required.') }
  }
  if (!user?.id) {
    return { ok: false, error: new Error('You must be signed in to delete records.') }
  }
  if (!canPermanentlyDelete(type, record)) {
    return {
      ok: false,
      error: new Error('This record type cannot be permanently deleted.'),
    }
  }

  const cloudId = record.cloudId ?? null
  const recordId = record.id ?? null
  const table = PERMANENT_DELETE_TABLES[type]

  try {
    if (cloudId) {
      const { error } = await deleteCloudRow(table, cloudId)
      if (error) {
        return {
          ok: false,
          error: new Error(formatCloudSaveError(error) || 'Cloud delete failed.'),
        }
      }
    }

    if (
      type === ARCHIVE_RECORD_TYPES.JOB_START ||
      type === ARCHIVE_RECORD_TYPES.PRE_START ||
      type === ARCHIVE_RECORD_TYPES.TOOLBOX ||
      type === ARCHIVE_RECORD_TYPES.TIMESHEET
    ) {
      removeLocalSavedRecord(recordId, cloudId)
    } else if (type === ARCHIVE_RECORD_TYPES.ACTION) {
      removeLocalAction(recordId, cloudId)
    } else if (type === ARCHIVE_RECORD_TYPES.GENERAL_MEETING) {
      removeLocalMeeting(recordId, cloudId)
    }

    return { ok: true, error: null, localOnly: !cloudId }
  } catch (error) {
    return {
      ok: false,
      error: new Error(formatCloudSaveError(error) || error?.message || 'Delete failed.'),
    }
  }
}
