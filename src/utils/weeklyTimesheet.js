import { parseDecimalHours, getLabourMinutes, minutesToDecimalHours } from './time.js'
import { formatNzDate } from './formatting.js'

export const EMPTY_WEEKLY_FILTERS = {
  employee: '',
  dateFrom: '',
  dateTo: '',
  jobProject: '',
  site: '',
  machine: '',
}

export function getTimesheetRecords(savedRecords) {
  return savedRecords.filter((record) => record.formType === 'timesheet')
}

export function parseDurationToDecimalHours(value) {
  if (value == null || value === '') return 0
  const str = String(value).trim()
  if (!str) return 0

  const decimalOnly = parseFloat(str)
  if (!Number.isNaN(decimalOnly) && /^-?\d+(\.\d+)?$/.test(str)) {
    return Math.max(0, decimalOnly)
  }

  const hoursMinutes = str.match(/^(\d+)h(?:\s+(\d+)m)?$/i)
  if (hoursMinutes) {
    const hours = parseInt(hoursMinutes[1], 10)
    const minutes = parseInt(hoursMinutes[2] ?? '0', 10)
    return hours + minutes / 60
  }

  const minutesOnly = str.match(/^(\d+)m$/i)
  if (minutesOnly) {
    return parseInt(minutesOnly[1], 10) / 60
  }

  return 0
}

export function parseRecordTotalHours(record) {
  const fields = record.fields ?? {}
  const fromDuration = parseDurationToDecimalHours(fields.totalHoursWorked)
  if (fromDuration > 0) return fromDuration

  const minutes = getLabourMinutes(fields.startTime, fields.finishTime, fields.breakMinutes)
  if (minutes != null) return minutesToDecimalHours(minutes)

  return 0
}

export function parseRecordHours(record) {
  const fields = record.fields ?? {}
  const total = parseRecordTotalHours(record)
  const nonChargeable = parseDecimalHours(fields.nonChargeableHours)
  const chargeableRaw = fields.chargeableHours
  const chargeable =
    chargeableRaw != null && String(chargeableRaw).trim() !== ''
      ? parseDecimalHours(chargeableRaw)
      : Math.max(0, total - nonChargeable)

  return { total, chargeable, nonChargeable }
}

function formatDateLocal(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getWeekStartMonday(dateStr) {
  if (!dateStr?.trim()) return null
  const parts = dateStr.trim().split('-').map(Number)
  if (parts.length < 3 || parts.some(Number.isNaN)) return null

  const date = new Date(parts[0], parts[1] - 1, parts[2])
  if (Number.isNaN(date.getTime())) return null

  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return formatDateLocal(date)
}

export function formatWeekLabel(weekStart) {
  if (!weekStart) return 'Unknown week'
  const { startLabel, endLabel } = formatWeekRangeParts(weekStart)
  return `${startLabel} – ${endLabel}`
}

/** Monday week start for a reference date (defaults to today). */
export function getCurrentWeekStart(referenceDate = new Date()) {
  return getWeekStartMonday(formatDateLocal(referenceDate))
}

/**
 * Compact NZ-friendly week range, e.g. "10–16 August 2026".
 * Uses en-NZ month names; day numbers omit leading zeros.
 */
export function formatWeekDateRangeLabel(weekStart) {
  if (!weekStart || weekStart === 'unknown') return 'No date'

  const [y, m, d] = weekStart.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d)
  end.setDate(end.getDate() + 6)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Unknown week'

  const startDay = start.getDate()
  const endDay = end.getDate()
  const startMonth = start.toLocaleDateString('en-NZ', { month: 'long' })
  const endMonth = end.toLocaleDateString('en-NZ', { month: 'long' })
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  if (startYear === endYear && startMonth === endMonth) {
    return `${startDay}–${endDay} ${startMonth} ${startYear}`
  }
  if (startYear === endYear) {
    return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${startYear}`
  }
  return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`
}

/** "This Week", "Last Week", or a compact date range for older weeks. */
export function getFriendlyWeekLabel(weekStart, referenceDate = new Date()) {
  if (!weekStart || weekStart === 'unknown') return 'No date'

  const currentWeekStart = getCurrentWeekStart(referenceDate)
  if (weekStart === currentWeekStart) return 'This Week'

  const lastWeekRef = new Date(referenceDate)
  lastWeekRef.setDate(lastWeekRef.getDate() - 7)
  const lastWeekStart = getCurrentWeekStart(lastWeekRef)
  if (weekStart === lastWeekStart) return 'Last Week'

  return formatWeekDateRangeLabel(weekStart)
}

export function formatWeekRangeParts(weekStart) {
  if (!weekStart || weekStart === 'unknown') {
    return { startLabel: '—', endLabel: '—', weekLabel: 'No date' }
  }

  const [y, m, d] = weekStart.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d)
  end.setDate(end.getDate() + 6)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { startLabel: '—', endLabel: '—', weekLabel: 'Unknown week' }
  }

  const startLabel = formatNzDate(start)
  const endLabel = formatNzDate(end)
  return {
    startLabel,
    endLabel,
    weekLabel: `${startLabel} – ${endLabel}`,
  }
}

/** Compact weekday + NZ date for weekly print rows, e.g. "Mon 28-07-2025". */
export function formatTimesheetDateDay(dateStr) {
  if (!dateStr?.trim()) return '—'
  const parts = dateStr.trim().split('-').map(Number)
  if (parts.length < 3 || parts.some(Number.isNaN)) return dateStr

  const date = new Date(parts[0], parts[1] - 1, parts[2])
  if (Number.isNaN(date.getTime())) return dateStr

  const weekday = date.toLocaleDateString('en-NZ', { weekday: 'short' })
  return `${weekday} ${formatNzDate(date)}`
}

/**
 * Group timesheet records into one printable sheet per employee + week.
 * Rows within each sheet are sorted Monday → Sunday.
 */
export function buildWeeklyPrintSheets(records) {
  const groups = new Map()

  records.forEach((record) => {
    const fields = record.fields ?? {}
    const weekKey = getWeekStartMonday(fields.date) || 'unknown'
    const employeeName = (fields.employeeName || '').trim() || 'Unnamed employee'
    const sheetKey = `${weekKey}::${employeeName.toLowerCase()}`

    if (!groups.has(sheetKey)) {
      groups.set(sheetKey, {
        sheetKey,
        weekKey,
        employeeName,
        records: [],
      })
    }
    groups.get(sheetKey).records.push(record)
  })

  return [...groups.values()]
    .map((group) => {
      const range = formatWeekRangeParts(group.weekKey)
      const sorted = [...group.records].sort((a, b) => {
        const dateA = a.fields?.date || ''
        const dateB = b.fields?.date || ''
        return dateA.localeCompare(dateB)
      })

      return {
        sheetKey: group.sheetKey,
        weekKey: group.weekKey,
        employeeName: group.employeeName,
        weekLabel: range.weekLabel,
        weekStartLabel: range.startLabel,
        weekEndLabel: range.endLabel,
        records: sorted,
        totals: calculateTotals(sorted),
      }
    })
    .sort((a, b) => {
      const weekCmp = b.weekKey.localeCompare(a.weekKey)
      if (weekCmp !== 0) return weekCmp
      return a.employeeName.localeCompare(b.employeeName)
    })
}

/** Build print sheet(s) for the employee-week containing a selected timesheet record. */
export function buildWeeklyPrintSheetForRecord(record, allRecords = []) {
  const fields = record?.fields ?? {}
  const weekKey = getWeekStartMonday(fields.date) || 'unknown'
  const employeeKey = (fields.employeeName || '').trim().toLowerCase()

  const weekRecords = (allRecords.length > 0 ? allRecords : [record]).filter((candidate) => {
    const candidateFields = candidate?.fields ?? {}
    const sameWeek = (getWeekStartMonday(candidateFields.date) || 'unknown') === weekKey
    const sameEmployee =
      (candidateFields.employeeName || '').trim().toLowerCase() === employeeKey
    return sameWeek && sameEmployee
  })

  return buildWeeklyPrintSheets(weekRecords.length > 0 ? weekRecords : [record])
}

export function recordMatchesFilters(record, filters) {
  const fields = record.fields ?? {}
  const date = fields.date || ''

  if (filters.employee?.trim()) {
    const query = filters.employee.trim().toLowerCase()
    if (!(fields.employeeName ?? '').toLowerCase().includes(query)) return false
  }
  if (filters.jobProject?.trim()) {
    const query = filters.jobProject.trim().toLowerCase()
    if (!(fields.jobProjectName ?? '').toLowerCase().includes(query)) return false
  }
  if (filters.site?.trim()) {
    const query = filters.site.trim().toLowerCase()
    if (!(fields.siteLocation ?? '').toLowerCase().includes(query)) return false
  }
  if (filters.machine?.trim()) {
    const query = filters.machine.trim().toLowerCase()
    if (!(fields.machineUsed ?? '').toLowerCase().includes(query)) return false
  }
  if (filters.dateFrom && date && date < filters.dateFrom) return false
  if (filters.dateTo && date && date > filters.dateTo) return false

  return true
}

export function filterTimesheets(records, filters) {
  return records.filter((record) => recordMatchesFilters(record, filters))
}

export function groupByWeek(records) {
  const groups = new Map()

  records.forEach((record) => {
    const weekKey = getWeekStartMonday(record.fields?.date) || 'unknown'
    if (!groups.has(weekKey)) {
      groups.set(weekKey, [])
    }
    groups.get(weekKey).push(record)
  })

  return [...groups.entries()]
    .map(([weekKey, weekRecords]) => ({
      weekKey,
      weekLabel: weekKey === 'unknown' ? 'No date' : formatWeekLabel(weekKey),
      records: [...weekRecords].sort((a, b) => {
        const dateA = a.fields?.date || ''
        const dateB = b.fields?.date || ''
        return dateB.localeCompare(dateA)
      }),
    }))
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
}

/** Group timesheets by calendar week with friendly labels and hour totals. */
export function groupTimesheetsByWeek(records, referenceDate = new Date()) {
  return groupByWeek(records).map((group) => ({
    ...group,
    friendlyLabel: getFriendlyWeekLabel(group.weekKey, referenceDate),
    totals: calculateTotals(group.records),
  }))
}

export function calculateTotals(records) {
  let totalHoursWorked = 0
  let totalChargeableHours = 0
  let totalNonChargeableHours = 0
  const uniqueDates = new Set()

  records.forEach((record) => {
    const { total, chargeable, nonChargeable } = parseRecordHours(record)
    totalHoursWorked += total
    totalChargeableHours += chargeable
    totalNonChargeableHours += nonChargeable
    const date = record.fields?.date
    if (date) uniqueDates.add(date)
  })

  return {
    totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
    totalChargeableHours: Math.round(totalChargeableHours * 100) / 100,
    totalNonChargeableHours: Math.round(totalNonChargeableHours * 100) / 100,
    recordCount: records.length,
    daysWorked: uniqueDates.size,
  }
}

export function formatHoursTotal(hours) {
  return `${hours.toFixed(2)} hrs`
}

export function getFilterOptions(records) {
  const employees = new Set()
  const jobs = new Set()
  const sites = new Set()
  const machines = new Set()

  records.forEach((record) => {
    const fields = record.fields ?? {}
    if (fields.employeeName?.trim()) employees.add(fields.employeeName.trim())
    if (fields.jobProjectName?.trim()) jobs.add(fields.jobProjectName.trim())
    if (fields.siteLocation?.trim()) sites.add(fields.siteLocation.trim())
    if (fields.machineUsed?.trim()) machines.add(fields.machineUsed.trim())
  })

  return {
    employees: [...employees].sort((a, b) => a.localeCompare(b)),
    jobs: [...jobs].sort((a, b) => a.localeCompare(b)),
    sites: [...sites].sort((a, b) => a.localeCompare(b)),
    machines: [...machines].sort((a, b) => a.localeCompare(b)),
  }
}

export function describeActiveFilters(filters) {
  const parts = []
  if (filters.employee?.trim()) parts.push(`Employee: ${filters.employee.trim()}`)
  if (filters.dateFrom) parts.push(`From: ${filters.dateFrom}`)
  if (filters.dateTo) parts.push(`To: ${filters.dateTo}`)
  if (filters.jobProject?.trim()) parts.push(`Job: ${filters.jobProject.trim()}`)
  if (filters.site?.trim()) parts.push(`Site: ${filters.site.trim()}`)
  if (filters.machine?.trim()) parts.push(`Machine: ${filters.machine.trim()}`)
  return parts.length ? parts.join(' · ') : 'All timesheet records'
}
