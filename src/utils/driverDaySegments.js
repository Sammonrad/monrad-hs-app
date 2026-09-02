/**
 * Driver day segment validation and timeline helpers.
 */

export const ACTIVITY_TYPES = {
  JOB: 'job',
  YARD: 'yard',
  TRAVEL: 'travel',
  BREAK: 'break',
  WORKSHOP: 'workshop',
  OTHER: 'other',
}

export const ACTIVITY_LABELS = {
  job: 'Job',
  yard: 'Yard',
  travel: 'Travel',
  break: 'Break',
  workshop: 'Workshop',
  other: 'Other',
}

export const SHEET_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  CORRECTED: 'corrected',
}

export const QUICK_ACTIVITIES = [
  ACTIVITY_TYPES.YARD,
  ACTIVITY_TYPES.TRAVEL,
  ACTIVITY_TYPES.BREAK,
  ACTIVITY_TYPES.WORKSHOP,
  ACTIVITY_TYPES.OTHER,
]

export function createEmptySegment(overrides = {}) {
  return {
    id: '',
    cloudId: null,
    dailySheetId: '',
    dailySheetCloudId: null,
    jobName: '',
    activityType: ACTIVITY_TYPES.JOB,
    startedAt: '',
    endedAt: '',
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

export function createEmptyDailySheet(overrides = {}) {
  return {
    id: '',
    cloudId: null,
    cloudUserId: null,
    sheetDate: '',
    truckVehicle: '',
    status: SHEET_STATUSES.DRAFT,
    startedAt: '',
    finishedAt: '',
    timesheetCloudId: null,
    segments: [],
    createdAt: '',
    updatedAt: '',
    syncStatus: null,
    storageSource: 'local',
    ...overrides,
  }
}

function parseIso(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function getActiveSegment(segments) {
  return segments.find((segment) => !segment.endedAt) ?? null
}

export function segmentsOverlap(a, b) {
  const aStart = parseIso(a.startedAt)
  const aEnd = parseIso(a.endedAt) ?? new Date()
  const bStart = parseIso(b.startedAt)
  const bEnd = parseIso(b.endedAt) ?? new Date()
  if (!aStart || !bStart) return false
  return aStart < bEnd && bStart < aEnd
}

/**
 * Validate segment set: no overlaps, at most one active segment.
 */
export function validateSegments(segments, { allowActive = true } = {}) {
  const errors = []
  const active = getActiveSegment(segments)

  if (!allowActive && active) {
    errors.push('Submitted days cannot have an active segment.')
  }

  if (active && segments.filter((s) => !s.endedAt).length > 1) {
    errors.push('Only one active segment is allowed per day.')
  }

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]
    const start = parseIso(segment.startedAt)
    const end = parseIso(segment.endedAt)

    if (!start) {
      errors.push(`Segment ${i + 1}: start time is required.`)
      continue
    }

    if (segment.endedAt && !end) {
      errors.push(`Segment ${i + 1}: invalid end time.`)
      continue
    }

    if (end && end <= start) {
      errors.push(`Segment ${i + 1}: end must be after start.`)
    }

    if (segment.activityType === ACTIVITY_TYPES.JOB && !segment.jobName?.trim()) {
      errors.push(`Segment ${i + 1}: job name is required for job activities.`)
    }

    for (let j = i + 1; j < segments.length; j += 1) {
      if (segmentsOverlap(segment, segments[j])) {
        errors.push(`Segments ${i + 1} and ${j + 1} overlap.`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export function segmentDurationMinutes(segment, now = new Date()) {
  const start = parseIso(segment.startedAt)
  if (!start) return 0
  const end = parseIso(segment.endedAt) ?? now
  return Math.max(0, Math.round((end - start) / 60000))
}

export function formatElapsedSince(startedAt, now = new Date()) {
  const start = parseIso(startedAt)
  if (!start) return '—'
  const mins = Math.max(0, Math.round((now - start) / 60000))
  const hours = Math.floor(mins / 60)
  const minutes = mins % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

export function formatSegmentDuration(segment, now = new Date()) {
  const mins = segmentDurationMinutes(segment, now)
  const hours = Math.floor(mins / 60)
  const minutes = mins % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

export function computeDayWorkMinutes(segments, now = new Date()) {
  return segments
    .filter((s) => s.activityType !== ACTIVITY_TYPES.BREAK)
    .reduce((sum, segment) => sum + segmentDurationMinutes(segment, now), 0)
}

export function computeBreakMinutes(segments, now = new Date()) {
  return segments
    .filter((s) => s.activityType === ACTIVITY_TYPES.BREAK)
    .reduce((sum, segment) => sum + segmentDurationMinutes(segment, now), 0)
}

export function detectTimeGaps(segments) {
  const sorted = [...segments]
    .filter((s) => s.startedAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  const gaps = []
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const currentEnd = parseIso(sorted[i].endedAt)
    const nextStart = parseIso(sorted[i + 1].startedAt)
    if (!currentEnd || !nextStart || nextStart <= currentEnd) continue
    const gapMins = Math.round((nextStart - currentEnd) / 60000)
    if (gapMins > 0) {
      gaps.push({
        afterSegmentId: sorted[i].id || sorted[i].cloudId,
        beforeSegmentId: sorted[i + 1].id || sorted[i + 1].cloudId,
        gapMinutes: gapMins,
        from: sorted[i].endedAt,
        to: sorted[i + 1].startedAt,
      })
    }
  }
  return gaps
}

export function groupSegmentsByJob(segments, now = new Date()) {
  const groups = new Map()
  segments.forEach((segment) => {
    if (segment.activityType !== ACTIVITY_TYPES.JOB) return
    const key = segment.jobName?.trim() || '—'
    const mins = segmentDurationMinutes(segment, now)
    groups.set(key, (groups.get(key) ?? 0) + mins)
  })
  return [...groups.entries()]
    .map(([jobName, minutes]) => ({ jobName, minutes, hours: Math.round((minutes / 60) * 100) / 100 }))
    .sort((a, b) => b.minutes - a.minutes)
}

export function sortSegmentsChronologically(segments) {
  return [...segments].sort((a, b) => {
    const aStart = a.startedAt || ''
    const bStart = b.startedAt || ''
    return aStart.localeCompare(bStart)
  })
}

export function getActivityLabel(segment) {
  if (segment.activityType === ACTIVITY_TYPES.JOB) {
    return segment.jobName?.trim() || 'Job'
  }
  return ACTIVITY_LABELS[segment.activityType] || segment.activityType
}

export function formatTimeFromIso(iso) {
  if (!iso) return '—'
  const date = parseIso(iso)
  if (!date) return '—'
  return date.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false })
}
