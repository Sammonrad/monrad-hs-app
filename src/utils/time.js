import { formatDurationMinutes } from './formatting.js'

export function parseTimeToMinutes(timeStr) {
  if (!timeStr?.trim()) return null
  const parts = timeStr.trim().split(':')
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1] ?? '0', 10)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

export function calculateLabourHours(startTime, finishTime, breakMinutes) {
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

export function getLabourMinutes(startTime, finishTime, breakMinutes) {
  const start = parseTimeToMinutes(startTime)
  const finish = parseTimeToMinutes(finishTime)
  if (start == null || finish == null || finish < start) return null
  const breakMins = parseInt(String(breakMinutes).trim(), 10) || 0
  return Math.max(0, finish - start - breakMins)
}

export function parseDecimalHours(value) {
  const parsed = parseFloat(String(value ?? '').trim())
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
}

export function minutesToDecimalHours(minutes) {
  if (minutes == null) return 0
  return Math.round((minutes / 60) * 100) / 100
}

export function calculateAutoChargeableHours(labourMinutes, nonChargeableHours) {
  if (labourMinutes == null) return ''
  const total = minutesToDecimalHours(labourMinutes)
  const nonChargeable = parseDecimalHours(nonChargeableHours)
  return Math.max(0, total - nonChargeable).toFixed(2)
}
