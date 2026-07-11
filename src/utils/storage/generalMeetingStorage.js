import { GENERAL_MEETING_STORAGE_KEY } from '../../constants/storageKeys.js'
import { TODAY } from '../../constants/index.js'
import { createRecordId } from '../ids.js'

export function createEmptyMeetingAction() {
  return {
    id: createRecordId(),
    description: '',
    personResponsible: '',
    priority: 'medium',
    dueDate: '',
    status: 'open',
    linkedActionId: null,
  }
}

export function createEmptyPreviousAction() {
  return {
    id: createRecordId(),
    description: '',
    progress: '',
  }
}

export function createEmptyMeeting() {
  const today = TODAY()
  return {
    id: createRecordId(),
    cloudId: null,
    status: 'draft',
    meetingDate: today,
    meetingTime: '',
    location: '',
    meetingType: 'weekly',
    scheduleFrequency: 'weekly',
    nextMeetingDate: calculateNextMeetingDate(today, 'weekly'),
    chairperson: '',
    attendees: '',
    absentees: '',
    previousActions: [],
    incidentsSinceLast: '',
    newHazardsAndRisks: '',
    machineDefectsMaintenance: '',
    trainingCompetency: '',
    workerConcerns: '',
    policiesReviewed: '',
    upcomingWork: '',
    generalDiscussion: '',
    newActions: [],
    attendeeSignOff: '',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    submittedAt: null,
    syncStatus: null,
    storageSource: 'local',
  }
}

export function normalizeMeeting(record) {
  if (!record || typeof record !== 'object') return createEmptyMeeting()
  return {
    ...createEmptyMeeting(),
    ...record,
    id: record.id || createRecordId(),
    previousActions: Array.isArray(record.previousActions)
      ? record.previousActions.map((item) => ({
          ...createEmptyPreviousAction(),
          ...item,
          id: item.id || createRecordId(),
        }))
      : [],
    newActions: Array.isArray(record.newActions)
      ? record.newActions.map((item) => ({
          ...createEmptyMeetingAction(),
          ...item,
          id: item.id || createRecordId(),
        }))
      : [],
  }
}

export function loadMeetings() {
  try {
    const raw = localStorage.getItem(GENERAL_MEETING_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeMeeting) : []
  } catch {
    return []
  }
}

export function persistMeetings(meetings) {
  try {
    localStorage.setItem(GENERAL_MEETING_STORAGE_KEY, JSON.stringify(meetings))
    return true
  } catch {
    window.alert('Could not save H&S General Meeting records to this device.')
    return false
  }
}

export function duplicateMeeting(record) {
  const copy = normalizeMeeting({
    ...record,
    id: createRecordId(),
    cloudId: null,
    status: 'draft',
    submittedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    syncStatus: null,
    storageSource: 'local',
    newActions: (record.newActions ?? []).map((action) => ({
      ...action,
      id: createRecordId(),
      linkedActionId: null,
      status: 'open',
    })),
    previousActions: (record.previousActions ?? []).map((action) => ({
      ...action,
      id: createRecordId(),
    })),
  })
  return copy
}

export function calculateNextMeetingDate(fromDate, frequency) {
  if (!fromDate) return ''
  const base = new Date(fromDate)
  if (Number.isNaN(base.getTime())) return ''
  const next = new Date(base)
  if (frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1)
  } else {
    next.setDate(next.getDate() + 7)
  }
  return next.toISOString().slice(0, 10)
}

export function filterMeetings(records, { status = 'all', search = '', meetingType = '' } = {}) {
  const q = search.trim().toLowerCase()
  return (records ?? [])
    .filter((record) => {
      if (status !== 'all' && record.status !== status) return false
      if (meetingType && record.meetingType !== meetingType) return false
      if (!q) return true
      const haystack = [
        record.meetingDate,
        record.location,
        record.chairperson,
        record.attendees,
        record.meetingType,
        record.generalDiscussion,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
    .sort((a, b) => {
      const dateA = a.meetingDate || a.createdAt || ''
      const dateB = b.meetingDate || b.createdAt || ''
      return dateB.localeCompare(dateA)
    })
}

export function getLastCompletedMeeting(records) {
  return (records ?? [])
    .filter((record) => record.status === 'completed')
    .sort((a, b) => (b.meetingDate || '').localeCompare(a.meetingDate || ''))[0] ?? null
}
