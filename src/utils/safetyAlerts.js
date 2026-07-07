import { isOverdue } from './storage/actionsStorage.js'

export function isOpenAction(action) {
  return action.status !== 'completed'
}

export function isCriticalAction(action) {
  return action.priority === 'critical' && isOpenAction(action)
}

export function getUnresolvedMachineDefects(savedRecords, actions) {
  const defectRecords = savedRecords.filter(
    (record) => record.formType === 'pre-start' && record.defectsFound === 'found',
  )

  return defectRecords.filter((record) => {
    const linked = actions.find(
      (action) =>
        action.sourceRecordId === record.id &&
        action.sourceType === 'pre-start',
    )
    return !linked || linked.status !== 'completed'
  }).length
}

export function getUnresolvedIncidentActions(actions) {
  return actions.filter(
    (action) => action.sourceType === 'incident' && action.status !== 'completed',
  ).length
}

export function getSafetyAlerts(savedRecords, actions) {
  const openActions = actions.filter(isOpenAction)

  return {
    openActions: openActions.length,
    overdueActions: actions.filter(isOverdue).length,
    criticalActions: actions.filter(isCriticalAction).length,
    unresolvedMachineDefects: getUnresolvedMachineDefects(savedRecords, actions),
    unresolvedIncidentActions: getUnresolvedIncidentActions(actions),
  }
}

export function filterActionsByRegisterFilter(actions, filterId) {
  switch (filterId) {
    case 'open':
      return actions.filter((action) => action.status === 'open')
    case 'in-progress':
      return actions.filter((action) => action.status === 'in-progress')
    case 'completed':
      return actions.filter((action) => action.status === 'completed')
    case 'overdue':
      return actions.filter(isOverdue)
    case 'critical':
      return actions.filter(isCriticalAction)
    default:
      return actions
  }
}

const PRIORITY_SORT_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

export function sortActiveActions(actions) {
  return [...actions].sort((a, b) => {
    const overdueA = isOverdue(a) ? 0 : 1
    const overdueB = isOverdue(b) ? 0 : 1
    if (overdueA !== overdueB) return overdueA - overdueB

    const priorityA = PRIORITY_SORT_ORDER[a.priority] ?? 2
    const priorityB = PRIORITY_SORT_ORDER[b.priority] ?? 2
    if (priorityA !== priorityB) return priorityA - priorityB

    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })
}

export function getActionStatusLabel(action) {
  if (isOverdue(action)) return 'Overdue'
  return null
}
