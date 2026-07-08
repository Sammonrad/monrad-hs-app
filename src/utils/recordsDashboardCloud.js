import { fetchTimesheetRecords } from './storage/timesheetCloudStorage.js'
import { fetchJobStartRecords } from './storage/jobStartCloudStorage.js'
import { fetchPreStartRecords } from './storage/preStartCloudStorage.js'
import { fetchToolboxRecords } from './storage/toolboxCloudStorage.js'
import { fetchIncidentRecords } from './storage/incidentCloudStorage.js'
import { fetchActionRecords } from './storage/actionCloudStorage.js'
import { getMergedTimesheetRecords } from './storage/timesheetCloudStorage.js'
import { getMergedJobStartRecords } from './storage/jobStartCloudStorage.js'
import { getMergedPreStartRecords } from './storage/preStartCloudStorage.js'
import { getMergedToolboxRecords } from './storage/toolboxCloudStorage.js'
import { getMergedIncidentRecords } from './storage/incidentCloudStorage.js'
import { getMergedActions } from './storage/actionCloudStorage.js'

export async function fetchAllCloudRecords(userId, { isAdmin = false } = {}) {
  if (!userId) {
    return {
      timesheets: [],
      jobStarts: [],
      preStarts: [],
      toolbox: [],
      incidents: [],
      actions: [],
      error: null,
    }
  }

  const [
    timesheetResult,
    jobStartResult,
    preStartResult,
    toolboxResult,
    incidentResult,
    actionResult,
  ] = await Promise.all([
    fetchTimesheetRecords(userId, { isAdmin }),
    fetchJobStartRecords(userId, { isAdmin }),
    fetchPreStartRecords(userId, { isAdmin }),
    fetchToolboxRecords(userId, { isAdmin }),
    fetchIncidentRecords(userId, { isAdmin }),
    fetchActionRecords(userId, { isAdmin }),
  ])

  const error =
    timesheetResult.error ||
    jobStartResult.error ||
    preStartResult.error ||
    toolboxResult.error ||
    incidentResult.error ||
    actionResult.error ||
    null

  return {
    timesheets: timesheetResult.records ?? [],
    jobStarts: jobStartResult.records ?? [],
    preStarts: preStartResult.records ?? [],
    toolbox: toolboxResult.records ?? [],
    incidents: incidentResult.records ?? [],
    actions: actionResult.records ?? [],
    error,
  }
}

export function mergeAllDashboardRecords(savedRecords, cloudRecords) {
  const cloud = cloudRecords ?? {}

  const timesheets = getMergedTimesheetRecords(savedRecords, cloud.timesheets)
  const jobStarts = getMergedJobStartRecords(savedRecords, cloud.jobStarts)
  const preStarts = getMergedPreStartRecords(savedRecords, cloud.preStarts)
  const toolbox = getMergedToolboxRecords(savedRecords, cloud.toolbox)
  const incidents = getMergedIncidentRecords(savedRecords, cloud.incidents)

  return [...timesheets, ...jobStarts, ...preStarts, ...toolbox, ...incidents].sort((a, b) =>
    (b.submittedAt || '').localeCompare(a.submittedAt || ''),
  )
}

export function isLocalOnlyRecord(record) {
  return record.storageSource === 'local' && !record.cloudId
}

export function isCloudBackedRecord(record) {
  return record.storageSource === 'cloud' || record.storageSource === 'both' || Boolean(record.cloudId)
}

export function mergeDashboardActions(localActions, cloudActions) {
  return getMergedActions(localActions, cloudActions)
}
