import { REPORT_TYPE_LABELS, DEFECT_SEVERITY_LABELS } from '../constants/index.js'
import { formatTime12Hour } from './time12Hour.js'

const TIME_DISPLAY_KEYS = new Set(['startTime', 'finishTime', 'time', 'meetingTime'])

/** Date-only field keys shown to users as dd-MM-yyyy. */
const DATE_DISPLAY_KEYS = new Set([
  'date',
  'followUpDate',
  'dueDate',
  'meetingDate',
  'effectiveDate',
  'preparedDate',
  'approvedDate',
  'serviceDate',
  'nextServiceDate',
  'expiryDate',
  'issueDate',
  'targetDate',
  'nextMeetingDate',
  'reviewDate',
])

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

/**
 * Format a date for NZ display as dd-MM-yyyy.
 * Accepts Date, ISO datetime, or YYYY-MM-DD. Empty/invalid → '—'.
 * Presentation only — does not change stored values.
 * @param {string|number|Date|null|undefined} value
 * @returns {string}
 */
export function formatNzDate(value) {
  if (value == null || value === '') return '—'

  let date
  if (value instanceof Date) {
    date = value
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return '—'
    // Date-only YYYY-MM-DD — parse as local midnight to avoid UTC day shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number)
      date = new Date(y, m - 1, d)
    } else {
      date = new Date(trimmed)
    }
  } else if (typeof value === 'number') {
    date = new Date(value)
  } else {
    return '—'
  }

  if (Number.isNaN(date.getTime())) return '—'

  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

/** ISO / Date timestamp → "dd-MM-yyyy, h:mm am/pm" for saved/printed meta. */
export function formatSubmittedAt(isoString) {
  if (isoString == null || isoString === '') return '—'
  const date = isoString instanceof Date ? isoString : new Date(isoString)
  if (Number.isNaN(date.getTime())) return '—'
  const timePart = date.toLocaleTimeString('en-NZ', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${formatNzDate(date)}, ${timePart}`
}

export function formatFieldDisplayValue(key, value) {
  if (key === 'reportType') return formatReportType(value)
  if (key === 'defectsFound') return formatDefectsFound(value)
  if (key === 'defectSeverity') return formatDefectSeverity(value)
  if (key === 'machineOperableSafely') return formatMachineOperable(value)
  if (key === 'chargeableHours' && value) return formatDecimalHoursDisplay(value)
  if (key === 'nonChargeableHours' && value) return formatDecimalHoursDisplay(value)
  if (TIME_DISPLAY_KEYS.has(key)) return formatTime12Hour(value) || '—'
  if (DATE_DISPLAY_KEYS.has(key)) return formatNzDate(value)
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
