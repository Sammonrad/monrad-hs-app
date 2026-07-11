export const MEETING_TYPES = ['weekly', 'monthly', 'special']

export const MEETING_TYPE_LABELS = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  special: 'Special',
}

export const MEETING_FREQUENCIES = ['weekly', 'monthly']

export const MEETING_FREQUENCY_LABELS = {
  weekly: 'Weekly',
  monthly: 'Monthly',
}

export const MEETING_STATUSES = ['draft', 'completed']

export const MEETING_STATUS_LABELS = {
  draft: 'Draft',
  completed: 'Completed',
}

export const MEETING_FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'completed', label: 'Completed' },
]

export function getMeetingDisplayTitle(meeting) {
  const date = meeting.meetingDate || 'No date'
  const type = MEETING_TYPE_LABELS[meeting.meetingType] || meeting.meetingType || 'Meeting'
  const location = meeting.location?.trim()
  return location ? `${type} — ${date} — ${location}` : `${type} — ${date}`
}
