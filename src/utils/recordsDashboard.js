import {
  ACTION_STATUS_LABELS,
  ACTION_PRIORITY_LABELS,
  SOURCE_TYPE_LABELS,
} from '../constants/index.js'
import { formatSubmittedAt, formatReportType, formatDefectSeverity, formatNzDate } from './formatting.js'
import { getRecordTitle, getFormTypeLabel } from './records.js'
import { isOverdue } from './storage/actionsStorage.js'
import { getSafetyAlerts } from './safetyAlerts.js'
import { isCloudBackedRecord, isLocalOnlyRecord } from './recordsDashboardCloud.js'

export function getMostRecentRecordDate(records) {
  if (!records.length) return null
  const sorted = [...records].sort((a, b) => {
    const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
    const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
    return timeB - timeA
  })
  const recent = sorted[0]
  return recent.fields?.date
    ? formatNzDate(recent.fields.date)
    : recent.submittedAt
      ? formatSubmittedAt(recent.submittedAt)
      : null
}

export function getMostRecentActionDate(actionList) {
  if (!actionList.length) return null
  const sorted = [...actionList].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const recent = sorted[0]
  return recent.date
    ? formatNzDate(recent.date)
    : recent.createdAt
      ? formatSubmittedAt(recent.createdAt)
      : null
}

export function getRecordsDashboardStats(savedRecords, actionList) {
  const byType = (formType) => savedRecords.filter((record) => record.formType === formType)
  const safetyAlerts = getSafetyAlerts(savedRecords, actionList)

  return {
    openActions: safetyAlerts.openActions,
    completedActions: actionList.filter((action) => action.status === 'completed').length,
    overdueActions: safetyAlerts.overdueActions,
    criticalActions: safetyAlerts.criticalActions,
    unresolvedMachineDefects: safetyAlerts.unresolvedMachineDefects,
    unresolvedIncidentActions: safetyAlerts.unresolvedIncidentActions,
    defectCount: savedRecords.filter(
      (record) => record.formType === 'pre-start' && record.defectsFound === 'found',
    ).length,
    incidentCount: byType('incident').length,
    sections: [
      {
        id: 'job-start',
        title: 'Job Start Checklist',
        count: byType('job-start').length,
        recentDate: getMostRecentRecordDate(byType('job-start')),
      },
      {
        id: 'pre-start',
        title: 'Machine Pre-Start',
        count: byType('pre-start').length,
        recentDate: getMostRecentRecordDate(byType('pre-start')),
      },
      {
        id: 'toolbox',
        title: 'Toolbox Meeting',
        count: byType('toolbox').length,
        recentDate: getMostRecentRecordDate(byType('toolbox')),
      },
      {
        id: 'incident',
        title: 'Incident / Near Miss',
        count: byType('incident').length,
        recentDate: getMostRecentRecordDate(byType('incident')),
      },
      {
        id: 'timesheet',
        title: 'Timesheet / Daily Work Record',
        count: byType('timesheet').length,
        recentDate: getMostRecentRecordDate(byType('timesheet')),
      },
      {
        id: 'action-register',
        title: 'Action Register',
        count: actionList.length,
        recentDate: getMostRecentActionDate(actionList),
      },
    ],
  }
}

function collectSearchableText(parts) {
  return parts
    .filter((value) => value != null && String(value).trim())
    .join(' ')
    .toLowerCase()
}

export function getMainPerson(record) {
  const fields = record.fields ?? {}
  switch (record.formType) {
    case 'timesheet':
      return fields.employeeName || ''
    case 'job-start':
      return fields.employeeName || ''
    case 'pre-start':
      return fields.operatorName || fields.operator || ''
    case 'toolbox':
      return fields.meetingLedBy || fields.facilitator || ''
    case 'incident':
      return fields.reportedBy || ''
    default:
      return fields.employeeName || fields.operatorName || fields.reportedBy || ''
  }
}

function getRecordSearchHaystack(record) {
  const fields = record.fields ?? {}
  return collectSearchableText([
    fields.jobName,
    fields.siteLocation,
    fields.employeeName,
    fields.machineUsed,
    fields.operatorName,
    fields.operator,
    fields.machineNameId,
    fields.machine,
    fields.machineHours,
    fields.hourMeter,
    fields.notes,
    fields.jobProjectName,
    fields.topic,
    fields.meetingLedBy,
    fields.facilitator,
    fields.attendees,
    fields.workPlannedToday,
    fields.mainHazardsDiscussed,
    fields.controlsAgreed,
    fields.weatherGroundConditions,
    fields.reportedBy,
    fields.whatHappened,
    fields.description,
    fields.personInvolved,
    fields.immediateActionTaken,
    fields.possibleCause,
    fields.correctiveActionRequired,
    fields.correctiveActionPerson,
    fields.customerName,
    fields.workCompleted,
    fields.materialsUsed,
    fields.docketNumber,
    fields.delaysOrIssues,
    fields.safetyIssues,
    fields.totalHoursWorked,
    fields.chargeableHours,
    fields.nonChargeableHours,
    fields.nonChargeableHours,
    fields.nonChargeableReason,
    record.defectDescription,
    record.actionRequired,
    record.reportedTo,
    record.signatureConfirmation,
    record.formTypeLabel,
    getFormTypeLabel(record.formType),
    formatReportType(fields.reportType),
    formatDefectSeverity(record.defectSeverity),
    getRecordTitle(record),
  ])
}

function getActionSearchHaystack(action) {
  return collectSearchableText([
    action.description,
    action.site,
    action.personResponsible,
    action.notes,
    action.status,
    action.priority,
    action.dueDate,
    ACTION_STATUS_LABELS[action.status],
    ACTION_PRIORITY_LABELS[action.priority],
    SOURCE_TYPE_LABELS[action.sourceType],
    action.date,
    isOverdue(action) ? 'overdue' : '',
  ])
}

function recordToSearchItem(record) {
  return {
    id: `record-${record.cloudId ?? record.id}`,
    itemType: 'record',
    resultType: record.formType,
    typeLabel: record.formTypeLabel || getFormTypeLabel(record.formType),
    date: record.fields?.date || '',
    site: record.fields?.siteLocation || '',
    mainPerson: getMainPerson(record),
    title: getRecordTitle(record),
    status:
      record.completedCount != null
        ? record.allComplete
          ? 'All checks done'
          : 'Partial'
        : null,
    searchText: getRecordSearchHaystack(record),
    record,
    action: null,
    submittedAt: record.submittedAt || '',
    hasDefect: record.formType === 'pre-start' && record.defectsFound === 'found',
    isIncident: record.formType === 'incident',
    isOpenAction: false,
    isLocalOnly: isLocalOnlyRecord(record),
    isCloudBacked: isCloudBackedRecord(record),
  }
}

function actionToSearchItem(action) {
  const overdue = isOverdue(action)
  const statusParts = [
    ACTION_STATUS_LABELS[action.status] || action.status,
    ACTION_PRIORITY_LABELS[action.priority] || action.priority,
  ]
  if (overdue) statusParts.push('Overdue')

  return {
    id: `action-${action.cloudId ?? action.id}`,
    itemType: 'action',
    resultType: 'action',
    typeLabel: 'Action Register',
    date: action.date || '',
    site: action.site || '',
    title: action.description || 'Action item',
    status: statusParts.join(' · '),
    searchText: getActionSearchHaystack(action),
    record: null,
    action,
    submittedAt: action.createdAt || '',
    hasDefect: false,
    isIncident: action.sourceType === 'incident',
    isOpenAction: action.status !== 'completed',
    isOverdue: overdue,
    isCritical: action.priority === 'critical' && action.status !== 'completed',
    isLocalOnly: isLocalOnlyRecord(action),
    isCloudBacked: isCloudBackedRecord(action),
  }
}

export function buildSearchableItems(savedRecords, actionList) {
  return [
    ...savedRecords.map(recordToSearchItem),
    ...actionList.map(actionToSearchItem),
  ].sort((a, b) => {
    const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
    const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
    return timeB - timeA
  })
}

function getItemDateValue(item) {
  const candidates = [
    item.date,
    item.submittedAt?.slice(0, 10),
    item.record?.fields?.date,
    item.action?.createdAt?.slice(0, 10),
  ].filter(Boolean)
  return candidates[0] ?? ''
}

function itemMatchesDateRange(item, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true
  const value = getItemDateValue(item)
  if (!value) return false
  if (dateFrom && value < dateFrom) return false
  if (dateTo && value > dateTo) return false
  return true
}

export function filterSearchItems(
  items,
  {
    searchQuery,
    typeFilter,
    dateFrom,
    dateTo,
    openActionsOnly,
    defectsOnly,
    incidentsOnly,
    cloudOnly,
    localOnly,
  },
) {
  const query = searchQuery.trim().toLowerCase()

  return items.filter((item) => {
    if (query && !item.searchText.includes(query)) return false
    if (typeFilter !== 'all' && item.resultType !== typeFilter) return false
    if (!itemMatchesDateRange(item, dateFrom, dateTo)) return false
    if (openActionsOnly && !(item.itemType === 'action' && item.isOpenAction)) return false
    if (defectsOnly && !item.hasDefect) return false
    if (incidentsOnly && !item.isIncident) return false
    if (cloudOnly && !item.isCloudBacked) return false
    if (localOnly && !item.isLocalOnly) return false
    return true
  })
}
