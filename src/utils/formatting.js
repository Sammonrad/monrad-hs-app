import { REPORT_TYPE_LABELS, DEFECT_SEVERITY_LABELS } from '../constants/index.js'
import { formatTime12Hour } from './time12Hour.js'

const TIME_DISPLAY_KEYS = new Set(['startTime', 'finishTime', 'time', 'meetingTime'])

export function formatReportType(value) {
  return REPORT_TYPE_LABELS[value] ?? value ?? '—'
}

export function formatDefectsFound(value) {
  if (value === 'found') return 'Defects found'
  if (value === 'none') return 'No defects'
  return value ?? '—'
}

export function formatMachineOperable(value) {
  if (value === 'yes') return 'Yes'
  if (value === 'no') return 'No'
  return value ?? '—'
}

export function formatDefectSeverity(value) {
  return DEFECT_SEVERITY_LABELS[value] ?? value ?? '—'
}

export function formatSubmittedAt(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatFieldDisplayValue(key, value) {
  if (key === 'reportType') return formatReportType(value)
  if (key === 'defectsFound') return formatDefectsFound(value)
  if (key === 'defectSeverity') return formatDefectSeverity(value)
  if (key === 'machineOperableSafely') return formatMachineOperable(value)
  if (key === 'chargeableHours' && value) return formatDecimalHoursDisplay(value)
  if (key === 'nonChargeableHours' && value) return formatDecimalHoursDisplay(value)
  if (TIME_DISPLAY_KEYS.has(key)) return formatTime12Hour(value) || '—'
  return value || '—'
}

export function formatDecimalHoursDisplay(hours) {
  if (hours === '' || hours == null) return ''
  const value = typeof hours === 'number' ? hours : parseFloat(hours)
  if (Number.isNaN(value)) return ''
  return `${value.toFixed(2)} hrs`
}

export function formatDurationMinutes(totalMinutes) {
  if (totalMinutes == null) return ''
  if (totalMinutes <= 0) return '0h'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}
