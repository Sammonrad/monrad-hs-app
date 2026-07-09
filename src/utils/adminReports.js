import {
  ACTION_STATUS_LABELS,
  ACTION_PRIORITY_LABELS,
} from '../constants/index.js'
import { getMainPerson } from './recordsDashboard.js'
import { getRecordTitle, getFormTypeLabel } from './records.js'
import { isOverdue } from './storage/actionsStorage.js'
import {
  getSafetyAlerts,
  isOpenAction,
  isCriticalAction,
} from './safetyAlerts.js'
import { parseRecordHours } from './weeklyTimesheet.js'

export const ADMIN_REPORT_RECORD_TYPES = [
  { id: 'all', label: 'All' },
  { id: 'timesheet', label: 'Timesheet' },
  { id: 'job-start', label: 'Job Start' },
  { id: 'pre-start', label: 'Pre-Start' },
  { id: 'toolbox', label: 'Toolbox' },
  { id: 'incident', label: 'Incident' },
  { id: 'action', label: 'Actions' },
]

export const EMPTY_ADMIN_REPORT_FILTERS = {
  dateFrom: '',
  dateTo: '',
  recordType: 'all',
  staff: '',
  site: '',
  openActionsOnly: false,
  overdueOnly: false,
  criticalOnly: false,
  incidentsOnly: false,
  machineDefectsOnly: false,
}

export function buildAdminReportDataset(cloudRecords) {
  const records = [
    ...(cloudRecords?.timesheets ?? []),
    ...(cloudRecords?.jobStarts ?? []),
    ...(cloudRecords?.preStarts ?? []),
    ...(cloudRecords?.toolbox ?? []),
    ...(cloudRecords?.incidents ?? []),
  ].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))

  const actions = [...(cloudRecords?.actions ?? [])].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  )

  return { records, actions }
}

function getRecordDate(record) {
  return record.fields?.date || record.submittedAt?.slice(0, 10) || ''
}

function getActionDate(action) {
  return action.date || action.createdAt?.slice(0, 10) || ''
}

function matchesDateRange(dateValue, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true
  if (!dateValue) return false
  if (dateFrom && dateValue < dateFrom) return false
  if (dateTo && dateValue > dateTo) return false
  return true
}

function getRecordSite(record) {
  return record.fields?.siteLocation || ''
}

function matchesStaffFilter(person, staff) {
  if (!staff?.trim()) return true
  return (person ?? '').toLowerCase().includes(staff.trim().toLowerCase())
}

function matchesSiteFilter(site, siteFilter) {
  if (!siteFilter?.trim()) return true
  return (site ?? '').toLowerCase().includes(siteFilter.trim().toLowerCase())
}

export function recordToReportRow(record) {
  const fields = record.fields ?? {}
  let status = null
  if (record.completedCount != null) {
    status = record.allComplete ? 'All checks done' : 'Partial'
  }
  if (record.formType === 'pre-start' && record.defectsFound === 'found') {
    status = status ? `${status} · Defect found` : 'Defect found'
  }

  return {
    id: `record-${record.cloudId ?? record.id}`,
    itemType: 'record',
    formType: record.formType,
    typeLabel: record.formTypeLabel || getFormTypeLabel(record.formType),
    date: getRecordDate(record),
    staff: getMainPerson(record),
    site: getRecordSite(record),
    description: getRecordTitle(record),
    status,
    hasDefect: record.formType === 'pre-start' && record.defectsFound === 'found',
    isIncident: record.formType === 'incident',
    record,
  }
}

export function actionToReportRow(action) {
  const overdue = isOverdue(action)
  const statusParts = [
    ACTION_STATUS_LABELS[action.status] || action.status,
    ACTION_PRIORITY_LABELS[action.priority] || action.priority,
  ]
  if (overdue) statusParts.push('Overdue')

  return {
    id: `action-${action.cloudId ?? action.id}`,
    itemType: 'action',
    formType: 'action',
    typeLabel: 'Action Register',
    date: getActionDate(action),
    staff: action.personResponsible || '',
    site: action.site || '',
    description: action.description || 'Action item',
    status: statusParts.join(' · '),
    hasDefect: false,
    isIncident: action.sourceType === 'incident',
    isOpenAction: isOpenAction(action),
    isOverdue: overdue,
    isCritical: isCriticalAction(action),
    action,
  }
}

export function buildAdminReportRows(records, actions) {
  return [
    ...records.map(recordToReportRow),
    ...actions.map(actionToReportRow),
  ].sort((a, b) => {
    const dateA = a.date || ''
    const dateB = b.date || ''
    return dateB.localeCompare(dateA)
  })
}

export function filterAdminReportRows(rows, filters) {
  return rows.filter((row) => {
    if (filters.recordType !== 'all') {
      if (filters.recordType === 'action') {
        if (row.itemType !== 'action') return false
      } else if (row.formType !== filters.recordType) {
        return false
      }
    }

    if (!matchesDateRange(row.date, filters.dateFrom, filters.dateTo)) return false
    if (!matchesStaffFilter(row.staff, filters.staff)) return false
    if (!matchesSiteFilter(row.site, filters.site)) return false

    if (filters.openActionsOnly && !(row.itemType === 'action' && row.isOpenAction)) return false
    if (filters.overdueOnly && !(row.itemType === 'action' && row.isOverdue)) return false
    if (filters.criticalOnly && !(row.itemType === 'action' && row.isCritical)) return false
    if (filters.incidentsOnly && !row.isIncident) return false
    if (filters.machineDefectsOnly && !row.hasDefect) return false

    return true
  })
}

export function getAdminReportFilterOptions(records, actions) {
  const staff = new Set()
  const sites = new Set()

  records.forEach((record) => {
    const person = getMainPerson(record)
    if (person?.trim()) staff.add(person.trim())
    const site = getRecordSite(record)
    if (site?.trim()) sites.add(site.trim())
  })

  actions.forEach((action) => {
    if (action.personResponsible?.trim()) staff.add(action.personResponsible.trim())
    if (action.site?.trim()) sites.add(action.site.trim())
  })

  return {
    staff: [...staff].sort((a, b) => a.localeCompare(b)),
    sites: [...sites].sort((a, b) => a.localeCompare(b)),
  }
}

export function computeAdminReportSummary(filteredRecords, filteredActions) {
  const timesheets = filteredRecords.filter((r) => r.formType === 'timesheet')
  let totalLabourHours = 0
  let totalChargeableHours = 0

  timesheets.forEach((record) => {
    const { total, chargeable } = parseRecordHours(record)
    totalLabourHours += total
    totalChargeableHours += chargeable
  })

  const safetyAlerts = getSafetyAlerts(filteredRecords, filteredActions)
  const defectCount = filteredRecords.filter(
    (record) => record.formType === 'pre-start' && record.defectsFound === 'found',
  ).length

  return {
    totalTimesheets: timesheets.length,
    totalLabourHours: Math.round(totalLabourHours * 100) / 100,
    totalChargeableHours: Math.round(totalChargeableHours * 100) / 100,
    totalJobStarts: filteredRecords.filter((r) => r.formType === 'job-start').length,
    totalPreStarts: filteredRecords.filter((r) => r.formType === 'pre-start').length,
    totalToolbox: filteredRecords.filter((r) => r.formType === 'toolbox').length,
    totalIncidents: filteredRecords.filter((r) => r.formType === 'incident').length,
    totalActions: filteredActions.length,
    openActions: safetyAlerts.openActions,
    overdueActions: safetyAlerts.overdueActions,
    criticalActions: safetyAlerts.criticalActions,
    completedActions: filteredActions.filter((a) => a.status === 'completed').length,
    machineDefects: defectCount,
    unresolvedMachineDefects: safetyAlerts.unresolvedMachineDefects,
    unresolvedIncidentActions: safetyAlerts.unresolvedIncidentActions,
  }
}

const GROUP_ORDER = [
  { id: 'timesheet', title: 'Timesheets' },
  { id: 'job-start', title: 'Job Start Checklists' },
  { id: 'pre-start', title: 'Machine Pre-Starts' },
  { id: 'toolbox', title: 'Toolbox Meetings' },
  { id: 'incident', title: 'Incidents / Near Misses' },
  { id: 'action', title: 'Action Register' },
]

export function groupAdminReportRows(rows) {
  const byType = Object.fromEntries(GROUP_ORDER.map((g) => [g.id, []]))

  rows.forEach((row) => {
    const key = row.itemType === 'action' ? 'action' : row.formType
    if (byType[key]) byType[key].push(row)
  })

  return GROUP_ORDER.map((group) => ({
    ...group,
    rows: byType[group.id] ?? [],
  })).filter((group) => group.rows.length > 0)
}

export function describeAdminReportFilters(filters) {
  const parts = []
  const typeLabel = ADMIN_REPORT_RECORD_TYPES.find((t) => t.id === filters.recordType)?.label
  if (filters.recordType !== 'all' && typeLabel) parts.push(`Type: ${typeLabel}`)
  if (filters.dateFrom) parts.push(`From: ${filters.dateFrom}`)
  if (filters.dateTo) parts.push(`To: ${filters.dateTo}`)
  if (filters.staff?.trim()) parts.push(`Staff: ${filters.staff.trim()}`)
  if (filters.site?.trim()) parts.push(`Site: ${filters.site.trim()}`)
  if (filters.openActionsOnly) parts.push('Open actions only')
  if (filters.overdueOnly) parts.push('Overdue only')
  if (filters.criticalOnly) parts.push('Critical only')
  if (filters.incidentsOnly) parts.push('Incidents only')
  if (filters.machineDefectsOnly) parts.push('Machine defects only')
  return parts.length ? parts.join(' · ') : 'All cloud records'
}

export function splitFilteredDataset(rows) {
  const records = rows.filter((r) => r.itemType === 'record').map((r) => r.record)
  const actions = rows.filter((r) => r.itemType === 'action').map((r) => r.action)
  return { records, actions }
}
