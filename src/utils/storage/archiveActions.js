/**
 * Restore archived records (soft-unarchive). No permanent delete.
 * Form tables may not have an `archived` column yet — cloud update errors are returned.
 */

import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { SSSP_STATUS } from '../../constants/ssspStatuses.js'
import { ARCHIVE_RECORD_TYPES } from './archiveFilter.js'
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

export const FORM_ARCHIVE_TABLES = {
  [ARCHIVE_RECORD_TYPES.JOB_START]: 'job_start_records',
  [ARCHIVE_RECORD_TYPES.PRE_START]: 'machine_prestart_records',
  [ARCHIVE_RECORD_TYPES.TOOLBOX]: 'toolbox_meeting_records',
  [ARCHIVE_RECORD_TYPES.INCIDENT]: 'incident_near_miss_records',
  [ARCHIVE_RECORD_TYPES.TIMESHEET]: 'timesheet_records',
}

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

async function restoreBooleanCloudColumn(table, cloudId) {
  if (!isSupabaseConfigured || !supabase) {
    return { error: new Error('Supabase is not configured.') }
  }
  if (!cloudId) {
    return { error: null }
  }

  const { data, error } = await supabase
    .from(table)
    .update({
      archived: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cloudId)
    .select()
    .single()

  if (error) return { error }
  return { error: null, row: data }
}

/**
 * @param {string} type ARCHIVE_RECORD_TYPES value
 * @param {object} record
 * @param {object} user
 * @param {{ preparedByName?: string }} [options]
 * @returns {Promise<{ record: object|null, error: Error|null, localOnly?: boolean }>}
 */
export async function restoreArchivedRecord(type, record, user, options = {}) {
  if (!record) {
    return { record: null, error: new Error('No record to restore.') }
  }

  const cloudId = record.cloudId ?? null
  const recordId = record.id ?? null

  try {
    if (type === ARCHIVE_RECORD_TYPES.EQUIPMENT || type === 'equipment') {
      const next = { ...record, archived: false }
      const { record: saved, error } = await updateEquipmentRecord(user, next)
      patchLocalEquipment(recordId, cloudId, { archived: false })
      if (error) {
        return {
          record: { ...next, archived: false },
          error: new Error(formatCloudSaveError(error)),
          localOnly: true,
        }
      }
      return { record: saved ?? next, error: null }
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
      if (error) {
        return { record: null, error: new Error(formatCloudSaveError(error)) }
      }
      return { record: saved, error: null }
    }

    if (type === ARCHIVE_RECORD_TYPES.ACTION || type === 'action') {
      const next = normalizeAction({ ...record, archived: false })
      if (cloudId) {
        const { record: saved, error } = await updateActionRecord(user, next)
        patchLocalActions(recordId, cloudId, { archived: false })
        if (error) {
          return {
            record: next,
            error: new Error(formatCloudSaveError(error)),
            localOnly: true,
          }
        }
        return { record: saved ?? next, error: null }
      }
      patchLocalActions(recordId, null, { archived: false })
      return { record: next, error: null }
    }

    if (type === ARCHIVE_RECORD_TYPES.VISITOR || type === 'visitor') {
      const next = normalizeVisitorRecord({ ...record, archived: false })
      if (cloudId) {
        const { error } = await restoreBooleanCloudColumn('visitor_sign_in_records', cloudId)
        patchLocalVisitors(recordId, cloudId, { archived: false })
        if (error) {
          return {
            record: next,
            error: new Error(formatCloudSaveError(error)),
            localOnly: true,
          }
        }
        return { record: next, error: null }
      }
      patchLocalVisitors(recordId, null, { archived: false })
      return { record: next, error: null }
    }

    if (type === ARCHIVE_RECORD_TYPES.GENERAL_MEETING || type === 'general-meeting') {
      const next = normalizeMeeting({ ...record, archived: false })
      if (cloudId) {
        const { record: saved, error } = await updateGeneralMeetingRecord(user, next)
        patchLocalMeetings(recordId, cloudId, { archived: false })
        if (error) {
          return {
            record: next,
            error: new Error(formatCloudSaveError(error)),
            localOnly: true,
          }
        }
        return { record: saved ?? next, error: null }
      }
      patchLocalMeetings(recordId, null, { archived: false })
      return { record: next, error: null }
    }

    const table = FORM_ARCHIVE_TABLES[type]
    if (table) {
      const next = { ...record, archived: false }
      if (cloudId) {
        const { error } = await restoreBooleanCloudColumn(table, cloudId)
        patchLocalSavedRecord(recordId, cloudId, { archived: false })
        if (error) {
          return {
            record: next,
            error: new Error(formatCloudSaveError(error)),
            localOnly: true,
          }
        }
        return { record: next, error: null }
      }
      patchLocalSavedRecord(recordId, null, { archived: false })
      return { record: next, error: null }
    }

    return { record: null, error: new Error(`Unsupported record type: ${type}`) }
  } catch (error) {
    return {
      record: null,
      error: new Error(formatCloudSaveError(error) || error?.message || 'Restore failed.'),
    }
  }
}
