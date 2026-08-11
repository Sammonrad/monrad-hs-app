import { TODAY } from '../constants/index.js'
import { formatNzDate } from './formatting.js'
import { getSafetyAlerts } from './safetyAlerts.js'
import { getMergedJobStartRecords } from './storage/jobStartCloudStorage.js'
import { getMergedPreStartRecords } from './storage/preStartCloudStorage.js'
import { getMergedTimesheetRecords } from './storage/timesheetCloudStorage.js'

export function getTimeGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function getFirstName(profile, email) {
  const displayName = profile?.full_name?.trim()
  if (displayName) {
    return displayName.split(/\s+/)[0]
  }
  if (email) {
    const local = email.split('@')[0] ?? ''
    const first = local.split(/[._-]/)[0] ?? local
    if (!first) return ''
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
  }
  return ''
}

export function formatDashboardDate(date = new Date()) {
  return formatNzDate(date)
}

function countRecordsForDate(records, date) {
  return records.filter((record) => record.fields?.date === date).length
}

export function getDashboardOverview({
  savedRecords = [],
  actions = [],
  cloudJobStarts = [],
  cloudPreStarts = [],
  cloudTimesheets = [],
}) {
  const today = TODAY()
  const alerts = getSafetyAlerts(savedRecords, actions)

  const jobStarts = getMergedJobStartRecords(savedRecords, cloudJobStarts)
  const preStarts = getMergedPreStartRecords(savedRecords, cloudPreStarts)
  const timesheets = getMergedTimesheetRecords(savedRecords, cloudTimesheets)

  const jobStartsToday = countRecordsForDate(jobStarts, today)
  const preStartsToday = countRecordsForDate(preStarts, today)
  const timesheetsToday = countRecordsForDate(timesheets, today)

  return {
    openActions: alerts.openActions,
    overdueActions: alerts.overdueActions,
    criticalActions: alerts.criticalActions,
    incidentFollowUp: alerts.unresolvedIncidentActions,
    jobStartsToday,
    preStartsToday,
    timesheetsToday,
    safetyAlertCount:
      alerts.overdueActions +
      alerts.criticalActions +
      alerts.unresolvedMachineDefects +
      alerts.unresolvedIncidentActions,
  }
}
