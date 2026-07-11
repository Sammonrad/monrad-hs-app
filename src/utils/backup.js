import {
  BACKUP_APP_NAME,
  BACKUP_VERSION,
  APP_STORAGE_KEYS,
} from '../constants/index.js'
import { loadSavedRecords, persistSavedRecords } from './storage/recordsStorage.js'
import { normalizeRecord } from './records.js'
import { loadActions, persistActions, normalizeAction } from './storage/actionsStorage.js'
import {
  loadVisitorRecords,
  persistVisitorRecords,
  normalizeVisitorRecord,
} from './storage/visitorSignInStorage.js'
import {
  loadSettings,
  persistSettings,
  normalizeSettings,
  createEmptySettings,
} from './storage/settingsStorage.js'
import { SSSP_EDITOR_DRAFT_KEY, MACHINE_DEFECT_RECORDS_KEY } from '../constants/storageKeys.js'
import { loadLocalDefectRecords, persistLocalDefectRecords, normalizeDefectRecord } from './storage/equipmentDefectStorage.js'
import { loadMeetings, persistMeetings, normalizeMeeting } from './storage/generalMeetingStorage.js'
import { loadEditorDraft } from './storage/ssspStorage.js'
import { downloadFile } from './export.js'

export { APP_STORAGE_KEYS, BACKUP_APP_NAME }

export function collectBackupData() {
  const ssspEditorDraft = loadEditorDraft()
  return {
    jobRecords: loadSavedRecords(),
    actions: loadActions(),
    settings: loadSettings(),
    visitorSignInRecords: loadVisitorRecords(),
    ssspEditorDraft,
    machineDefectRecords: loadLocalDefectRecords(),
    generalMeetingRecords: loadMeetings(),
  }
}

export function createBackupPayload() {
  return {
    app: BACKUP_APP_NAME,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: collectBackupData(),
  }
}

export function getBackupFilename() {
  return `monrad-earthworx-backup-${new Date().toISOString().slice(0, 10)}.json`
}

export function exportAppBackup() {
  const payload = createBackupPayload()
  downloadFile(JSON.stringify(payload, null, 2), getBackupFilename(), 'application/json')
  return payload
}

export function validateBackupPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Invalid backup file — not a valid JSON object.' }
  }
  if (parsed.app !== BACKUP_APP_NAME) {
    return { valid: false, error: 'Invalid backup file — not from Monrad Earthworx H&S App.' }
  }
  if (!parsed.data || typeof parsed.data !== 'object') {
    return { valid: false, error: 'Invalid backup file — missing data section.' }
  }
  const { jobRecords, actions, settings, visitorSignInRecords } = parsed.data
  if (jobRecords != null && !Array.isArray(jobRecords)) {
    return { valid: false, error: 'Invalid backup file — job records must be an array.' }
  }
  if (actions != null && !Array.isArray(actions)) {
    return { valid: false, error: 'Invalid backup file — actions must be an array.' }
  }
  if (visitorSignInRecords != null && !Array.isArray(visitorSignInRecords)) {
    return { valid: false, error: 'Invalid backup file — visitor sign-in records must be an array.' }
  }
  if (settings != null && (typeof settings !== 'object' || Array.isArray(settings))) {
    return { valid: false, error: 'Invalid backup file — settings must be an object.' }
  }
  return { valid: true }
}

export function restoreBackupPayload(parsed) {
  const validation = validateBackupPayload(parsed)
  if (!validation.valid) return validation

  try {
    const data = parsed.data
    const jobRecords = Array.isArray(data.jobRecords) ? data.jobRecords.map(normalizeRecord) : []
    const actionList = Array.isArray(data.actions) ? data.actions.map(normalizeAction) : []
    const visitorRecords = Array.isArray(data.visitorSignInRecords)
      ? data.visitorSignInRecords.map(normalizeVisitorRecord)
      : []
    const settingsData = normalizeSettings(data.settings ?? createEmptySettings())

    if (!persistSavedRecords(jobRecords)) {
      return { valid: false, error: 'Could not write job records to this device.' }
    }
    if (!persistActions(actionList)) {
      return { valid: false, error: 'Could not write actions to this device.' }
    }
    if (!persistVisitorRecords(visitorRecords)) {
      return { valid: false, error: 'Could not write visitor sign-in records to this device.' }
    }
    if (!persistSettings(settingsData)) {
      return { valid: false, error: 'Could not write settings to this device.' }
    }

    if (data.ssspEditorDraft != null) {
      try {
        localStorage.setItem(SSSP_EDITOR_DRAFT_KEY, JSON.stringify(data.ssspEditorDraft))
      } catch {
        return { valid: false, error: 'Could not write SSSP editor draft to this device.' }
      }
    }

    if (data.machineDefectRecords != null) {
      const defectList = Array.isArray(data.machineDefectRecords)
        ? data.machineDefectRecords.map(normalizeDefectRecord)
        : []
      if (!persistLocalDefectRecords(defectList)) {
        return { valid: false, error: 'Could not write machine defect records to this device.' }
      }
    }

    if (data.generalMeetingRecords != null) {
      const meetingList = Array.isArray(data.generalMeetingRecords)
        ? data.generalMeetingRecords.map(normalizeMeeting)
        : []
      if (!persistMeetings(meetingList)) {
        return { valid: false, error: 'Could not write H&S General Meeting records to this device.' }
      }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Could not restore backup — file may be corrupted.' }
  }
}
