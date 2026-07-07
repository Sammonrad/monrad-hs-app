import { ACTIONS_STORAGE_KEY, TODAY, DEFAULT_ACTION_PRIORITY, ACTION_PRIORITIES } from '../../constants/index.js'
import { createRecordId } from '../ids.js'
import { formatDefectSeverity } from '../formatting.js'
import { isSeriousDefect } from '../defects.js'

function normalizePriority(priority) {
  return ACTION_PRIORITIES.includes(priority) ? priority : DEFAULT_ACTION_PRIORITY
}

export function priorityFromDefectSeverity(severity) {
  const map = {
    low: 'low',
    medium: 'medium',
    high: 'high',
    critical: 'critical',
  }
  return map[severity] ?? DEFAULT_ACTION_PRIORITY
}

export function normalizeAction(action) {
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
    priority: normalizePriority(action.priority),
    notes: action.notes ?? '',
    createdAt: action.createdAt ?? new Date().toISOString(),
    autoCreated: action.autoCreated ?? false,
    serious: action.serious ?? false,
  }
}

export function loadActions() {
  try {
    const raw = localStorage.getItem(ACTIONS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeAction) : []
  } catch {
    return []
  }
}

export function persistActions(actions) {
  try {
    localStorage.setItem(ACTIONS_STORAGE_KEY, JSON.stringify(actions))
    return true
  } catch {
    window.alert('Could not save actions to this device.')
    return false
  }
}

export function isOverdue(action) {
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
    priority: DEFAULT_ACTION_PRIORITY,
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
      priority: priorityFromDefectSeverity(record.defectSeverity),
      serious: isSeriousDefect(record),
    }
  }

  if (record.formType === 'incident' && fields.correctiveActionRequired?.trim()) {
    return {
      ...base,
      description: fields.correctiveActionRequired.trim(),
      personResponsible: fields.correctiveActionPerson || fields.reportedBy || '',
      dueDate: fields.followUpDate || '',
      priority: 'high',
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

export function syncActionsFromRecord(record, actions) {
  const newAction = createActionFromRecord(record)
  if (!newAction || hasActionForRecord(actions, record)) return actions
  return [newAction, ...actions]
}

export function createEmptyManualAction() {
  return {
    date: TODAY(),
    site: '',
    description: '',
    personResponsible: '',
    dueDate: '',
    priority: DEFAULT_ACTION_PRIORITY,
    notes: '',
  }
}
