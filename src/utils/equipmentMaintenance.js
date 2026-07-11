import { MAINTENANCE_THRESHOLDS } from '../constants/maintenanceConfig.js'
import { TODAY } from '../constants/index.js'

export function parseNumeric(value) {
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function daysBetween(fromDate, toDate) {
  const from = new Date(fromDate)
  const to = new Date(toDate)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

export function getMaintenanceDueStatus(equipment, thresholds = MAINTENANCE_THRESHOLDS) {
  const today = TODAY()
  const statuses = []

  const nextDate = equipment.nextServiceDate?.trim()
  if (nextDate) {
    const days = daysBetween(today, nextDate)
    if (days != null) {
      if (days < 0) statuses.push({ type: 'date', level: 'overdue', label: 'Overdue by date' })
      else if (days <= thresholds.dueSoonDays)
        statuses.push({ type: 'date', level: 'due-soon', label: 'Due within 30 days' })
    }
  }

  const currentHours = parseNumeric(equipment.currentHours)
  const nextHours = parseNumeric(equipment.nextServiceHours)
  if (currentHours != null && nextHours != null) {
    const remaining = nextHours - currentHours
    if (remaining < 0) statuses.push({ type: 'hours', level: 'overdue', label: 'Overdue by hours' })
    else if (remaining <= thresholds.dueSoonHours)
      statuses.push({ type: 'hours', level: 'due-soon', label: 'Due within 50 hours' })
  }

  const currentOdo = parseNumeric(equipment.currentOdometer)
  const nextOdo = parseNumeric(equipment.nextServiceOdometer)
  if (currentOdo != null && nextOdo != null) {
    const remaining = nextOdo - currentOdo
    if (remaining < 0)
      statuses.push({ type: 'odometer', level: 'overdue', label: 'Overdue by odometer' })
    else if (remaining <= thresholds.dueSoonOdometerKm)
      statuses.push({ type: 'odometer', level: 'due-soon', label: 'Due within 1,000 km' })
  }

  if (statuses.length === 0) return { level: 'current', statuses: [], primary: null }
  const overdue = statuses.find((s) => s.level === 'overdue')
  const primary = overdue ?? statuses[0]
  return { level: primary.level, statuses, primary }
}

export function isServiceOverdue(equipment) {
  return getMaintenanceDueStatus(equipment).level === 'overdue'
}

export function isServiceDueSoon(equipment) {
  const status = getMaintenanceDueStatus(equipment)
  return status.level === 'due-soon' || status.statuses.some((s) => s.level === 'due-soon')
}
