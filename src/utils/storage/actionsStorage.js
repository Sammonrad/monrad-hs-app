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
  const status = action.status ?? 'open'
  const normalized = {
    id: action.id ?? createRecordId(),
    sourceType: action.sourceType ?? 'manual',
    sourceRecordId: action.sourceRecordId ?? null,
    date: action.date ?? '',
    site: action.site ?? '',
    description: action.description ?? '',
    personResponsible: action.personResponsible ?? '',
    dueDate: action.dueDate ?? '',
    status,
    priority: normalizePriority(action.priority),
    notes: action.notes ?? '',
    createdAt: action.createdAt ?? new Date().toISOString(),
    autoCreated: action.autoCreated ?? false,
    serious: action.serious ?? false,
    cloudId: action.cloudId ?? null,
    cloudUserId: action.cloudUserId ?? null,
    storageSource: action.storageSource ?? (action.cloudId ? 'cloud' : 'local'),
    syncStatus: action.syncStatus ?? null,
    completedAt:
      action.completedAt ??
      (status === 'completed' ? action.updatedAt ?? null : null),
    ...(typeof action.archived === 'boolean' ? { archived: action.archived } : {}),
  }
  return normalized
}

export function patchAction(actions, actionId, patch) {
  return actions.map((action) =>
    action.id === actionId ? normalizeAction({ ...action, ...patch }) : action,
  )
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

function hasMeetingActionLinked(actions, meeting, meetingAction) {
  if (meetingAction.linkedActionId) {
    return actions.some((action) => action.id === meetingAction.linkedActionId)
  }
  return actions.some(
    (action) =>
      action.autoCreated &&
      action.sourceType === 'general-meeting' &&
      action.sourceRecordId === meeting.id &&
      action.notes === meetingAction.id,
  )
}

function createActionFromMeetingAction(meeting, meetingAction) {
  if (!meetingAction.description?.trim()) return null
  return normalizeAction({
    id: createRecordId(),
    sourceType: 'general-meeting',
    sourceRecordId: meeting.id,
    date: meeting.meetingDate || TODAY(),
    site: meeting.location || '',
    description: meetingAction.description.trim(),
    personResponsible: meetingAction.personResponsible || meeting.chairperson || '',
    dueDate: meetingAction.dueDate || '',
    status: meetingAction.status === 'completed' ? 'completed' : meetingAction.status || 'open',
    priority: meetingAction.priority || DEFAULT_ACTION_PRIORITY,
    notes: meetingAction.id,
    createdAt: new Date().toISOString(),
    autoCreated: true,
    serious: meetingAction.priority === 'critical',
  })
}

export function syncActionsFromGeneralMeeting(meeting, actions) {
  if (meeting.status !== 'completed') return actions
  let next = actions
  let changed = false

  for (const meetingAction of meeting.newActions ?? []) {
    if (!meetingAction.description?.trim()) continue
    if (hasMeetingActionLinked(next, meeting, meetingAction)) continue
    const newAction = createActionFromMeetingAction(meeting, meetingAction)
    if (!newAction) continue
    next = [newAction, ...next]
    changed = true
  }

  return changed ? next : actions
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
