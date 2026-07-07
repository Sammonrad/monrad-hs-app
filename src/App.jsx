import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'monrad-earthworx-job-records'
const ACTIONS_STORAGE_KEY = 'monrad-earthworx-actions'
const SETTINGS_STORAGE_KEY = 'monrad-earthworx-settings'
const MAX_PHOTOS = 3
const MACHINE_TYPES = ['Excavator', 'Truck', 'Loader', 'Roller', 'Other']
const TODAY = () => new Date().toISOString().slice(0, 10)

const JOB_START_CHECKLIST = [
  'Arrived on site safely',
  'Checked job hazards',
  'Checked underground services',
  'Completed machine pre-start',
  'PPE is being worn',
  'Weather and ground conditions checked',
  'Emergency access confirmed',
]

const PRE_START_CHECKLIST = [
  'Engine oil checked',
  'Coolant checked',
  'Hydraulic oil checked',
  'Fuel / AdBlue checked',
  'Tracks / tyres checked',
  'Leaks checked',
  'Pins, bushes, bucket, and attachments checked',
  'Lights / beacon checked',
  'Horn / reversing alarm checked',
  'Fire extinguisher present',
  'Grease points completed',
  'Machine safe to operate',
]

const TOOLBOX_CHECKLIST = [
  'Scope of work discussed',
  'Site hazards discussed',
  'Machinery risks discussed',
  'Underground/overhead services discussed',
  'Traffic / public risks discussed',
  'PPE requirements confirmed',
  'Emergency plan discussed',
  'Everyone understands the work plan',
]

const INCIDENT_CHECKLIST = [
  'Area made safe',
  'Supervisor / manager notified',
  'Injured person treated if required',
  'Photos or evidence collected if available',
  'Witnesses recorded if applicable',
  'Corrective action identified',
  'Follow-up required',
  'Report completed honestly and accurately',
]

const REPORT_TYPE_LABELS = {
  incident: 'Incident',
  'near-miss': 'Near Miss',
  'property-damage': 'Property Damage',
  injury: 'Injury',
  environmental: 'Environmental',
}

function formatReportType(value) {
  return REPORT_TYPE_LABELS[value] ?? value ?? '—'
}

const DEFECT_SEVERITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

function formatDefectsFound(value) {
  if (value === 'found') return 'Defects found'
  if (value === 'none') return 'No defects'
  return value ?? '—'
}

function formatMachineOperable(value) {
  if (value === 'yes') return 'Yes'
  if (value === 'no') return 'No'
  return value ?? '—'
}

function formatDefectSeverity(value) {
  return DEFECT_SEVERITY_LABELS[value] ?? value ?? '—'
}

function isSeriousDefect(record) {
  return (
    record.defectsFound === 'found' &&
    (record.defectSeverity === 'critical' || record.machineOperableSafely === 'no')
  )
}

function createEmptyDefectState() {
  return {
    defectsFound: 'none',
    defectDescription: '',
    defectSeverity: '',
    machineOperableSafely: '',
    actionRequired: '',
    reportedTo: '',
    defectPhotos: [],
  }
}

function normalizePreStartDefects(record) {
  return {
    defectsFound: record.defectsFound ?? '',
    defectDescription: record.defectDescription ?? '',
    defectSeverity: record.defectSeverity ?? '',
    machineOperableSafely: record.machineOperableSafely ?? '',
    actionRequired: record.actionRequired ?? '',
    reportedTo: record.reportedTo ?? '',
    defectPhotos: record.defectPhotos ?? [],
  }
}

const FORM_TYPES = {
  'job-start': {
    id: 'job-start',
    label: 'Job Start',
    title: 'Job Start Checklist',
    checklist: JOB_START_CHECKLIST,
    emptyFields: {
      jobName: '',
      siteLocation: '',
      employeeName: '',
      machineUsed: '',
      date: TODAY(),
      notes: '',
    },
  },
  'pre-start': {
    id: 'pre-start',
    label: 'Pre-start',
    title: 'Machine Pre-Start',
    checklist: PRE_START_CHECKLIST,
    emptyFields: {
      date: TODAY(),
      operatorName: '',
      machineNameId: '',
      machineHours: '',
      siteLocation: '',
      notes: '',
    },
  },
  toolbox: {
    id: 'toolbox',
    label: 'Toolbox',
    title: 'Toolbox Meeting',
    checklist: TOOLBOX_CHECKLIST,
    emptyFields: {
      date: TODAY(),
      jobProjectName: '',
      siteLocation: '',
      meetingLedBy: '',
      attendees: '',
      workPlannedToday: '',
      mainHazardsDiscussed: '',
      controlsAgreed: '',
      weatherGroundConditions: '',
      notes: '',
    },
  },
  incident: {
    id: 'incident',
    label: 'Incident',
    title: 'Incident / Near Miss',
    checklist: INCIDENT_CHECKLIST,
    emptyFields: {
      date: TODAY(),
      time: '',
      reportedBy: '',
      siteLocation: '',
      reportType: '',
      personInvolved: '',
      whatHappened: '',
      immediateActionTaken: '',
      possibleCause: '',
      correctiveActionRequired: '',
      correctiveActionPerson: '',
      followUpDate: '',
      notes: '',
    },
  },
  timesheet: {
    id: 'timesheet',
    label: 'Timesheet',
    title: 'Timesheet / Daily Work Record',
    checklist: [],
    emptyFields: {
      date: TODAY(),
      employeeName: '',
      jobProjectName: '',
      siteLocation: '',
      customerName: '',
      machineUsed: '',
      startTime: '',
      finishTime: '',
      breakMinutes: '',
      totalHoursWorked: '',
      chargeableHours: '',
      nonChargeableHours: '',
      nonChargeableReason: '',
      workCompleted: '',
      materialsUsed: '',
      docketNumber: '',
      delaysOrIssues: '',
      safetyIssues: '',
      notes: '',
    },
  },
}

function formatSubmittedAt(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function loadSavedRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeRecord) : []
  } catch {
    return []
  }
}

function persistSavedRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    return true
  } catch (error) {
    if (error?.name === 'QuotaExceededError') {
      window.alert(
        'Could not save — device storage is full. Try clearing old records or using fewer photos (max 3 per record, compressed).',
      )
    } else {
      window.alert('Could not save record to this device.')
    }
    return false
  }
}

const ACTION_STATUS_LABELS = {
  open: 'Open',
  'in-progress': 'In Progress',
  completed: 'Completed',
}

const SOURCE_TYPE_LABELS = {
  'pre-start': 'Machine Pre-Start',
  toolbox: 'Toolbox Meeting',
  incident: 'Incident / Near Miss',
  manual: 'Manual entry',
}

function normalizeAction(action) {
  return {
    id: action.id ?? createRecordId(),
    sourceType: action.sourceType ?? 'manual',
    sourceRecordId: action.sourceRecordId ?? null,
    date: action.date ?? '',
    site: action.site ?? '',
    description: action.description ?? '',
    personResponsible: action.personResponsible ?? '',
    dueDate: action.dueDate ?? '',
    status: action.status ?? 'open',
    notes: action.notes ?? '',
    createdAt: action.createdAt ?? new Date().toISOString(),
    autoCreated: action.autoCreated ?? false,
    serious: action.serious ?? false,
  }
}

function loadActions() {
  try {
    const raw = localStorage.getItem(ACTIONS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeAction) : []
  } catch {
    return []
  }
}

function persistActions(actions) {
  try {
    localStorage.setItem(ACTIONS_STORAGE_KEY, JSON.stringify(actions))
    return true
  } catch {
    window.alert('Could not save actions to this device.')
    return false
  }
}

function isOverdue(action) {
  if (!action.dueDate || action.status === 'completed') return false
  const due = new Date(action.dueDate)
  if (Number.isNaN(due.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return due < today
}

function hasActionForRecord(actions, record) {
  return actions.some(
    (action) =>
      action.autoCreated &&
      action.sourceRecordId === record.id &&
      action.sourceType === record.formType,
  )
}

function createActionFromRecord(record) {
  const fields = record.fields ?? {}
  const base = {
    id: createRecordId(),
    sourceRecordId: record.id,
    sourceType: record.formType,
    date: fields.date || TODAY(),
    site: fields.siteLocation || '',
    status: 'open',
    notes: '',
    createdAt: new Date().toISOString(),
    autoCreated: true,
    serious: false,
  }

  if (record.formType === 'pre-start' && record.defectsFound === 'found') {
    const severityNote = record.defectSeverity
      ? ` [${formatDefectSeverity(record.defectSeverity)}]`
      : ''
    return {
      ...base,
      description: `${record.defectDescription || 'Defect reported'}${severityNote}`,
      personResponsible: record.reportedTo || fields.operatorName || '',
      dueDate: '',
      serious: isSeriousDefect(record),
    }
  }

  if (record.formType === 'incident' && fields.correctiveActionRequired?.trim()) {
    return {
      ...base,
      description: fields.correctiveActionRequired.trim(),
      personResponsible: fields.correctiveActionPerson || fields.reportedBy || '',
      dueDate: fields.followUpDate || '',
    }
  }

  if (record.formType === 'toolbox') {
    const description = fields.controlsAgreed?.trim() || fields.mainHazardsDiscussed?.trim()
    if (!description) return null
    return {
      ...base,
      description,
      personResponsible: fields.meetingLedBy || '',
      dueDate: '',
    }
  }

  return null
}

function syncActionsFromRecord(record, actions) {
  const newAction = createActionFromRecord(record)
  if (!newAction || hasActionForRecord(actions, record)) return actions
  return [newAction, ...actions]
}

function createEmptySettings() {
  return { operators: [], machines: [], sites: [] }
}

function normalizeSettings(data) {
  return {
    operators: Array.isArray(data?.operators)
      ? data.operators
          .map((item) => ({ id: item.id ?? createRecordId(), name: item.name ?? '' }))
          .filter((item) => item.name.trim())
      : [],
    machines: Array.isArray(data?.machines)
      ? data.machines
          .map((item) => ({
            id: item.id ?? createRecordId(),
            name: item.name ?? '',
            type: MACHINE_TYPES.includes(item.type) ? item.type : 'Other',
          }))
          .filter((item) => item.name.trim())
      : [],
    sites: Array.isArray(data?.sites)
      ? data.sites
          .map((item) => ({ id: item.id ?? createRecordId(), name: item.name ?? '' }))
          .filter((item) => item.name.trim())
      : [],
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return createEmptySettings()
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return createEmptySettings()
  }
}

function persistSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    return true
  } catch {
    window.alert('Could not save settings to this device.')
    return false
  }
}

function getSettingsOptions(settings) {
  return {
    operators: settings.operators.map((item) => item.name),
    machines: settings.machines.map((item) => item.name),
    sites: settings.sites.map((item) => item.name),
  }
}

function getMostRecentRecordDate(records) {
  if (!records.length) return null
  const sorted = [...records].sort((a, b) => {
    const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
    const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
    return timeB - timeA
  })
  const recent = sorted[0]
  return recent.fields?.date || (recent.submittedAt ? formatSubmittedAt(recent.submittedAt) : null)
}

function getMostRecentActionDate(actionList) {
  if (!actionList.length) return null
  const sorted = [...actionList].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const recent = sorted[0]
  return recent.date || (recent.createdAt ? formatSubmittedAt(recent.createdAt) : null)
}

function getRecordsDashboardStats(savedRecords, actionList) {
  const byType = (formType) => savedRecords.filter((record) => record.formType === formType)

  return {
    openActions: actionList.filter((action) => action.status !== 'completed').length,
    completedActions: actionList.filter((action) => action.status === 'completed').length,
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
    ACTION_STATUS_LABELS[action.status],
    SOURCE_TYPE_LABELS[action.sourceType],
    action.date,
  ])
}

function recordToSearchItem(record) {
  return {
    id: `record-${record.id}`,
    itemType: 'record',
    resultType: record.formType,
    typeLabel: record.formTypeLabel || getFormTypeLabel(record.formType),
    date: record.fields?.date || '',
    site: record.fields?.siteLocation || '',
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
  }
}

function actionToSearchItem(action) {
  return {
    id: `action-${action.id}`,
    itemType: 'action',
    resultType: 'action',
    typeLabel: 'Action Register',
    date: action.date || '',
    site: action.site || '',
    title: action.description || 'Action item',
    status: ACTION_STATUS_LABELS[action.status] || action.status,
    searchText: getActionSearchHaystack(action),
    record: null,
    action,
    submittedAt: action.createdAt || '',
    hasDefect: false,
    isIncident: action.sourceType === 'incident',
    isOpenAction: action.status !== 'completed',
  }
}

function buildSearchableItems(savedRecords, actionList) {
  return [
    ...savedRecords.map(recordToSearchItem),
    ...actionList.map(actionToSearchItem),
  ].sort((a, b) => {
    const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
    const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
    return timeB - timeA
  })
}

function itemMatchesDate(item, dateFilter) {
  if (!dateFilter) return true
  const candidates = [
    item.date,
    item.submittedAt?.slice(0, 10),
    item.record?.fields?.date,
    item.action?.createdAt?.slice(0, 10),
  ].filter(Boolean)
  return candidates.some((value) => value === dateFilter || value.startsWith(dateFilter))
}

function filterSearchItems(items, { searchQuery, typeFilter, dateFilter, openActionsOnly, defectsOnly, incidentsOnly }) {
  const query = searchQuery.trim().toLowerCase()

  return items.filter((item) => {
    if (query && !item.searchText.includes(query)) return false
    if (typeFilter !== 'all' && item.resultType !== typeFilter) return false
    if (!itemMatchesDate(item, dateFilter)) return false
    if (openActionsOnly && !(item.itemType === 'action' && item.isOpenAction)) return false
    if (defectsOnly && !item.hasDefect) return false
    if (incidentsOnly && !item.isIncident) return false
    return true
  })
}

function useHighlightRecord(highlightRecordId, onClearHighlight, deps = []) {
  useEffect(() => {
    if (!highlightRecordId) return undefined

    const timer = window.setTimeout(() => {
      const el = document.querySelector(`[data-record-id="${highlightRecordId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('saved-record--highlight')
        window.setTimeout(() => {
          el.classList.remove('saved-record--highlight')
          onClearHighlight?.()
        }, 2500)
      } else {
        onClearHighlight?.()
      }
    }, 350)

    return () => window.clearTimeout(timer)
  }, [highlightRecordId, onClearHighlight, ...deps])
}

function createRecordId() {
  return crypto.randomUUID()
}

function normalizeRecord(record) {
  if (record.formType && record.fields) {
    const normalized = { ...record, photos: record.photos ?? [] }
    if (record.formType === 'pre-start') {
      return { ...normalized, ...normalizePreStartDefects(record) }
    }
    return normalized
  }

  return {
    ...record,
    formType: 'job-start',
    formTypeLabel: 'Job Start Checklist',
    fields: {
      jobName: record.jobName ?? '',
      siteLocation: record.siteLocation ?? '',
      employeeName: record.employeeName ?? '',
      machineUsed: record.machineUsed ?? '',
      date: record.date ?? '',
      notes: record.notes ?? '',
    },
    signature: record.signature ?? null,
    signatureConfirmation: record.signatureConfirmation ?? '',
    photos: record.photos ?? [],
  }
}

function getRecordTitle(record) {
  const fields = record.fields ?? {}
  switch (record.formType) {
    case 'pre-start':
      return fields.machineNameId || fields.machine || 'Pre-start record'
    case 'toolbox':
      return fields.jobProjectName || fields.topic || 'Toolbox meeting'
    case 'incident':
      return (fields.whatHappened || fields.description)?.slice(0, 60) || 'Incident report'
    case 'timesheet':
      return fields.jobProjectName || fields.workCompleted?.slice(0, 60) || 'Timesheet record'
    default:
      return fields.jobName || 'Untitled job'
  }
}

function getFormTypeLabel(formType) {
  return FORM_TYPES[formType]?.title ?? formType
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr?.trim()) return null
  const parts = timeStr.trim().split(':')
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1] ?? '0', 10)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

function formatDurationMinutes(totalMinutes) {
  if (totalMinutes == null) return ''
  if (totalMinutes <= 0) return '0h'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function calculateLabourHours(startTime, finishTime, breakMinutes) {
  const minutes = getLabourMinutes(startTime, finishTime, breakMinutes)
  if (minutes == null) {
    const start = parseTimeToMinutes(startTime)
    const finish = parseTimeToMinutes(finishTime)
    if (start != null && finish != null && finish < start) {
      return { value: '', invalid: true, minutes: null }
    }
    return { value: '', invalid: false, minutes: null }
  }
  return {
    value: formatDurationMinutes(minutes),
    invalid: false,
    minutes,
  }
}

function getLabourMinutes(startTime, finishTime, breakMinutes) {
  const start = parseTimeToMinutes(startTime)
  const finish = parseTimeToMinutes(finishTime)
  if (start == null || finish == null || finish < start) return null
  const breakMins = parseInt(String(breakMinutes).trim(), 10) || 0
  return Math.max(0, finish - start - breakMins)
}

function parseDecimalHours(value) {
  const parsed = parseFloat(String(value ?? '').trim())
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
}

function minutesToDecimalHours(minutes) {
  if (minutes == null) return 0
  return Math.round((minutes / 60) * 100) / 100
}

function formatDecimalHoursDisplay(hours) {
  if (hours === '' || hours == null) return ''
  const value = typeof hours === 'number' ? hours : parseFloat(hours)
  if (Number.isNaN(value)) return ''
  return `${value.toFixed(2)} hrs`
}

function calculateAutoChargeableHours(labourMinutes, nonChargeableHours) {
  if (labourMinutes == null) return ''
  const total = minutesToDecimalHours(labourMinutes)
  const nonChargeable = parseDecimalHours(nonChargeableHours)
  return Math.max(0, total - nonChargeable).toFixed(2)
}

const TIMESHEET_FIELD_ORDER = [
  'date',
  'employeeName',
  'jobProjectName',
  'siteLocation',
  'customerName',
  'machineUsed',
  'startTime',
  'finishTime',
  'breakMinutes',
  'totalHoursWorked',
  'chargeableHours',
  'nonChargeableHours',
  'nonChargeableReason',
  'workCompleted',
  'materialsUsed',
  'docketNumber',
  'delaysOrIssues',
  'safetyIssues',
  'notes',
]

function createEmptyDraft(formType) {
  const draft = {
    fields: { ...FORM_TYPES[formType].emptyFields, date: TODAY() },
    checked: new Set(),
    signatureConfirmation: '',
    photos: [],
  }
  if (formType === 'pre-start') {
    Object.assign(draft, createEmptyDefectState())
  }
  return draft
}

async function compressImage(file, maxWidth = 800, quality = 0.7) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(event.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      let { width, height } = image
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    image.onerror = reject
    image.src = dataUrl
  })
}

function buildTextSummary(record) {
  const lines = [
    'Monrad Earthworx — Record Export',
    `Form: ${record.formTypeLabel || getFormTypeLabel(record.formType)}`,
    `Saved: ${formatSubmittedAt(record.submittedAt)}`,
    '',
  ]

  Object.entries(record.fields ?? {}).forEach(([key, value]) => {
    if (value) {
      lines.push(`${key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}: ${value}`)
    }
  })

  if (record.completedCount != null) {
    lines.push('', `Checklist: ${record.completedCount} of ${record.totalCount} completed`)
  }

  if (record.completedItems?.length) {
    lines.push('', 'Completed items:')
    record.completedItems.forEach((item) => lines.push(`  - ${item}`))
  }

  if (record.signatureConfirmation) {
    lines.push('', `Signature / Name Confirmation: ${record.signatureConfirmation}`)
  } else if (record.signature) {
    lines.push('', 'Signature: included (image)')
  }
  if (record.photos?.length) lines.push(`Photos: ${record.photos.length} attached`)

  if (record.formType === 'pre-start' && record.defectsFound) {
    lines.push('', `Any defects found?: ${formatDefectsFound(record.defectsFound)}`)
    if (record.defectsFound === 'found') {
      lines.push(`Defect description: ${record.defectDescription || '—'}`)
      lines.push(`Severity: ${formatDefectSeverity(record.defectSeverity)}`)
      lines.push(
        `Can machine be operated safely?: ${formatMachineOperable(record.machineOperableSafely)}`,
      )
      if (record.actionRequired) lines.push(`Action required: ${record.actionRequired}`)
      if (record.reportedTo) lines.push(`Reported to: ${record.reportedTo}`)
      if (record.defectPhotos?.length) {
        lines.push(`Defect photos: ${record.defectPhotos.length} attached`)
      }
      if (isSeriousDefect(record)) {
        lines.push('', 'WARNING: Do not operate this machine until the issue has been reviewed.')
      }
    }
  }

  return lines.join('\n')
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportRecordJson(record) {
  downloadFile(
    JSON.stringify(record, null, 2),
    `monrad-${record.formType}-${record.id.slice(0, 8)}.json`,
    'application/json',
  )
}

function exportRecordText(record) {
  downloadFile(
    buildTextSummary(record),
    `monrad-${record.formType}-${record.id.slice(0, 8)}.txt`,
    'text/plain',
  )
}

function SignatureConfirmationField({ value, onChange }) {
  return (
    <label className="field">
      <span className="field__label">Signature / Name Confirmation</span>
      <input
        type="text"
        className="field__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your full name to confirm"
      />
    </label>
  )
}

function RecordSignatureDisplay({ record }) {
  if (record.signatureConfirmation) {
    return (
      <div className="record__signature">
        <h3 className="record__subtitle">Signature / Name Confirmation</h3>
        <p className="record__signature-text">{record.signatureConfirmation}</p>
      </div>
    )
  }

  if (record.signature) {
    return (
      <div className="record__signature">
        <h3 className="record__subtitle">Signature</h3>
        <img src={record.signature} alt="Signature" className="record__signature-img" />
      </div>
    )
  }

  return null
}

function SavedRecordSignature({ record }) {
  if (record.signatureConfirmation) {
    return <p className="saved-record__signature-text">{record.signatureConfirmation}</p>
  }

  if (record.signature) {
    return <img src={record.signature} alt="Signature" className="saved-record__signature" />
  }

  return null
}

function PhotoUpload({ photos, onChange, label }) {
  async function handleFiles(event) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    const remaining = MAX_PHOTOS - photos.length
    if (remaining <= 0) {
      window.alert(`Maximum ${MAX_PHOTOS} photos allowed.`)
      event.target.value = ''
      return
    }

    const selected = files.slice(0, remaining)
    try {
      const compressed = await Promise.all(
        selected.map(async (file) => ({
          id: createRecordId(),
          name: file.name,
          dataUrl: await compressImage(file),
        })),
      )
      onChange([...photos, ...compressed])
    } catch {
      window.alert('Could not process one or more images.')
    }
    event.target.value = ''
  }

  function removePhoto(photoId) {
    onChange(photos.filter((photo) => photo.id !== photoId))
  }

  return (
    <div className="photos">
      <span className="field__label">{label ?? `Photos (max ${MAX_PHOTOS})`}</span>
      <label className="photos__upload">
        <input
          type="file"
          accept="image/*"
          multiple
          className="photos__input"
          onChange={handleFiles}
          disabled={photos.length >= MAX_PHOTOS}
        />
        Add photo{photos.length > 0 ? ` (${photos.length}/${MAX_PHOTOS})` : ''}
      </label>
      {photos.length > 0 && (
        <ul className="photos__thumbs">
          {photos.map((photo) => (
            <li key={photo.id} className="photos__thumb">
              <img src={photo.dataUrl} alt={photo.name} />
              <button type="button" className="photos__remove" onClick={() => removePhoto(photo.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="photos__hint">
        Up to {MAX_PHOTOS} images per record, resized to ~800px JPEG for device storage.
      </p>
    </div>
  )
}

function RadioFieldGroup({ label, name, value, onChange, options }) {
  return (
    <fieldset className="radio-group">
      <legend className="field__label">{label}</legend>
      <div className="radio-group__options">
        {options.map((option) => (
          <label key={option.value} className="radio-group__option">
            <input
              type="radio"
              name={name}
              className="radio-group__input"
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value)}
            />
            <span className="radio-group__text">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function DefectWarning() {
  return (
    <p className="defect-warning" role="alert">
      Do not operate this machine until the issue has been reviewed.
    </p>
  )
}

function DefectPhotosDisplay({ photos, title = 'Defect photos', className = '' }) {
  if (!photos?.length) return null

  return (
    <div className={`record__photos ${className}`.trim()}>
      <h3 className="record__subtitle">{title}</h3>
      <ul className="photos__thumbs photos__thumbs--record">
        {photos.map((photo) => (
          <li key={photo.id} className="photos__thumb">
            <img src={photo.dataUrl} alt={photo.name} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function DefectDetailsDisplay({ record }) {
  if (record.formType !== 'pre-start') return null

  return (
    <>
      {isSeriousDefect(record) && <DefectWarning />}
      {record.defectsFound === 'found' && record.defectPhotos?.length > 0 && (
        <DefectPhotosDisplay photos={record.defectPhotos} />
      )}
    </>
  )
}

const FIELD_LABELS = {
  jobName: 'Job name',
  siteLocation: 'Site location',
  employeeName: 'Employee / operator',
  machineUsed: 'Machine used',
  machine: 'Machine',
  machineNameId: 'Machine name / ID',
  hourMeter: 'Hour meter',
  machineHours: 'Machine hours',
  operator: 'Operator',
  operatorName: 'Operator name',
  topic: 'Topic',
  jobProjectName: 'Job / project name',
  facilitator: 'Facilitator',
  meetingLedBy: 'Meeting led by',
  attendees: 'Attendees',
  workPlannedToday: 'Work planned today',
  hazardsDiscussed: 'Hazards discussed',
  mainHazardsDiscussed: 'Main hazards discussed',
  controlsAgreed: 'Controls agreed',
  weatherGroundConditions: 'Weather / ground conditions',
  reportType: 'Type of report',
  description: 'Description',
  whatHappened: 'What happened?',
  location: 'Location',
  peopleInvolved: 'People involved',
  personInvolved: 'Person involved',
  actionsTaken: 'Actions taken',
  immediateActionTaken: 'Immediate action taken',
  possibleCause: 'Possible cause',
  correctiveActionRequired: 'Corrective action required',
  correctiveActionPerson: 'Person responsible for corrective action',
  followUpDate: 'Follow-up date',
  incidentTime: 'Time',
  time: 'Time',
  reportedBy: 'Reported by',
  date: 'Date',
  notes: 'Notes',
  defectsFound: 'Any defects found?',
  defectDescription: 'Defect description',
  defectSeverity: 'Severity',
  machineOperableSafely: 'Can the machine still be operated safely?',
  actionRequired: 'Action required',
  reportedTo: 'Reported to',
  customerName: 'Customer / client',
  startTime: 'Start time',
  finishTime: 'Finish time',
  breakMinutes: 'Break time (minutes)',
  totalHoursWorked: 'Total hours worked',
  workCompleted: 'Work completed',
  materialsUsed: 'Materials used or delivered',
  docketNumber: 'Docket / reference number',
  delaysOrIssues: 'Delays or issues',
  safetyIssues: 'Safety issues or hazards noticed',
  chargeableHours: 'Chargeable hours',
  nonChargeableHours: 'Non-chargeable hours',
  nonChargeableReason: 'Reason for non-chargeable time',
}

function formatFieldDisplayValue(key, value) {
  if (key === 'reportType') return formatReportType(value)
  if (key === 'defectsFound') return formatDefectsFound(value)
  if (key === 'defectSeverity') return formatDefectSeverity(value)
  if (key === 'machineOperableSafely') return formatMachineOperable(value)
  if (key === 'chargeableHours' && value) return formatDecimalHoursDisplay(value)
  if (key === 'nonChargeableHours' && value) return formatDecimalHoursDisplay(value)
  return value || '—'
}

function getRecordDetailRows(record) {
  const fields = record.fields ?? {}

  if (record.formType === 'timesheet') {
    const nonChargeable = parseDecimalHours(fields.nonChargeableHours)
    return TIMESHEET_FIELD_ORDER.filter((key) => {
      if (key === 'nonChargeableHours' || key === 'nonChargeableReason') {
        return nonChargeable > 0
      }
      return true
    }).map((key) => ({
      key,
      label: FIELD_LABELS[key] ?? key,
      value: formatFieldDisplayValue(key, fields[key]),
    }))
  }

  const rows = Object.entries(fields).map(([key, value]) => ({
    key,
    label: FIELD_LABELS[key] ?? key,
    value: formatFieldDisplayValue(key, value),
  }))

  if (record.totalCount > 0) {
    rows.push({
      key: 'checklist-progress',
      label: 'Checklist progress',
      value: `${record.completedCount ?? 0} of ${record.totalCount} completed`,
    })
  }

  if (record.formType === 'pre-start' && record.defectsFound) {
    rows.push({
      key: 'defectsFound',
      label: FIELD_LABELS.defectsFound,
      value: formatDefectsFound(record.defectsFound),
    })
    if (record.defectsFound === 'found') {
      rows.push(
        {
          key: 'defectDescription',
          label: FIELD_LABELS.defectDescription,
          value: record.defectDescription || '—',
        },
        {
          key: 'defectSeverity',
          label: FIELD_LABELS.defectSeverity,
          value: formatDefectSeverity(record.defectSeverity),
        },
        {
          key: 'machineOperableSafely',
          label: FIELD_LABELS.machineOperableSafely,
          value: formatMachineOperable(record.machineOperableSafely),
        },
        {
          key: 'actionRequired',
          label: FIELD_LABELS.actionRequired,
          value: record.actionRequired || '—',
        },
        {
          key: 'reportedTo',
          label: FIELD_LABELS.reportedTo,
          value: record.reportedTo || '—',
        },
      )
    }
  }

  return rows
}

function RecordDetails({ record }) {
  const detailRows = getRecordDetailRows(record)

  return (
    <>
      <dl className="record__details">
        {detailRows.map(({ key, label, value }) => (
          <div key={key} className="record__row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {record.completedItems?.length > 0 && (
        <div className="record__checklist">
          <h3 className="record__subtitle">Completed checklist items</h3>
          <ul className="record__list">
            {record.completedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <DefectDetailsDisplay record={record} />

      <RecordSignatureDisplay record={record} />

      {record.photos?.length > 0 && (
        <div className="record__photos">
          <h3 className="record__subtitle">Photos</h3>
          <ul className="photos__thumbs photos__thumbs--record">
            {record.photos.map((photo) => (
              <li key={photo.id} className="photos__thumb">
                <img src={photo.dataUrl} alt={photo.name} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function PrintableRecord({ record }) {
  const detailRows = getRecordDetailRows(record)

  return (
    <article className="print-record">
      <header className="print-record__header">
        <p className="print-record__company">Monrad Earthworx</p>
        <h1 className="print-record__title">{record.formTypeLabel}</h1>
        <p className="print-record__meta">
          Record saved: {formatSubmittedAt(record.submittedAt)}
        </p>
      </header>

      <section className="print-record__section">
        <h2 className="print-record__section-title">Record details</h2>
        <dl className="print-record__details">
          {detailRows.map(({ key, label, value }) => (
            <div key={key} className="print-record__row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {record.totalCount > 0 && (
        <section className="print-record__section">
          <h2 className="print-record__section-title">Completed checklist items</h2>
          <p className="print-record__progress">
            {record.completedCount ?? 0} of {record.totalCount} completed
          </p>
          {record.completedItems?.length > 0 ? (
            <ul className="print-record__checklist">
              {record.completedItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="print-record__empty">No checklist items were completed.</p>
          )}
        </section>
      )}

      {record.formType === 'pre-start' && isSeriousDefect(record) && (
        <section className="print-record__section">
          <DefectWarning />
        </section>
      )}

      {record.formType === 'pre-start' &&
        record.defectsFound === 'found' &&
        record.defectPhotos?.length > 0 && (
          <section className="print-record__section">
            <h2 className="print-record__section-title">Defect photos</h2>
            <div className="print-record__photos">
              {record.defectPhotos.map((photo) => (
                <figure key={photo.id} className="print-record__photo">
                  <img src={photo.dataUrl} alt={photo.name} />
                </figure>
              ))}
            </div>
          </section>
        )}

      {(record.signatureConfirmation || record.signature) && (
        <section className="print-record__section">
          <h2 className="print-record__section-title">
            {record.signatureConfirmation ? 'Signature / Name Confirmation' : 'Signature'}
          </h2>
          {record.signatureConfirmation ? (
            <p className="print-record__signature-text">{record.signatureConfirmation}</p>
          ) : (
            <img src={record.signature} alt="Signature" className="print-record__signature" />
          )}
        </section>
      )}

      {record.photos?.length > 0 && (
        <section className="print-record__section">
          <h2 className="print-record__section-title">Photos</h2>
          <div className="print-record__photos">
            {record.photos.map((photo) => (
              <figure key={photo.id} className="print-record__photo">
                <img src={photo.dataUrl} alt={photo.name} />
              </figure>
            ))}
          </div>
        </section>
      )}

      <footer className="print-record__footer">
        Monrad Earthworx — {record.formTypeLabel} — saved {formatSubmittedAt(record.submittedAt)}
      </footer>
    </article>
  )
}

function RecordActions({ record, onPrint, variant = 'full' }) {
  return (
    <div className={`record__actions no-print record__actions--${variant}`}>
      <button type="button" className="print-record-btn" onClick={() => onPrint(record)}>
        Print Record
      </button>
      {variant === 'full' && (
        <>
          <button type="button" className="action-btn" onClick={() => exportRecordJson(record)}>
            Export JSON
          </button>
          <button type="button" className="action-btn" onClick={() => exportRecordText(record)}>
            Export text
          </button>
        </>
      )}
    </div>
  )
}

const DASHBOARD_CARDS = [
  {
    id: 'job-start',
    title: 'Job Start Checklist',
    description: 'Complete job details and safety checks before work begins.',
    available: true,
  },
  {
    id: 'pre-start',
    title: 'Machine Pre-Start',
    description: 'Daily equipment inspection and pre-start checks.',
    available: true,
  },
  {
    id: 'toolbox',
    title: 'Toolbox Meeting',
    description: 'Record toolbox talks and hazard discussions.',
    available: true,
  },
  {
    id: 'incident',
    title: 'Incident / Near Miss',
    description: 'Report incidents and near misses on site.',
    available: true,
  },
  {
    id: 'timesheet',
    title: 'Timesheet / Daily Work Record',
    description: 'Record daily work hours, machine time, and job details.',
    available: true,
  },
  {
    id: 'action-register',
    title: 'Action Register',
    description: 'Track open actions from forms and add manual items.',
    available: true,
  },
  {
    id: 'records-dashboard',
    title: 'Records Dashboard',
    description: 'Summary of all saved forms and safety actions.',
    available: true,
  },
  {
    id: 'settings',
    title: 'Settings / Setup',
    description: 'Manage operators, machines, and common sites.',
    available: true,
  },
]

function BackButton({ onClick }) {
  return (
    <button type="button" className="back-btn no-print" onClick={onClick}>
      ← Back to Dashboard
    </button>
  )
}

function Dashboard({ onNavigate, recordCount, openActionCount }) {
  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <p className="dashboard__company">Monrad Earthworx</p>
        <h1 className="dashboard__title">Monrad Earthworx H&amp;S App</h1>
        <p className="dashboard__subtitle">Health &amp; safety forms for the field</p>
      </header>

      <nav className="dashboard__nav" aria-label="Form types">
        {DASHBOARD_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            className={
              card.id === 'action-register'
                ? 'dashboard-card dashboard-card--register'
                : card.id === 'records-dashboard'
                  ? 'dashboard-card dashboard-card--records'
                  : card.id === 'settings'
                    ? 'dashboard-card dashboard-card--settings'
                    : 'dashboard-card'
            }
            onClick={() => onNavigate(card.id)}
          >
            <span className="dashboard-card__title">{card.title}</span>
            <span className="dashboard-card__description">{card.description}</span>
            {!card.available && <span className="dashboard-card__badge">Coming soon</span>}
            {card.id === 'action-register' && openActionCount > 0 && (
              <span className="dashboard-card__count">{openActionCount} open</span>
            )}
          </button>
        ))}
      </nav>

      {recordCount > 0 && (
        <p className="dashboard__records-hint">
          {recordCount} saved record{recordCount === 1 ? '' : 's'} on this device
        </p>
      )}

      {openActionCount > 0 && (
        <p className="dashboard__actions-hint">
          {openActionCount} open action{openActionCount === 1 ? '' : 's'} in the register
        </p>
      )}

      <p className="coming-soon dashboard__footer">
        Cloud sync &amp; login — coming soon (local storage only for now).
      </p>
    </div>
  )
}

function createEmptyManualAction() {
  return {
    date: TODAY(),
    site: '',
    description: '',
    personResponsible: '',
    dueDate: '',
    notes: '',
  }
}

function ActionCard({ action, onUpdate, onComplete }) {
  const overdue = isOverdue(action)
  const serious = action.serious && action.status !== 'completed'
  const cardClass = [
    'action-card',
    action.status === 'completed' ? 'action-card--completed' : '',
    overdue ? 'action-card--overdue' : '',
    serious && !overdue ? 'action-card--serious' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li className={cardClass}>
      <div className="action-card__header">
        <span className="type-badge type-badge--small">
          {SOURCE_TYPE_LABELS[action.sourceType] ?? action.sourceType}
        </span>
        {action.status !== 'completed' && (overdue || serious) && (
          <span className="action-card__warning">{overdue ? 'Overdue' : 'Serious'}</span>
        )}
        <span className={`action-status action-status--${action.status}`}>
          {ACTION_STATUS_LABELS[action.status] ?? action.status}
        </span>
      </div>

      <dl className="action-card__details">
        <SummaryRow label="Date" value={action.date} />
        <SummaryRow label="Site / location" value={action.site} />
        <SummaryRow label="Description" value={action.description} />
        <SummaryRow label="Person responsible" value={action.personResponsible} />
        <SummaryRow label="Due / follow-up" value={action.dueDate} />
      </dl>

      {action.status !== 'completed' && (
        <>
          <label className="field action-card__status-field">
            <span className="field__label">Update status</span>
            <select
              className="field__input"
              value={action.status}
              onChange={(e) => onUpdate(action.id, { status: e.target.value })}
            >
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          <button
            type="button"
            className="action-card__complete-btn"
            onClick={() => onComplete(action.id)}
          >
            Mark as completed
          </button>
        </>
      )}

      <label className="field">
        <span className="field__label">Notes</span>
        <textarea
          className="field__input field__textarea"
          defaultValue={action.notes}
          onBlur={(e) => {
            if (e.target.value !== action.notes) {
              onUpdate(action.id, { notes: e.target.value })
            }
          }}
          rows={2}
          placeholder="Add notes..."
        />
      </label>
    </li>
  )
}

function ActionRegisterView({ onBack, actions, setActions }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [manualDraft, setManualDraft] = useState(createEmptyManualAction)
  const [validationError, setValidationError] = useState(null)

  const openActions = actions.filter((action) => action.status !== 'completed')
  const completedActions = actions.filter((action) => action.status === 'completed')

  function updateActions(next) {
    if (!persistActions(next)) return false
    setActions(next)
    return true
  }

  function handleUpdateAction(actionId, updates) {
    const next = actions.map((action) =>
      action.id === actionId ? normalizeAction({ ...action, ...updates }) : action,
    )
    updateActions(next)
  }

  function handleCompleteAction(actionId) {
    handleUpdateAction(actionId, { status: 'completed' })
  }

  function handleAddManualAction(event) {
    event.preventDefault()
    if (!manualDraft.description.trim()) {
      setValidationError('Description is required for a new action.')
      return
    }

    const newAction = normalizeAction({
      id: createRecordId(),
      sourceType: 'manual',
      sourceRecordId: null,
      date: manualDraft.date || TODAY(),
      site: manualDraft.site.trim(),
      description: manualDraft.description.trim(),
      personResponsible: manualDraft.personResponsible.trim(),
      dueDate: manualDraft.dueDate,
      status: 'open',
      notes: manualDraft.notes.trim(),
      createdAt: new Date().toISOString(),
      autoCreated: false,
      serious: false,
    })

    if (!updateActions([newAction, ...actions])) return
    setManualDraft(createEmptyManualAction())
    setShowAddForm(false)
    setValidationError(null)
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">Action Register</h1>
        <p className="progress" aria-live="polite">
          {openActions.length} open · {completedActions.length} completed
        </p>
      </header>

      <section className="actions-register" aria-labelledby="actions-open-heading">
        <div className="actions-register__toolbar">
          <h2 id="actions-open-heading" className="actions-register__title">
            Open actions
          </h2>
          <button
            type="button"
            className="action-btn action-btn--primary"
            onClick={() => {
              setShowAddForm((prev) => !prev)
              setValidationError(null)
            }}
          >
            {showAddForm ? 'Cancel' : 'Add action'}
          </button>
        </div>

        {showAddForm && (
          <form className="action-form" onSubmit={handleAddManualAction} noValidate>
            <fieldset className="job-form__fieldset">
              <legend className="job-form__legend">New manual action</legend>
              <DateField
                label="Date"
                field="date"
                value={manualDraft.date}
                onChange={(_, value) => setManualDraft((prev) => ({ ...prev, date: value }))}
              />
              <TextField
                label="Site / job location"
                field="site"
                value={manualDraft.site}
                onChange={(_, value) => setManualDraft((prev) => ({ ...prev, site: value }))}
                placeholder="Site or job name"
              />
              <label className="field">
                <span className="field__label">Description</span>
                <textarea
                  className="field__input field__textarea"
                  value={manualDraft.description}
                  onChange={(e) =>
                    setManualDraft((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe the action required..."
                  rows={3}
                  required
                />
              </label>
              <TextField
                label="Person responsible"
                field="personResponsible"
                value={manualDraft.personResponsible}
                onChange={(_, value) =>
                  setManualDraft((prev) => ({ ...prev, personResponsible: value }))
                }
                placeholder="Who is responsible?"
              />
              <DateField
                label="Due / follow-up date"
                field="dueDate"
                value={manualDraft.dueDate}
                onChange={(_, value) => setManualDraft((prev) => ({ ...prev, dueDate: value }))}
              />
              <label className="field">
                <span className="field__label">Notes</span>
                <textarea
                  className="field__input field__textarea"
                  value={manualDraft.notes}
                  onChange={(e) => setManualDraft((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes..."
                  rows={2}
                />
              </label>
            </fieldset>

            {validationError && (
              <p className="validation-message" role="alert">
                {validationError}
              </p>
            )}

            <button type="submit" className="submit-btn">
              Save action
            </button>
          </form>
        )}

        {openActions.length === 0 ? (
          <p className="actions-register__empty">
            No open actions. Actions are created automatically from pre-start defects, incident
            corrective actions, and toolbox controls — or add one manually.
          </p>
        ) : (
          <ul className="actions-register__list">
            {openActions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onUpdate={handleUpdateAction}
                onComplete={handleCompleteAction}
              />
            ))}
          </ul>
        )}
      </section>

      {completedActions.length > 0 && (
        <details className="actions-completed">
          <summary className="actions-completed__summary">
            Completed actions ({completedActions.length})
          </summary>
          <ul className="actions-register__list">
            {completedActions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onUpdate={handleUpdateAction}
                onComplete={handleCompleteAction}
              />
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

function RecordsDashboardView({
  onBack,
  onNavigate,
  savedRecords,
  actions,
  setPrintRecord,
  onViewRecord,
}) {
  const stats = getRecordsDashboardStats(savedRecords, actions)
  const allItems = useMemo(() => buildSearchableItems(savedRecords, actions), [savedRecords, actions])

  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [openActionsOnly, setOpenActionsOnly] = useState(false)
  const [defectsOnly, setDefectsOnly] = useState(false)
  const [incidentsOnly, setIncidentsOnly] = useState(false)

  const filteredItems = useMemo(
    () =>
      filterSearchItems(allItems, {
        searchQuery,
        typeFilter,
        dateFilter,
        openActionsOnly,
        defectsOnly,
        incidentsOnly,
      }),
    [allItems, searchQuery, typeFilter, dateFilter, openActionsOnly, defectsOnly, incidentsOnly],
  )

  const hasActiveFilters =
    searchQuery.trim() ||
    typeFilter !== 'all' ||
    dateFilter ||
    openActionsOnly ||
    defectsOnly ||
    incidentsOnly

  function clearFilters() {
    setSearchQuery('')
    setTypeFilter('all')
    setDateFilter('')
    setOpenActionsOnly(false)
    setDefectsOnly(false)
    setIncidentsOnly(false)
  }

  function handleViewItem(item) {
    if (item.itemType === 'action') {
      onNavigate('action-register')
      return
    }
    onViewRecord?.(item.record)
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">Records Dashboard</h1>
        <p className="progress" aria-live="polite">
          {savedRecords.length} saved record{savedRecords.length === 1 ? '' : 's'} ·{' '}
          {actions.length} action{actions.length === 1 ? '' : 's'}
        </p>
      </header>

      <section className="safety-summary" aria-labelledby="safety-summary-heading">
        <h2 id="safety-summary-heading" className="safety-summary__title">
          Safety summary
        </h2>
        <dl className="safety-summary__grid">
          <div className="safety-summary__item safety-summary__item--alert">
            <dt>Open actions</dt>
            <dd>{stats.openActions}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--complete">
            <dt>Completed actions</dt>
            <dd>{stats.completedActions}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--alert">
            <dt>Machine defects recorded</dt>
            <dd>{stats.defectCount}</dd>
          </div>
          <div className="safety-summary__item">
            <dt>Incident / near miss reports</dt>
            <dd>{stats.incidentCount}</dd>
          </div>
        </dl>
      </section>

      <section className="records-search" aria-labelledby="records-search-heading">
        <div className="records-search__header">
          <h2 id="records-search-heading" className="records-summary__title">
            Search &amp; filter
          </h2>
          {hasActiveFilters && (
            <button type="button" className="records-search__clear" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        <label className="field records-search__query">
          <span className="field__label">Search</span>
          <input
            type="search"
            className="field__input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Job name, site, operator, machine, notes, actions..."
          />
        </label>

        <div className="records-search__filters">
          <label className="field records-search__filter">
            <span className="field__label">Record type</span>
            <select
              className="field__input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="job-start">Job Start</option>
              <option value="pre-start">Pre-Start</option>
              <option value="toolbox">Toolbox</option>
              <option value="incident">Incident</option>
              <option value="timesheet">Timesheet</option>
              <option value="action">Actions</option>
            </select>
          </label>

          <label className="field records-search__filter">
            <span className="field__label">Date</span>
            <input
              type="date"
              className="field__input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </label>
        </div>

        <div className="records-search__toggles">
          <label className="records-search__toggle">
            <input
              type="checkbox"
              checked={openActionsOnly}
              onChange={(e) => setOpenActionsOnly(e.target.checked)}
            />
            <span>Open actions only</span>
          </label>
          <label className="records-search__toggle">
            <input
              type="checkbox"
              checked={defectsOnly}
              onChange={(e) => setDefectsOnly(e.target.checked)}
            />
            <span>Machine defects only</span>
          </label>
          <label className="records-search__toggle">
            <input
              type="checkbox"
              checked={incidentsOnly}
              onChange={(e) => setIncidentsOnly(e.target.checked)}
            />
            <span>Incidents / near misses only</span>
          </label>
        </div>

        <p className="records-search__count" aria-live="polite">
          {filteredItems.length} result{filteredItems.length === 1 ? '' : 's'}
          {hasActiveFilters ? ' matching filters' : ''}
        </p>

        {filteredItems.length === 0 ? (
          <p className="records-search__empty">
            No records match your search and filters. Try different keywords or clear filters.
          </p>
        ) : (
          <ul className="records-search__results">
            {filteredItems.map((item) => (
              <li
                key={item.id}
                className={[
                  'search-result',
                  item.itemType === 'action' && item.isOpenAction ? 'search-result--open' : '',
                  item.hasDefect ? 'search-result--defect' : '',
                  item.action?.status === 'completed' ? 'search-result--completed' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="search-result__header">
                  <span className="type-badge type-badge--small">{item.typeLabel}</span>
                  {item.status && (
                    <span
                      className={
                        item.itemType === 'action'
                          ? `action-status action-status--${item.action.status}`
                          : 'search-result__status'
                      }
                    >
                      {item.status}
                    </span>
                  )}
                </div>
                <p className="search-result__title">{item.title}</p>
                <dl className="search-result__meta">
                  <div className="search-result__row">
                    <dt>Date</dt>
                    <dd>{item.date || (item.submittedAt ? formatSubmittedAt(item.submittedAt) : '—')}</dd>
                  </div>
                  <div className="search-result__row">
                    <dt>Site</dt>
                    <dd>{item.site || '—'}</dd>
                  </div>
                </dl>
                <div className="search-result__actions">
                  {item.itemType === 'record' && (
                    <button
                      type="button"
                      className="print-record-btn"
                      onClick={() => setPrintRecord(item.record)}
                    >
                      Print Record
                    </button>
                  )}
                  <button
                    type="button"
                    className="records-summary-card__btn"
                    onClick={() => handleViewItem(item)}
                  >
                    View
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="records-summary" aria-labelledby="records-summary-heading">
        <h2 id="records-summary-heading" className="records-summary__title">
          Records by type
        </h2>
        <ul className="records-summary__list">
          {stats.sections.map((section) => (
            <li key={section.id} className="records-summary-card">
              <div className="records-summary-card__content">
                <h3 className="records-summary-card__title">{section.title}</h3>
                <p className="records-summary-card__count">
                  {section.id === 'action-register'
                    ? `${section.count} action${section.count === 1 ? '' : 's'}`
                    : `${section.count} saved record${section.count === 1 ? '' : 's'}`}
                </p>
                {section.recentDate ? (
                  <p className="records-summary-card__recent">Most recent: {section.recentDate}</p>
                ) : (
                  <p className="records-summary-card__recent records-summary-card__recent--empty">
                    No records yet
                  </p>
                )}
              </div>
              <button
                type="button"
                className="records-summary-card__btn"
                onClick={() => onNavigate(section.id)}
              >
                View records
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function SettingsListItem({ title, subtitle, onDelete }) {
  return (
    <li className="settings-list__item">
      <div className="settings-list__content">
        <p className="settings-list__title">{title}</p>
        {subtitle && <p className="settings-list__subtitle">{subtitle}</p>}
      </div>
      <button type="button" className="settings-list__delete" onClick={onDelete}>
        Delete
      </button>
    </li>
  )
}

function SettingsView({ onBack, settings, setSettings }) {
  const [operatorName, setOperatorName] = useState('')
  const [machineName, setMachineName] = useState('')
  const [machineType, setMachineType] = useState('Excavator')
  const [siteName, setSiteName] = useState('')

  function updateSettings(next) {
    if (!persistSettings(next)) return false
    setSettings(next)
    return true
  }

  function handleAddOperator(event) {
    event.preventDefault()
    const name = operatorName.trim()
    if (!name) return
    if (settings.operators.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      window.alert('This operator is already in the list.')
      return
    }
    updateSettings({
      ...settings,
      operators: [...settings.operators, { id: createRecordId(), name }],
    })
    setOperatorName('')
  }

  function handleAddMachine(event) {
    event.preventDefault()
    const name = machineName.trim()
    if (!name) return
    if (settings.machines.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      window.alert('This machine is already in the list.')
      return
    }
    updateSettings({
      ...settings,
      machines: [...settings.machines, { id: createRecordId(), name, type: machineType }],
    })
    setMachineName('')
    setMachineType('Excavator')
  }

  function handleAddSite(event) {
    event.preventDefault()
    const name = siteName.trim()
    if (!name) return
    if (settings.sites.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      window.alert('This site is already in the list.')
      return
    }
    updateSettings({
      ...settings,
      sites: [...settings.sites, { id: createRecordId(), name }],
    })
    setSiteName('')
  }

  function deleteOperator(id) {
    updateSettings({
      ...settings,
      operators: settings.operators.filter((item) => item.id !== id),
    })
  }

  function deleteMachine(id) {
    updateSettings({
      ...settings,
      machines: settings.machines.filter((item) => item.id !== id),
    })
  }

  function deleteSite(id) {
    updateSettings({
      ...settings,
      sites: settings.sites.filter((item) => item.id !== id),
    })
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">Settings / Setup</h1>
        <p className="progress">Operators, machines, and sites for quick form entry</p>
      </header>

      <section className="settings-section" aria-labelledby="settings-operators-heading">
        <h2 id="settings-operators-heading" className="settings-section__title">
          1. Operators / staff
        </h2>
        <form className="settings-form" onSubmit={handleAddOperator}>
          <label className="field">
            <span className="field__label">Add operator name</span>
            <input
              type="text"
              className="field__input"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="e.g. John Smith"
            />
          </label>
          <button type="submit" className="action-btn action-btn--primary">
            Add operator
          </button>
        </form>
        {settings.operators.length === 0 ? (
          <p className="settings-section__empty">No operators saved yet.</p>
        ) : (
          <ul className="settings-list">
            {settings.operators.map((item) => (
              <SettingsListItem
                key={item.id}
                title={item.name}
                onDelete={() => deleteOperator(item.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="settings-section" aria-labelledby="settings-machines-heading">
        <h2 id="settings-machines-heading" className="settings-section__title">
          2. Machines
        </h2>
        <form className="settings-form" onSubmit={handleAddMachine}>
          <label className="field">
            <span className="field__label">Machine name / ID</span>
            <input
              type="text"
              className="field__input"
              value={machineName}
              onChange={(e) => setMachineName(e.target.value)}
              placeholder="e.g. EX-01"
            />
          </label>
          <label className="field">
            <span className="field__label">Machine type</span>
            <select
              className="field__input"
              value={machineType}
              onChange={(e) => setMachineType(e.target.value)}
            >
              {MACHINE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="action-btn action-btn--primary">
            Add machine
          </button>
        </form>
        {settings.machines.length === 0 ? (
          <p className="settings-section__empty">No machines saved yet.</p>
        ) : (
          <ul className="settings-list">
            {settings.machines.map((item) => (
              <SettingsListItem
                key={item.id}
                title={item.name}
                subtitle={item.type}
                onDelete={() => deleteMachine(item.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="settings-section" aria-labelledby="settings-sites-heading">
        <h2 id="settings-sites-heading" className="settings-section__title">
          3. Common sites / locations
        </h2>
        <form className="settings-form" onSubmit={handleAddSite}>
          <label className="field">
            <span className="field__label">Add site name</span>
            <input
              type="text"
              className="field__input"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="e.g. Riverside subdivision"
            />
          </label>
          <button type="submit" className="action-btn action-btn--primary">
            Add site
          </button>
        </form>
        {settings.sites.length === 0 ? (
          <p className="settings-section__empty">No sites saved yet.</p>
        ) : (
          <ul className="settings-list">
            {settings.sites.map((item) => (
              <SettingsListItem
                key={item.id}
                title={item.name}
                onDelete={() => deleteSite(item.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="form-hint">
        Saved lists appear as suggestions on forms. You can still type any value manually.
      </p>
    </>
  )
}

function ComingSoonView({ title, onBack }) {
  return (
    <div className="placeholder-view">
      <BackButton onClick={onBack} />
      <header className="header">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">{title}</h1>
      </header>
      <div className="placeholder-view__content">
        <p className="placeholder-view__label">Coming soon</p>
        <p className="placeholder-view__text">
          This form is not available yet. Job Start Checklist is ready to use now.
        </p>
      </div>
    </div>
  )
}

function JobStartView({
  onBack,
  savedRecords,
  setSavedRecords,
  setPrintRecord,
  highlightRecordId,
  onClearHighlight,
  settings,
}) {
  const formConfig = FORM_TYPES['job-start']
  const [draft, setDraft] = useState(() => createEmptyDraft('job-start'))
  const [completedRecord, setCompletedRecord] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [recordFilter, setRecordFilter] = useState('job-start')
  const recordRef = useRef(null)

  const { fields, checked, signatureConfirmation, photos } = draft
  const comboOptions = getSettingsOptions(settings)
  const checklist = formConfig.checklist
  const total = checklist.length
  const completed = checked.size
  const allComplete = completed === total

  const filteredRecords =
    recordFilter === 'all'
      ? savedRecords
      : savedRecords.filter((record) => record.formType === recordFilter)

  useHighlightRecord(highlightRecordId, onClearHighlight, [filteredRecords])

  useEffect(() => {
    if (completedRecord && recordRef.current) {
      recordRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [completedRecord])

  function updateDraft(updates) {
    setDraft((prev) => ({ ...prev, ...updates }))
  }

  function updateField(field, value) {
    setValidationError(null)
    updateDraft({ fields: { ...fields, [field]: value } })
  }

  function toggleItem(index) {
    const next = new Set(checked)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    updateDraft({ checked: next })
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (!signatureConfirmation.trim()) {
      setValidationError('Signature / Name Confirmation is required before saving.')
      return
    }

    setValidationError(null)
    const completedItems = checklist.filter((_, index) => checked.has(index))
    const submittedAt = new Date().toISOString()
    const record = {
      id: createRecordId(),
      formType: 'job-start',
      formTypeLabel: formConfig.title,
      fields: { ...fields },
      completedItems,
      completedCount: completed,
      totalCount: total,
      allComplete,
      signatureConfirmation: signatureConfirmation.trim(),
      photos,
      submittedAt,
    }

    const nextRecords = [record, ...savedRecords]
    if (!persistSavedRecords(nextRecords)) return
    setSavedRecords(nextRecords)
    setCompletedRecord(record)
  }

  function handleReset() {
    setDraft(createEmptyDraft('job-start'))
    setCompletedRecord(null)
    setValidationError(null)
  }

  function handleClearAllRecords() {
    if (savedRecords.length === 0) return
    const confirmed = window.confirm(
      'Delete all saved records from this device? This cannot be undone.',
    )
    if (!confirmed) return
    if (!persistSavedRecords([])) return
    setSavedRecords([])
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header no-print">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">{formConfig.title}</h1>
        <p className="progress" aria-live="polite">
          {completed} of {total} completed
        </p>
      </header>

      <form className="job-form no-print" onSubmit={handleSubmit} noValidate>
        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">1. Job details</legend>
          <TextField label="Job name" field="jobName" value={fields.jobName} onChange={updateField} placeholder="e.g. Driveway excavation" />
          <ComboField label="Site location" field="siteLocation" value={fields.siteLocation} onChange={updateField} placeholder="Address or site name" options={comboOptions.sites} listId="job-start-sites" />
          <ComboField label="Employee / operator name" field="employeeName" value={fields.employeeName} onChange={updateField} placeholder="Your name" options={comboOptions.operators} listId="job-start-operators" />
          <ComboField label="Machine used" field="machineUsed" value={fields.machineUsed} onChange={updateField} placeholder="e.g. 5T excavator" options={comboOptions.machines} listId="job-start-machines" />
          <DateField value={fields.date} onChange={updateField} />
          <NotesField value={fields.notes} onChange={updateField} />
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">2. Safety checklist</legend>
          <ul className="checklist" role="list">
            {checklist.map((label, index) => {
              const isChecked = checked.has(index)
              return (
                <li key={label} className={isChecked ? 'item item--checked' : 'item'}>
                  <label className="item__label">
                    <input
                      type="checkbox"
                      className="item__checkbox"
                      checked={isChecked}
                      onChange={() => toggleItem(index)}
                    />
                    <span className="item__text">{label}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">3. Name confirmation &amp; photos</legend>
          <SignatureConfirmationField
            value={signatureConfirmation}
            onChange={(value) => {
              setValidationError(null)
              updateDraft({ signatureConfirmation: value })
            }}
          />
          <PhotoUpload photos={photos} onChange={(value) => updateDraft({ photos: value })} />
        </fieldset>

        {allComplete && (
          <p className="complete-message" role="status">
            Checklist complete. Job can begin.
          </p>
        )}

        {validationError && (
          <p className="validation-message" role="alert">
            {validationError}
          </p>
        )}

        <p className="form-hint">Fill in job details, tick each safety item, then save your completed record.</p>

        <button type="submit" className="submit-btn">
          Save completed record
        </button>
      </form>

      {completedRecord && (
        <section ref={recordRef} className="record no-print" aria-labelledby="record-heading" role="region">
          <div className="record__header">
            <div>
              <span className="type-badge">{completedRecord.formTypeLabel}</span>
              <h2 id="record-heading" className="record__title">
                Completed record
              </h2>
              <p className="record__meta">Saved {formatSubmittedAt(completedRecord.submittedAt)}</p>
            </div>
            <span
              className={
                completedRecord.allComplete
                  ? 'record__badge record__badge--complete'
                  : 'record__badge record__badge--partial'
              }
            >
              {completedRecord.allComplete ? 'All checks done' : 'Partial'}
            </span>
          </div>

          <p className="record__saved" role="status">
            Record saved to this device. Review the details below.
          </p>

          <RecordDetails record={completedRecord} />
          <RecordActions record={completedRecord} onPrint={setPrintRecord} />
        </section>
      )}

      <button type="button" className="reset-btn no-print" onClick={handleReset}>
        Reset form
      </button>
      {completedRecord && (
        <p className="reset-hint no-print">Clears the current form and record view.</p>
      )}

      <section className="saved-records no-print" aria-labelledby="saved-records-heading">
        <div className="saved-records__header">
          <div>
            <h2 id="saved-records-heading" className="saved-records__title">
              Saved records
            </h2>
            <p className="saved-records__count">
              {savedRecords.length} record{savedRecords.length === 1 ? '' : 's'} on this device
            </p>
          </div>
          {savedRecords.length > 0 && (
            <button type="button" className="saved-records__clear" onClick={handleClearAllRecords}>
              Clear all
            </button>
          )}
        </div>

        <div className="saved-records__filters" role="tablist" aria-label="Filter records">
          <button
            type="button"
            className={recordFilter === 'all' ? 'filter-btn filter-btn--active' : 'filter-btn'}
            onClick={() => setRecordFilter('all')}
          >
            All
          </button>
          {Object.values(FORM_TYPES).map((type) => (
            <button
              key={type.id}
              type="button"
              className={recordFilter === type.id ? 'filter-btn filter-btn--active' : 'filter-btn'}
              onClick={() => setRecordFilter(type.id)}
            >
              {type.label}
            </button>
          ))}
        </div>

        {filteredRecords.length === 0 ? (
          <p className="saved-records__empty">
            {savedRecords.length === 0
              ? 'No saved records yet. Submit a completed checklist to save one here.'
              : 'No records match this filter.'}
          </p>
        ) : (
          <ul className="saved-records__list">
            {filteredRecords.map((record) => (
              <li key={record.id} data-record-id={record.id} className="saved-record">
                <div className="saved-record__header">
                  <span className="type-badge type-badge--small">{record.formTypeLabel}</span>
                  <p className="saved-record__title">{getRecordTitle(record)}</p>
                </div>
                <dl className="saved-record__details">
                  {record.formType === 'job-start' && (
                    <>
                      <SummaryRow label="Site" value={record.fields.siteLocation} />
                      <SummaryRow label="Operator" value={record.fields.employeeName} />
                      <SummaryRow label="Machine" value={record.fields.machineUsed} />
                    </>
                  )}
                  {record.formType === 'pre-start' && (
                    <>
                      <SummaryRow label="Operator" value={record.fields.operatorName ?? record.fields.operator} />
                      <SummaryRow label="Machine" value={record.fields.machineNameId ?? record.fields.machine} />
                      <SummaryRow label="Site" value={record.fields.siteLocation} />
                      <SummaryRow label="Hours" value={record.fields.machineHours ?? record.fields.hourMeter} />
                    </>
                  )}
                  {record.formType === 'toolbox' && (
                    <>
                      <SummaryRow label="Site" value={record.fields.siteLocation} />
                      <SummaryRow label="Led by" value={record.fields.meetingLedBy ?? record.fields.facilitator} />
                      <SummaryRow label="Attendees" value={record.fields.attendees} />
                    </>
                  )}
                  {record.formType === 'incident' && (
                    <>
                      <SummaryRow label="Type" value={formatReportType(record.fields.reportType)} />
                      <SummaryRow label="Site" value={record.fields.siteLocation ?? record.fields.location} />
                      <SummaryRow label="Reported by" value={record.fields.reportedBy} />
                    </>
                  )}
                  {record.formType === 'timesheet' && (
                    <>
                      <SummaryRow label="Employee" value={record.fields.employeeName} />
                      <SummaryRow label="Job" value={record.fields.jobProjectName} />
                      <SummaryRow label="Site" value={record.fields.siteLocation} />
                      <SummaryRow label="Hours" value={record.fields.totalHoursWorked} />
                    </>
                  )}
                  <SummaryRow label="Date" value={record.fields.date} />
                  {record.totalCount > 0 && (
                    <SummaryRow
                      label="Checklist"
                      value={`${record.completedCount} of ${record.totalCount} completed`}
                    />
                  )}
                  <SummaryRow label="Notes" value={record.fields.notes} />
                </dl>

                <SavedRecordSignature record={record} />

                {record.photos?.length > 0 && (
                  <ul className="photos__thumbs photos__thumbs--compact">
                    {record.photos.map((photo) => (
                      <li key={photo.id} className="photos__thumb">
                        <img src={photo.dataUrl} alt={photo.name} />
                      </li>
                    ))}
                  </ul>
                )}

                <p className="saved-record__meta">Saved {formatSubmittedAt(record.submittedAt)}</p>
                <RecordActions record={record} onPrint={setPrintRecord} variant="saved" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function PreStartView({
  onBack,
  savedRecords,
  setSavedRecords,
  setPrintRecord,
  onRecordSaved,
  highlightRecordId,
  onClearHighlight,
  settings,
}) {
  const formConfig = FORM_TYPES['pre-start']
  const [draft, setDraft] = useState(() => createEmptyDraft('pre-start'))
  const [completedRecord, setCompletedRecord] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const recordRef = useRef(null)

  const {
    fields,
    checked,
    signatureConfirmation,
    photos,
    defectsFound,
    defectDescription,
    defectSeverity,
    machineOperableSafely,
    actionRequired,
    reportedTo,
    defectPhotos,
  } = draft
  const comboOptions = getSettingsOptions(settings)
  const checklist = formConfig.checklist
  const total = checklist.length
  const completed = checked.size
  const allComplete = completed === total
  const defectsSelected = defectsFound === 'found'
  const showDefectWarning =
    defectsSelected &&
    (defectSeverity === 'critical' || machineOperableSafely === 'no')

  const preStartRecords = savedRecords.filter((record) => record.formType === 'pre-start')

  useHighlightRecord(highlightRecordId, onClearHighlight, [preStartRecords])

  useEffect(() => {
    if (completedRecord && recordRef.current) {
      recordRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [completedRecord])

  function updateDraft(updates) {
    setDraft((prev) => ({ ...prev, ...updates }))
  }

  function updateField(field, value) {
    setValidationError(null)
    updateDraft({ fields: { ...fields, [field]: value } })
  }

  function toggleItem(index) {
    const next = new Set(checked)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    updateDraft({ checked: next })
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (!fields.operatorName.trim() || !fields.machineNameId.trim()) {
      setValidationError('Operator name and machine name / ID are required before saving.')
      return
    }

    if (!signatureConfirmation.trim()) {
      setValidationError('Signature / Name Confirmation is required before saving.')
      return
    }

    if (defectsSelected) {
      if (!defectDescription.trim()) {
        setValidationError('Defect description is required when defects are found.')
        return
      }
      if (!defectSeverity) {
        setValidationError('Defect severity is required when defects are found.')
        return
      }
      if (!machineOperableSafely) {
        setValidationError(
          'Please indicate whether the machine can still be operated safely.',
        )
        return
      }
    }

    setValidationError(null)
    const completedItems = checklist.filter((_, index) => checked.has(index))
    const submittedAt = new Date().toISOString()
    const record = {
      id: createRecordId(),
      formType: 'pre-start',
      formTypeLabel: formConfig.title,
      fields: { ...fields },
      completedItems,
      completedCount: completed,
      totalCount: total,
      allComplete,
      signatureConfirmation: signatureConfirmation.trim(),
      photos,
      defectsFound,
      submittedAt,
      ...(defectsSelected
        ? {
            defectDescription: defectDescription.trim(),
            defectSeverity,
            machineOperableSafely,
            actionRequired: actionRequired.trim(),
            reportedTo: reportedTo.trim(),
            defectPhotos,
          }
        : {}),
    }

    const nextRecords = [record, ...savedRecords]
    if (!persistSavedRecords(nextRecords)) return
    setSavedRecords(nextRecords)
    setCompletedRecord(record)
    onRecordSaved?.(record)
  }

  function handleReset() {
    setDraft(createEmptyDraft('pre-start'))
    setCompletedRecord(null)
    setValidationError(null)
  }

  function handleClearPreStartRecords() {
    if (preStartRecords.length === 0) return
    const confirmed = window.confirm(
      'Delete all saved pre-start records? Other saved records will be kept.',
    )
    if (!confirmed) return
    setSavedRecords((prev) => {
      const next = prev.filter((record) => record.formType !== 'pre-start')
      return persistSavedRecords(next) ? next : prev
    })
    if (completedRecord) setCompletedRecord(null)
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header no-print">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">{formConfig.title}</h1>
        <p className="progress" aria-live="polite">
          {completed} of {total} completed
        </p>
      </header>

      <form className="job-form no-print" onSubmit={handleSubmit} noValidate>
        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">1. Pre-start details</legend>
          <DateField value={fields.date} onChange={updateField} />
          <ComboField label="Operator name" field="operatorName" value={fields.operatorName} onChange={updateField} placeholder="Your name" options={comboOptions.operators} listId="pre-start-operators" />
          <ComboField label="Machine name / ID" field="machineNameId" value={fields.machineNameId} onChange={updateField} placeholder="e.g. EX-01 or 5T excavator" options={comboOptions.machines} listId="pre-start-machines" />
          <TextField label="Machine hours" field="machineHours" value={fields.machineHours} onChange={updateField} placeholder="Current hour meter reading" />
          <ComboField label="Site / job location" field="siteLocation" value={fields.siteLocation} onChange={updateField} placeholder="Site or yard" options={comboOptions.sites} listId="pre-start-sites" />
          <NotesField value={fields.notes} onChange={updateField} />
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">2. Pre-start checklist</legend>
          <ul className="checklist" role="list">
            {checklist.map((label, index) => {
              const isChecked = checked.has(index)
              return (
                <li key={label} className={isChecked ? 'item item--checked' : 'item'}>
                  <label className="item__label">
                    <input
                      type="checkbox"
                      className="item__checkbox"
                      checked={isChecked}
                      onChange={() => toggleItem(index)}
                    />
                    <span className="item__text">{label}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>

        <fieldset className="job-form__fieldset defect-section">
          <legend className="job-form__legend">3. Defect reporting</legend>
          <RadioFieldGroup
            label="Any defects found?"
            name="defectsFound"
            value={defectsFound}
            onChange={(value) => {
              setValidationError(null)
              if (value === 'none') {
                updateDraft({
                  defectsFound: value,
                  defectDescription: '',
                  defectSeverity: '',
                  machineOperableSafely: '',
                  actionRequired: '',
                  reportedTo: '',
                  defectPhotos: [],
                })
              } else {
                updateDraft({ defectsFound: value })
              }
            }}
            options={[
              { value: 'none', label: 'No defects' },
              { value: 'found', label: 'Defects found' },
            ]}
          />

          {defectsSelected && (
            <div className="defect-section__details">
              <label className="field">
                <span className="field__label">Defect description</span>
                <textarea
                  className="field__input field__textarea"
                  value={defectDescription}
                  onChange={(e) => {
                    setValidationError(null)
                    updateDraft({ defectDescription: e.target.value })
                  }}
                  placeholder="Describe the defect..."
                  rows={4}
                />
              </label>

              <SelectField
                label="Severity"
                field="defectSeverity"
                value={defectSeverity}
                onChange={(_, value) => {
                  setValidationError(null)
                  updateDraft({ defectSeverity: value })
                }}
                options={[
                  { value: '', label: 'Select severity...' },
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'critical', label: 'Critical' },
                ]}
              />

              <RadioFieldGroup
                label="Can the machine still be operated safely?"
                name="machineOperableSafely"
                value={machineOperableSafely}
                onChange={(value) => {
                  setValidationError(null)
                  updateDraft({ machineOperableSafely: value })
                }}
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                ]}
              />

              <TextField
                label="Action required"
                field="actionRequired"
                value={actionRequired}
                onChange={(_, value) => updateDraft({ actionRequired: value })}
                placeholder="What action is needed?"
              />
              <TextField
                label="Reported to"
                field="reportedTo"
                value={reportedTo}
                onChange={(_, value) => updateDraft({ reportedTo: value })}
                placeholder="Supervisor or manager name"
              />

              <PhotoUpload
                label={`Defect photos (max ${MAX_PHOTOS})`}
                photos={defectPhotos}
                onChange={(value) => updateDraft({ defectPhotos: value })}
              />

              {showDefectWarning && <DefectWarning />}
            </div>
          )}
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">4. Name confirmation &amp; photos</legend>
          <SignatureConfirmationField
            value={signatureConfirmation}
            onChange={(value) => {
              setValidationError(null)
              updateDraft({ signatureConfirmation: value })
            }}
          />
          <PhotoUpload photos={photos} onChange={(value) => updateDraft({ photos: value })} />
        </fieldset>

        {allComplete && !showDefectWarning && (
          <p className="complete-message" role="status">
            Pre-start complete. Machine safe to operate.
          </p>
        )}

        {validationError && (
          <p className="validation-message" role="alert">
            {validationError}
          </p>
        )}

        <p className="form-hint">
          Enter operator and machine details, complete the checklist, report any defects, then save
          your pre-start record.
        </p>

        <button type="submit" className="submit-btn">
          Save completed record
        </button>
      </form>

      {completedRecord && (
        <section ref={recordRef} className="record no-print" aria-labelledby="prestart-record-heading" role="region">
          <div className="record__header">
            <div>
              <span className="type-badge">{completedRecord.formTypeLabel}</span>
              <h2 id="prestart-record-heading" className="record__title">
                Completed record
              </h2>
              <p className="record__meta">Saved {formatSubmittedAt(completedRecord.submittedAt)}</p>
            </div>
            <span
              className={
                completedRecord.allComplete
                  ? 'record__badge record__badge--complete'
                  : 'record__badge record__badge--partial'
              }
            >
              {completedRecord.allComplete ? 'All checks done' : 'Partial'}
            </span>
          </div>

          <p className="record__saved" role="status">
            Record saved to this device. Review the details below.
          </p>

          <RecordDetails record={completedRecord} />
          <RecordActions record={completedRecord} onPrint={setPrintRecord} />
        </section>
      )}

      <button type="button" className="reset-btn no-print" onClick={handleReset}>
        Reset form
      </button>
      {completedRecord && (
        <p className="reset-hint no-print">Clears the current form and record view.</p>
      )}

      <section className="saved-records no-print" aria-labelledby="prestart-saved-heading">
        <div className="saved-records__header">
          <div>
            <h2 id="prestart-saved-heading" className="saved-records__title">
              Saved pre-start records
            </h2>
            <p className="saved-records__count">
              {preStartRecords.length} record{preStartRecords.length === 1 ? '' : 's'} on this device
            </p>
          </div>
          {preStartRecords.length > 0 && (
            <button type="button" className="saved-records__clear" onClick={handleClearPreStartRecords}>
              Clear all
            </button>
          )}
        </div>

        {preStartRecords.length === 0 ? (
          <p className="saved-records__empty">
            No saved pre-start records yet. Submit a completed checklist to save one here.
          </p>
        ) : (
          <ul className="saved-records__list">
            {preStartRecords.map((record) => (
              <li key={record.id} data-record-id={record.id} className="saved-record">
                <div className="saved-record__header">
                  <span className="type-badge type-badge--small">{record.formTypeLabel}</span>
                  <p className="saved-record__title">{getRecordTitle(record)}</p>
                </div>
                <dl className="saved-record__details">
                  <SummaryRow label="Operator" value={record.fields.operatorName ?? record.fields.operator} />
                  <SummaryRow label="Machine" value={record.fields.machineNameId ?? record.fields.machine} />
                  <SummaryRow label="Site" value={record.fields.siteLocation} />
                  <SummaryRow label="Hours" value={record.fields.machineHours ?? record.fields.hourMeter} />
                  <SummaryRow label="Date" value={record.fields.date} />
                  <SummaryRow
                    label="Checklist"
                    value={`${record.completedCount} of ${record.totalCount} completed`}
                  />
                  <SummaryRow label="Notes" value={record.fields.notes} />
                  {record.defectsFound && (
                    <>
                      <SummaryRow label="Defects" value={formatDefectsFound(record.defectsFound)} />
                      {record.defectsFound === 'found' && (
                        <>
                          <SummaryRow label="Severity" value={formatDefectSeverity(record.defectSeverity)} />
                          <SummaryRow
                            label="Operable safely"
                            value={formatMachineOperable(record.machineOperableSafely)}
                          />
                          <SummaryRow label="Action required" value={record.actionRequired} />
                          <SummaryRow label="Reported to" value={record.reportedTo} />
                        </>
                      )}
                    </>
                  )}
                </dl>

                {record.defectsFound === 'found' && record.defectDescription && (
                  <p className="saved-record__defect-description">{record.defectDescription}</p>
                )}

                {isSeriousDefect(record) && <DefectWarning />}

                <SavedRecordSignature record={record} />

                {record.defectPhotos?.length > 0 && (
                  <ul className="photos__thumbs photos__thumbs--compact">
                    {record.defectPhotos.map((photo) => (
                      <li key={photo.id} className="photos__thumb">
                        <img src={photo.dataUrl} alt={photo.name} />
                      </li>
                    ))}
                  </ul>
                )}

                {record.photos?.length > 0 && (
                  <ul className="photos__thumbs photos__thumbs--compact">
                    {record.photos.map((photo) => (
                      <li key={photo.id} className="photos__thumb">
                        <img src={photo.dataUrl} alt={photo.name} />
                      </li>
                    ))}
                  </ul>
                )}

                <p className="saved-record__meta">Saved {formatSubmittedAt(record.submittedAt)}</p>
                <RecordActions record={record} onPrint={setPrintRecord} variant="saved" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function ToolboxView({
  onBack,
  savedRecords,
  setSavedRecords,
  setPrintRecord,
  onRecordSaved,
  highlightRecordId,
  onClearHighlight,
  settings,
}) {
  const formConfig = FORM_TYPES.toolbox
  const [draft, setDraft] = useState(() => createEmptyDraft('toolbox'))
  const [completedRecord, setCompletedRecord] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const recordRef = useRef(null)

  const { fields, checked, signatureConfirmation, photos } = draft
  const comboOptions = getSettingsOptions(settings)
  const checklist = formConfig.checklist
  const total = checklist.length
  const completed = checked.size
  const allComplete = completed === total

  const toolboxRecords = savedRecords.filter((record) => record.formType === 'toolbox')

  useHighlightRecord(highlightRecordId, onClearHighlight, [toolboxRecords])

  useEffect(() => {
    if (completedRecord && recordRef.current) {
      recordRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [completedRecord])

  function updateDraft(updates) {
    setDraft((prev) => ({ ...prev, ...updates }))
  }

  function updateField(field, value) {
    setValidationError(null)
    updateDraft({ fields: { ...fields, [field]: value } })
  }

  function toggleItem(index) {
    const next = new Set(checked)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    updateDraft({ checked: next })
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (!fields.jobProjectName.trim() || !fields.siteLocation.trim() || !fields.meetingLedBy.trim()) {
      setValidationError('Job / project name, site location, and meeting led by are required before saving.')
      return
    }

    if (!signatureConfirmation.trim()) {
      setValidationError('Signature / Name Confirmation is required before saving.')
      return
    }

    setValidationError(null)
    const completedItems = checklist.filter((_, index) => checked.has(index))
    const submittedAt = new Date().toISOString()
    const record = {
      id: createRecordId(),
      formType: 'toolbox',
      formTypeLabel: formConfig.title,
      fields: { ...fields },
      completedItems,
      completedCount: completed,
      totalCount: total,
      allComplete,
      signatureConfirmation: signatureConfirmation.trim(),
      photos,
      submittedAt,
    }

    const nextRecords = [record, ...savedRecords]
    if (!persistSavedRecords(nextRecords)) return
    setSavedRecords(nextRecords)
    setCompletedRecord(record)
    onRecordSaved?.(record)
  }

  function handleReset() {
    setDraft(createEmptyDraft('toolbox'))
    setCompletedRecord(null)
    setValidationError(null)
  }

  function handleClearToolboxRecords() {
    if (toolboxRecords.length === 0) return
    const confirmed = window.confirm(
      'Delete all saved toolbox records? Other saved records will be kept.',
    )
    if (!confirmed) return
    setSavedRecords((prev) => {
      const next = prev.filter((record) => record.formType !== 'toolbox')
      return persistSavedRecords(next) ? next : prev
    })
    if (completedRecord) setCompletedRecord(null)
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header no-print">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">{formConfig.title}</h1>
        <p className="progress" aria-live="polite">
          {completed} of {total} completed
        </p>
      </header>

      <form className="job-form no-print" onSubmit={handleSubmit} noValidate>
        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">1. Meeting details</legend>
          <DateField value={fields.date} onChange={updateField} />
          <TextField label="Job / project name" field="jobProjectName" value={fields.jobProjectName} onChange={updateField} placeholder="e.g. Riverside subdivision" />
          <ComboField label="Site location" field="siteLocation" value={fields.siteLocation} onChange={updateField} placeholder="Address or site name" options={comboOptions.sites} listId="toolbox-sites" />
          <ComboField label="Meeting led by" field="meetingLedBy" value={fields.meetingLedBy} onChange={updateField} placeholder="Facilitator name" options={comboOptions.operators} listId="toolbox-operators" />
          <TextField label="Attendees" field="attendees" value={fields.attendees} onChange={updateField} placeholder="Names or crew count" />
          <TextField label="Work planned today" field="workPlannedToday" value={fields.workPlannedToday} onChange={updateField} placeholder="Tasks planned for today" />
          <TextField label="Main hazards discussed" field="mainHazardsDiscussed" value={fields.mainHazardsDiscussed} onChange={updateField} placeholder="Key hazards covered" />
          <TextField label="Controls agreed" field="controlsAgreed" value={fields.controlsAgreed} onChange={updateField} placeholder="Agreed control measures" />
          <TextField label="Weather / ground conditions" field="weatherGroundConditions" value={fields.weatherGroundConditions} onChange={updateField} placeholder="e.g. Dry, firm ground" />
          <NotesField value={fields.notes} onChange={updateField} />
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">2. Toolbox checklist</legend>
          <ul className="checklist" role="list">
            {checklist.map((label, index) => {
              const isChecked = checked.has(index)
              return (
                <li key={label} className={isChecked ? 'item item--checked' : 'item'}>
                  <label className="item__label">
                    <input
                      type="checkbox"
                      className="item__checkbox"
                      checked={isChecked}
                      onChange={() => toggleItem(index)}
                    />
                    <span className="item__text">{label}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">3. Name confirmation &amp; photos</legend>
          <SignatureConfirmationField
            value={signatureConfirmation}
            onChange={(value) => {
              setValidationError(null)
              updateDraft({ signatureConfirmation: value })
            }}
          />
          <PhotoUpload photos={photos} onChange={(value) => updateDraft({ photos: value })} />
        </fieldset>

        {allComplete && (
          <p className="complete-message" role="status">
            Toolbox complete. Everyone understands the work plan.
          </p>
        )}

        {validationError && (
          <p className="validation-message" role="alert">
            {validationError}
          </p>
        )}

        <p className="form-hint">
          Record meeting details, complete the checklist, then save your toolbox record.
        </p>

        <button type="submit" className="submit-btn">
          Save completed record
        </button>
      </form>

      {completedRecord && (
        <section ref={recordRef} className="record no-print" aria-labelledby="toolbox-record-heading" role="region">
          <div className="record__header">
            <div>
              <span className="type-badge">{completedRecord.formTypeLabel}</span>
              <h2 id="toolbox-record-heading" className="record__title">
                Completed record
              </h2>
              <p className="record__meta">Saved {formatSubmittedAt(completedRecord.submittedAt)}</p>
            </div>
            <span
              className={
                completedRecord.allComplete
                  ? 'record__badge record__badge--complete'
                  : 'record__badge record__badge--partial'
              }
            >
              {completedRecord.allComplete ? 'All checks done' : 'Partial'}
            </span>
          </div>

          <p className="record__saved" role="status">
            Record saved to this device. Review the details below.
          </p>

          <RecordDetails record={completedRecord} />
          <RecordActions record={completedRecord} onPrint={setPrintRecord} />
        </section>
      )}

      <button type="button" className="reset-btn no-print" onClick={handleReset}>
        Reset form
      </button>
      {completedRecord && (
        <p className="reset-hint no-print">Clears the current form and record view.</p>
      )}

      <section className="saved-records no-print" aria-labelledby="toolbox-saved-heading">
        <div className="saved-records__header">
          <div>
            <h2 id="toolbox-saved-heading" className="saved-records__title">
              Saved toolbox records
            </h2>
            <p className="saved-records__count">
              {toolboxRecords.length} record{toolboxRecords.length === 1 ? '' : 's'} on this device
            </p>
          </div>
          {toolboxRecords.length > 0 && (
            <button type="button" className="saved-records__clear" onClick={handleClearToolboxRecords}>
              Clear all
            </button>
          )}
        </div>

        {toolboxRecords.length === 0 ? (
          <p className="saved-records__empty">
            No saved toolbox records yet. Submit a completed meeting to save one here.
          </p>
        ) : (
          <ul className="saved-records__list">
            {toolboxRecords.map((record) => (
              <li key={record.id} data-record-id={record.id} className="saved-record">
                <div className="saved-record__header">
                  <span className="type-badge type-badge--small">{record.formTypeLabel}</span>
                  <p className="saved-record__title">{getRecordTitle(record)}</p>
                </div>
                <dl className="saved-record__details">
                  <SummaryRow label="Site" value={record.fields.siteLocation} />
                  <SummaryRow label="Led by" value={record.fields.meetingLedBy ?? record.fields.facilitator} />
                  <SummaryRow label="Attendees" value={record.fields.attendees} />
                  <SummaryRow label="Date" value={record.fields.date} />
                  <SummaryRow
                    label="Checklist"
                    value={`${record.completedCount} of ${record.totalCount} completed`}
                  />
                  <SummaryRow label="Notes" value={record.fields.notes} />
                </dl>

                <SavedRecordSignature record={record} />

                {record.photos?.length > 0 && (
                  <ul className="photos__thumbs photos__thumbs--compact">
                    {record.photos.map((photo) => (
                      <li key={photo.id} className="photos__thumb">
                        <img src={photo.dataUrl} alt={photo.name} />
                      </li>
                    ))}
                  </ul>
                )}

                <p className="saved-record__meta">Saved {formatSubmittedAt(record.submittedAt)}</p>
                <RecordActions record={record} onPrint={setPrintRecord} variant="saved" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function TimesheetView({
  onBack,
  savedRecords,
  setSavedRecords,
  setPrintRecord,
  highlightRecordId,
  onClearHighlight,
  settings,
}) {
  const formConfig = FORM_TYPES.timesheet
  const [draft, setDraft] = useState(() => createEmptyDraft('timesheet'))
  const [completedRecord, setCompletedRecord] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [chargeableEdited, setChargeableEdited] = useState(false)
  const recordRef = useRef(null)

  const { fields, signatureConfirmation } = draft
  const comboOptions = getSettingsOptions(settings)

  const labourCalc = useMemo(
    () => calculateLabourHours(fields.startTime, fields.finishTime, fields.breakMinutes),
    [fields.startTime, fields.finishTime, fields.breakMinutes],
  )

  const autoChargeableHours = useMemo(
    () => calculateAutoChargeableHours(labourCalc.minutes, fields.nonChargeableHours),
    [labourCalc.minutes, fields.nonChargeableHours],
  )

  const displayedChargeableHours = chargeableEdited ? fields.chargeableHours : autoChargeableHours

  const timesheetRecords = savedRecords.filter((record) => record.formType === 'timesheet')

  useHighlightRecord(highlightRecordId, onClearHighlight, [timesheetRecords])

  useEffect(() => {
    if (completedRecord && recordRef.current) {
      recordRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [completedRecord])

  function updateDraft(updates) {
    setDraft((prev) => ({ ...prev, ...updates }))
  }

  function updateField(field, value) {
    setValidationError(null)
    if (field === 'startTime' || field === 'finishTime' || field === 'breakMinutes' || field === 'nonChargeableHours') {
      setChargeableEdited(false)
    }
    updateDraft({ fields: { ...fields, [field]: value } })
  }

  function handleChargeableChange(value) {
    setValidationError(null)
    setChargeableEdited(true)
    updateDraft({ fields: { ...fields, chargeableHours: value } })
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (
      !fields.date.trim() ||
      !fields.employeeName.trim() ||
      !fields.jobProjectName.trim() ||
      !fields.siteLocation.trim() ||
      !fields.startTime ||
      !fields.finishTime ||
      !fields.workCompleted.trim()
    ) {
      setValidationError(
        'Date, employee / operator, job / project, site, start time, finish time, and work completed are required before saving.',
      )
      return
    }

    if (!signatureConfirmation.trim()) {
      setValidationError('Signature / Name Confirmation is required before saving.')
      return
    }

    if (labourCalc.invalid) {
      setValidationError('Finish time must be after start time on the same day.')
      return
    }

    const nonChargeable = parseDecimalHours(fields.nonChargeableHours)
    if (nonChargeable > 0 && !fields.nonChargeableReason.trim()) {
      setValidationError('Reason for non-chargeable time is required when non-chargeable hours are entered.')
      return
    }

    setValidationError(null)
    const submittedAt = new Date().toISOString()
    const chargeableHours =
      chargeableEdited && fields.chargeableHours.trim()
        ? fields.chargeableHours.trim()
        : autoChargeableHours

    const record = {
      id: createRecordId(),
      formType: 'timesheet',
      formTypeLabel: formConfig.title,
      fields: {
        date: fields.date,
        employeeName: fields.employeeName,
        jobProjectName: fields.jobProjectName,
        siteLocation: fields.siteLocation,
        customerName: fields.customerName,
        machineUsed: fields.machineUsed,
        startTime: fields.startTime,
        finishTime: fields.finishTime,
        breakMinutes: fields.breakMinutes,
        totalHoursWorked: labourCalc.value,
        chargeableHours,
        nonChargeableHours: fields.nonChargeableHours,
        nonChargeableReason: fields.nonChargeableReason,
        workCompleted: fields.workCompleted,
        materialsUsed: fields.materialsUsed,
        docketNumber: fields.docketNumber,
        delaysOrIssues: fields.delaysOrIssues,
        safetyIssues: fields.safetyIssues,
        notes: fields.notes,
      },
      completedItems: [],
      completedCount: 0,
      totalCount: 0,
      allComplete: true,
      signatureConfirmation: signatureConfirmation.trim(),
      photos: [],
      submittedAt,
    }

    const nextRecords = [record, ...savedRecords]
    if (!persistSavedRecords(nextRecords)) return
    setSavedRecords(nextRecords)
    setCompletedRecord(record)
  }

  function handleReset() {
    setDraft(createEmptyDraft('timesheet'))
    setCompletedRecord(null)
    setValidationError(null)
    setChargeableEdited(false)
  }

  function handleClearTimesheetRecords() {
    if (timesheetRecords.length === 0) return
    const confirmed = window.confirm(
      'Delete all saved timesheet records? Other saved records will be kept.',
    )
    if (!confirmed) return
    setSavedRecords((prev) => {
      const next = prev.filter((record) => record.formType !== 'timesheet')
      return persistSavedRecords(next) ? next : prev
    })
    if (completedRecord) setCompletedRecord(null)
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header no-print">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">{formConfig.title}</h1>
        <p className="progress">Daily work and hours record</p>
      </header>

      <form className="job-form no-print" onSubmit={handleSubmit} noValidate>
        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">1. Job details</legend>
          <DateField value={fields.date} onChange={updateField} />
          <ComboField
            label="Employee / operator name"
            field="employeeName"
            value={fields.employeeName}
            onChange={updateField}
            placeholder="Your name"
            options={comboOptions.operators}
            listId="timesheet-operators"
          />
          <TextField
            label="Job / project name"
            field="jobProjectName"
            value={fields.jobProjectName}
            onChange={updateField}
            placeholder="e.g. Driveway excavation"
          />
          <ComboField
            label="Site location"
            field="siteLocation"
            value={fields.siteLocation}
            onChange={updateField}
            placeholder="Address or site name"
            options={comboOptions.sites}
            listId="timesheet-sites"
          />
          <TextField
            label="Customer / client name"
            field="customerName"
            value={fields.customerName}
            onChange={updateField}
            placeholder="Client or company name"
          />
          <ComboField
            label="Machine used"
            field="machineUsed"
            value={fields.machineUsed}
            onChange={updateField}
            placeholder="e.g. EX-01"
            options={comboOptions.machines}
            listId="timesheet-machines"
          />
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">2. Labour time</legend>
          <TimeField label="Start time" field="startTime" value={fields.startTime} onChange={updateField} />
          <TimeField label="Finish time" field="finishTime" value={fields.finishTime} onChange={updateField} />
          <TextField
            label="Break time (minutes)"
            field="breakMinutes"
            value={fields.breakMinutes}
            onChange={updateField}
            placeholder="e.g. 30"
          />
          <div className="timesheet-calc" aria-live="polite">
            <span className="timesheet-calc__label">Total hours worked</span>
            <span className="timesheet-calc__value">
              {labourCalc.invalid
                ? '—'
                : labourCalc.value || 'Enter start and finish times'}
            </span>
          </div>
          {labourCalc.invalid && (
            <p className="validation-message" role="alert">
              Finish time must be after start time on the same day.
            </p>
          )}
          <label className="field">
            <span className="field__label">Chargeable hours</span>
            <input
              type="text"
              className="field__input"
              value={displayedChargeableHours}
              onChange={(e) => handleChargeableChange(e.target.value)}
              placeholder="Auto-calculated from total minus non-chargeable"
            />
            <span className="field__hint">
              {chargeableEdited
                ? 'Manual override — change times or non-chargeable to recalculate automatically'
                : 'Auto: total hours worked minus non-chargeable hours'}
            </span>
          </label>
          <TextField
            label="Non-chargeable hours"
            field="nonChargeableHours"
            value={fields.nonChargeableHours}
            onChange={updateField}
            placeholder="e.g. 1.5"
          />
          <TextField
            label="Reason for non-chargeable time"
            field="nonChargeableReason"
            value={fields.nonChargeableReason}
            onChange={updateField}
            placeholder="Required if non-chargeable hours entered"
          />
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">3. Work details</legend>
          <label className="field">
            <span className="field__label">Work completed</span>
            <textarea
              className="field__input field__textarea"
              value={fields.workCompleted}
              onChange={(e) => updateField('workCompleted', e.target.value)}
              placeholder="Describe work completed today..."
              rows={4}
            />
          </label>
          <TextField
            label="Materials used or delivered"
            field="materialsUsed"
            value={fields.materialsUsed}
            onChange={updateField}
            placeholder="Materials, quantities, deliveries..."
          />
          <TextField
            label="Docket / reference number"
            field="docketNumber"
            value={fields.docketNumber}
            onChange={updateField}
            placeholder="Docket or job reference"
          />
          <TextField
            label="Delays or issues"
            field="delaysOrIssues"
            value={fields.delaysOrIssues}
            onChange={updateField}
            placeholder="Any delays or issues encountered"
          />
          <TextField
            label="Safety issues or hazards noticed"
            field="safetyIssues"
            value={fields.safetyIssues}
            onChange={updateField}
            placeholder="Hazards or safety concerns"
          />
          <NotesField value={fields.notes} onChange={updateField} />
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">4. Name confirmation</legend>
          <SignatureConfirmationField
            value={signatureConfirmation}
            onChange={(value) => {
              setValidationError(null)
              updateDraft({ signatureConfirmation: value })
            }}
          />
        </fieldset>

        {validationError && (
          <p className="validation-message" role="alert">
            {validationError}
          </p>
        )}

        <p className="form-hint">
          Complete job and time details, then save your daily work record.
        </p>

        <button type="submit" className="submit-btn">
          Save timesheet record
        </button>
      </form>

      {completedRecord && (
        <section ref={recordRef} className="record no-print" aria-labelledby="timesheet-record-heading" role="region">
          <div className="record__header">
            <div>
              <span className="type-badge">{completedRecord.formTypeLabel}</span>
              <h2 id="timesheet-record-heading" className="record__title">
                Completed record
              </h2>
              <p className="record__meta">Saved {formatSubmittedAt(completedRecord.submittedAt)}</p>
            </div>
          </div>

          <p className="record__saved" role="status">
            Record saved to this device. Review the details below.
          </p>

          <RecordDetails record={completedRecord} />
          <RecordActions record={completedRecord} onPrint={setPrintRecord} />
        </section>
      )}

      <button type="button" className="reset-btn no-print" onClick={handleReset}>
        Reset form
      </button>
      {completedRecord && (
        <p className="reset-hint no-print">Clears the current form and record view.</p>
      )}

      <section className="saved-records no-print" aria-labelledby="timesheet-saved-heading">
        <div className="saved-records__header">
          <div>
            <h2 id="timesheet-saved-heading" className="saved-records__title">
              Saved timesheet records
            </h2>
            <p className="saved-records__count">
              {timesheetRecords.length} record{timesheetRecords.length === 1 ? '' : 's'} on this device
            </p>
          </div>
          {timesheetRecords.length > 0 && (
            <button type="button" className="saved-records__clear" onClick={handleClearTimesheetRecords}>
              Clear all
            </button>
          )}
        </div>

        {timesheetRecords.length === 0 ? (
          <p className="saved-records__empty">
            No saved timesheet records yet. Submit a completed record to save one here.
          </p>
        ) : (
          <ul className="saved-records__list">
            {timesheetRecords.map((record) => (
              <li key={record.id} data-record-id={record.id} className="saved-record">
                <div className="saved-record__header">
                  <span className="type-badge type-badge--small">{record.formTypeLabel}</span>
                  <p className="saved-record__title">{getRecordTitle(record)}</p>
                </div>
                <dl className="saved-record__details">
                  <SummaryRow label="Employee" value={record.fields.employeeName} />
                  <SummaryRow label="Job" value={record.fields.jobProjectName} />
                  <SummaryRow label="Site" value={record.fields.siteLocation} />
                  <SummaryRow label="Date" value={record.fields.date} />
                  <SummaryRow label="Labour hours" value={record.fields.totalHoursWorked} />
                  <SummaryRow
                    label="Chargeable"
                    value={formatDecimalHoursDisplay(record.fields.chargeableHours)}
                  />
                  <SummaryRow label="Docket" value={record.fields.docketNumber} />
                </dl>

                <SavedRecordSignature record={record} />

                <p className="saved-record__meta">Saved {formatSubmittedAt(record.submittedAt)}</p>
                <RecordActions record={record} onPrint={setPrintRecord} variant="saved" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function IncidentView({
  onBack,
  savedRecords,
  setSavedRecords,
  setPrintRecord,
  onRecordSaved,
  highlightRecordId,
  onClearHighlight,
  settings,
}) {
  const formConfig = FORM_TYPES.incident
  const [draft, setDraft] = useState(() => createEmptyDraft('incident'))
  const [completedRecord, setCompletedRecord] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const recordRef = useRef(null)

  const { fields, checked, signatureConfirmation, photos } = draft
  const comboOptions = getSettingsOptions(settings)
  const checklist = formConfig.checklist
  const total = checklist.length
  const completed = checked.size
  const allComplete = completed === total

  const incidentRecords = savedRecords.filter((record) => record.formType === 'incident')

  useHighlightRecord(highlightRecordId, onClearHighlight, [incidentRecords])

  useEffect(() => {
    if (completedRecord && recordRef.current) {
      recordRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [completedRecord])

  function updateDraft(updates) {
    setDraft((prev) => ({ ...prev, ...updates }))
  }

  function updateField(field, value) {
    setValidationError(null)
    updateDraft({ fields: { ...fields, [field]: value } })
  }

  function toggleItem(index) {
    const next = new Set(checked)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    updateDraft({ checked: next })
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (
      !fields.date.trim() ||
      !fields.reportedBy.trim() ||
      !fields.siteLocation.trim() ||
      !fields.reportType ||
      !fields.whatHappened.trim()
    ) {
      setValidationError(
        'Date, reported by, site / job location, type of report, and what happened are required before saving.',
      )
      return
    }

    if (!signatureConfirmation.trim()) {
      setValidationError('Signature / Name Confirmation is required before saving.')
      return
    }

    setValidationError(null)
    const completedItems = checklist.filter((_, index) => checked.has(index))
    const submittedAt = new Date().toISOString()
    const record = {
      id: createRecordId(),
      formType: 'incident',
      formTypeLabel: formConfig.title,
      fields: { ...fields },
      completedItems,
      completedCount: completed,
      totalCount: total,
      allComplete,
      signatureConfirmation: signatureConfirmation.trim(),
      photos,
      submittedAt,
    }

    const nextRecords = [record, ...savedRecords]
    if (!persistSavedRecords(nextRecords)) return
    setSavedRecords(nextRecords)
    setCompletedRecord(record)
    onRecordSaved?.(record)
  }

  function handleReset() {
    setDraft(createEmptyDraft('incident'))
    setCompletedRecord(null)
    setValidationError(null)
  }

  function handleClearIncidentRecords() {
    if (incidentRecords.length === 0) return
    const confirmed = window.confirm(
      'Delete all saved incident records? Other saved records will be kept.',
    )
    if (!confirmed) return
    setSavedRecords((prev) => {
      const next = prev.filter((record) => record.formType !== 'incident')
      return persistSavedRecords(next) ? next : prev
    })
    if (completedRecord) setCompletedRecord(null)
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header no-print">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">{formConfig.title}</h1>
        <p className="progress" aria-live="polite">
          {completed} of {total} completed
        </p>
      </header>

      <form className="job-form no-print" onSubmit={handleSubmit} noValidate>
        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">1. Report details</legend>
          <DateField value={fields.date} onChange={updateField} />
          <TextField label="Time" field="time" value={fields.time} onChange={updateField} placeholder="e.g. 14:30" />
          <ComboField label="Reported by" field="reportedBy" value={fields.reportedBy} onChange={updateField} placeholder="Your name" options={comboOptions.operators} listId="incident-operators" />
          <ComboField label="Site / job location" field="siteLocation" value={fields.siteLocation} onChange={updateField} placeholder="Where it occurred" options={comboOptions.sites} listId="incident-sites" />
          <SelectField
            label="Type of report"
            field="reportType"
            value={fields.reportType}
            onChange={updateField}
            options={[
              { value: '', label: 'Select type...' },
              { value: 'incident', label: 'Incident' },
              { value: 'near-miss', label: 'Near Miss' },
              { value: 'property-damage', label: 'Property Damage' },
              { value: 'injury', label: 'Injury' },
              { value: 'environmental', label: 'Environmental' },
            ]}
          />
          <TextField label="Person involved" field="personInvolved" value={fields.personInvolved} onChange={updateField} placeholder="Names or roles" />
          <label className="field">
            <span className="field__label">What happened?</span>
            <textarea
              className="field__input field__textarea"
              value={fields.whatHappened}
              onChange={(e) => updateField('whatHappened', e.target.value)}
              placeholder="Describe what happened..."
              rows={4}
            />
          </label>
          <TextField label="Immediate action taken" field="immediateActionTaken" value={fields.immediateActionTaken} onChange={updateField} placeholder="Actions taken immediately" />
          <TextField label="Possible cause" field="possibleCause" value={fields.possibleCause} onChange={updateField} placeholder="What may have caused this?" />
          <TextField label="Corrective action required" field="correctiveActionRequired" value={fields.correctiveActionRequired} onChange={updateField} placeholder="Required corrective actions" />
          <TextField label="Person responsible for corrective action" field="correctiveActionPerson" value={fields.correctiveActionPerson} onChange={updateField} placeholder="Who will follow up?" />
          <DateField label="Follow-up date" field="followUpDate" value={fields.followUpDate} onChange={updateField} />
          <NotesField value={fields.notes} onChange={updateField} />
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">2. Incident checklist</legend>
          <ul className="checklist" role="list">
            {checklist.map((label, index) => {
              const isChecked = checked.has(index)
              return (
                <li key={label} className={isChecked ? 'item item--checked' : 'item'}>
                  <label className="item__label">
                    <input
                      type="checkbox"
                      className="item__checkbox"
                      checked={isChecked}
                      onChange={() => toggleItem(index)}
                    />
                    <span className="item__text">{label}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">3. Name confirmation &amp; photos</legend>
          <SignatureConfirmationField
            value={signatureConfirmation}
            onChange={(value) => {
              setValidationError(null)
              updateDraft({ signatureConfirmation: value })
            }}
          />
          <PhotoUpload photos={photos} onChange={(value) => updateDraft({ photos: value })} />
        </fieldset>

        {allComplete && (
          <p className="complete-message" role="status">
            Report complete. All checks completed accurately.
          </p>
        )}

        {validationError && (
          <p className="validation-message" role="alert">
            {validationError}
          </p>
        )}

        <p className="form-hint">
          Record incident details, complete the checklist, attach photos if available, then save.
        </p>

        <button type="submit" className="submit-btn">
          Save completed record
        </button>
      </form>

      {completedRecord && (
        <section ref={recordRef} className="record no-print" aria-labelledby="incident-record-heading" role="region">
          <div className="record__header">
            <div>
              <span className="type-badge">{completedRecord.formTypeLabel}</span>
              <h2 id="incident-record-heading" className="record__title">
                Completed record
              </h2>
              <p className="record__meta">Saved {formatSubmittedAt(completedRecord.submittedAt)}</p>
            </div>
            <span
              className={
                completedRecord.allComplete
                  ? 'record__badge record__badge--complete'
                  : 'record__badge record__badge--partial'
              }
            >
              {completedRecord.allComplete ? 'All checks done' : 'Partial'}
            </span>
          </div>

          <p className="record__saved" role="status">
            Record saved to this device. Review the details below.
          </p>

          <RecordDetails record={completedRecord} />
          <RecordActions record={completedRecord} onPrint={setPrintRecord} />
        </section>
      )}

      <button type="button" className="reset-btn no-print" onClick={handleReset}>
        Reset form
      </button>
      {completedRecord && (
        <p className="reset-hint no-print">Clears the current form and record view.</p>
      )}

      <section className="saved-records no-print" aria-labelledby="incident-saved-heading">
        <div className="saved-records__header">
          <div>
            <h2 id="incident-saved-heading" className="saved-records__title">
              Saved incident records
            </h2>
            <p className="saved-records__count">
              {incidentRecords.length} record{incidentRecords.length === 1 ? '' : 's'} on this device
            </p>
          </div>
          {incidentRecords.length > 0 && (
            <button type="button" className="saved-records__clear" onClick={handleClearIncidentRecords}>
              Clear all
            </button>
          )}
        </div>

        {incidentRecords.length === 0 ? (
          <p className="saved-records__empty">
            No saved incident records yet. Submit a completed report to save one here.
          </p>
        ) : (
          <ul className="saved-records__list">
            {incidentRecords.map((record) => (
              <li key={record.id} data-record-id={record.id} className="saved-record">
                <div className="saved-record__header">
                  <span className="type-badge type-badge--small">{record.formTypeLabel}</span>
                  <p className="saved-record__title">{getRecordTitle(record)}</p>
                </div>
                <dl className="saved-record__details">
                  <SummaryRow label="Type" value={formatReportType(record.fields.reportType)} />
                  <SummaryRow label="Site" value={record.fields.siteLocation ?? record.fields.location} />
                  <SummaryRow label="Reported by" value={record.fields.reportedBy} />
                  <SummaryRow label="Date" value={record.fields.date} />
                  <SummaryRow
                    label="Checklist"
                    value={`${record.completedCount} of ${record.totalCount} completed`}
                  />
                  <SummaryRow label="Notes" value={record.fields.notes} />
                </dl>

                <SavedRecordSignature record={record} />

                {record.photos?.length > 0 && (
                  <ul className="photos__thumbs photos__thumbs--compact">
                    {record.photos.map((photo) => (
                      <li key={photo.id} className="photos__thumb">
                        <img src={photo.dataUrl} alt={photo.name} />
                      </li>
                    ))}
                  </ul>
                )}

                <p className="saved-record__meta">Saved {formatSubmittedAt(record.submittedAt)}</p>
                <RecordActions record={record} onPrint={setPrintRecord} variant="saved" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function App() {
  const [currentView, setCurrentView] = useState('dashboard')
  const [savedRecords, setSavedRecords] = useState(() => loadSavedRecords())
  const [actions, setActions] = useState(() => loadActions())
  const [settings, setSettings] = useState(() => loadSettings())
  const [printRecord, setPrintRecord] = useState(null)
  const [highlightRecordId, setHighlightRecordId] = useState(null)

  const openActionCount = actions.filter((action) => action.status !== 'completed').length

  function goToDashboard() {
    setHighlightRecordId(null)
    setCurrentView('dashboard')
  }

  function handleViewRecord(record) {
    setHighlightRecordId(record.id)
    setCurrentView(record.formType)
  }

  function handleClearHighlight() {
    setHighlightRecordId(null)
  }

  function handleRecordSaved(record) {
    setActions((prev) => {
      const next = syncActionsFromRecord(record, prev)
      if (next.length === prev.length) return prev
      return persistActions(next) ? next : prev
    })
  }

  useEffect(() => {
    if (!printRecord) return undefined

    const timer = window.setTimeout(() => {
      window.print()
    }, 350)

    function handleAfterPrint() {
      setPrintRecord(null)
    }

    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [printRecord])

  return (
    <div className="app">
      {printRecord && (
        <div className="print-area" aria-hidden="true">
          <PrintableRecord record={printRecord} />
        </div>
      )}

      {currentView === 'dashboard' && (
        <Dashboard
          onNavigate={setCurrentView}
          recordCount={savedRecords.length}
          openActionCount={openActionCount}
        />
      )}

      {currentView === 'action-register' && (
        <ActionRegisterView
          onBack={goToDashboard}
          actions={actions}
          setActions={setActions}
        />
      )}

      {currentView === 'records-dashboard' && (
        <RecordsDashboardView
          onBack={goToDashboard}
          onNavigate={setCurrentView}
          savedRecords={savedRecords}
          actions={actions}
          setPrintRecord={setPrintRecord}
          onViewRecord={handleViewRecord}
        />
      )}

      {currentView === 'settings' && (
        <SettingsView onBack={goToDashboard} settings={settings} setSettings={setSettings} />
      )}

      {currentView === 'job-start' && (
        <JobStartView
          onBack={goToDashboard}
          savedRecords={savedRecords}
          setSavedRecords={setSavedRecords}
          setPrintRecord={setPrintRecord}
          highlightRecordId={highlightRecordId}
          onClearHighlight={handleClearHighlight}
          settings={settings}
        />
      )}

      {currentView === 'pre-start' && (
        <PreStartView
          onBack={goToDashboard}
          savedRecords={savedRecords}
          setSavedRecords={setSavedRecords}
          setPrintRecord={setPrintRecord}
          onRecordSaved={handleRecordSaved}
          highlightRecordId={highlightRecordId}
          onClearHighlight={handleClearHighlight}
          settings={settings}
        />
      )}

      {currentView === 'toolbox' && (
        <ToolboxView
          onBack={goToDashboard}
          savedRecords={savedRecords}
          setSavedRecords={setSavedRecords}
          setPrintRecord={setPrintRecord}
          onRecordSaved={handleRecordSaved}
          highlightRecordId={highlightRecordId}
          onClearHighlight={handleClearHighlight}
          settings={settings}
        />
      )}

      {currentView === 'timesheet' && (
        <TimesheetView
          onBack={goToDashboard}
          savedRecords={savedRecords}
          setSavedRecords={setSavedRecords}
          setPrintRecord={setPrintRecord}
          highlightRecordId={highlightRecordId}
          onClearHighlight={handleClearHighlight}
          settings={settings}
        />
      )}

      {currentView === 'incident' && (
        <IncidentView
          onBack={goToDashboard}
          savedRecords={savedRecords}
          setSavedRecords={setSavedRecords}
          setPrintRecord={setPrintRecord}
          onRecordSaved={handleRecordSaved}
          highlightRecordId={highlightRecordId}
          onClearHighlight={handleClearHighlight}
          settings={settings}
        />
      )}
    </div>
  )
}

function ComboField({ label, field, value, onChange, placeholder, options = [], listId }) {
  const datalistId = listId || `combo-${field}`
  const hasOptions = options.length > 0

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        type="text"
        className="field__input"
        list={hasOptions ? datalistId : undefined}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {hasOptions && (
        <datalist id={datalistId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
      {hasOptions && (
        <span className="field__hint">Pick from saved list or type manually</span>
      )}
    </label>
  )
}

function TextField({ label, field, value, onChange, placeholder }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        type="text"
        className="field__input"
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function DateField({ value, onChange, field = 'date', label = 'Date' }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        type="date"
        className="field__input"
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
      />
    </label>
  )
}

function TimeField({ value, onChange, field, label }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        type="time"
        className="field__input"
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
      />
    </label>
  )
}

function SelectField({ label, field, value, onChange, options }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select
        className="field__input"
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value || 'empty'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function NotesField({ value, onChange }) {
  return (
    <label className="field">
      <span className="field__label">Notes</span>
      <textarea
        className="field__input field__textarea"
        value={value}
        onChange={(e) => onChange('notes', e.target.value)}
        placeholder="Any additional notes..."
        rows={3}
      />
    </label>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="saved-record__row">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  )
}

export default App
