import { TODAY } from '../constants/index.js'
import { getLastCompletedMeeting } from './storage/generalMeetingStorage.js'

export function getOpenMeetingActionCount(actions = []) {
  return actions.filter(
    (action) => action.sourceType === 'general-meeting' && action.status !== 'completed',
  ).length
}

export function isMeetingOverdue(nextMeetingDate) {
  if (!nextMeetingDate?.trim()) return false
  return nextMeetingDate.trim() < TODAY()
}

export function getGeneralMeetingDashboardStats(meetings = [], actions = []) {
  const completed = meetings.filter((record) => record.status === 'completed')
  const lastCompleted = getLastCompletedMeeting(meetings)

  let nextDueDate = ''
  if (lastCompleted?.nextMeetingDate?.trim()) {
    nextDueDate = lastCompleted.nextMeetingDate.trim()
  } else if (completed.length === 0) {
    nextDueDate = ''
  }

  const draftCount = meetings.filter((record) => record.status === 'draft').length

  return {
    lastCompletedDate: lastCompleted?.meetingDate ?? null,
    nextDueDate,
    isOverdue: isMeetingOverdue(nextDueDate),
    openMeetingActions: getOpenMeetingActionCount(actions),
    draftCount,
    completedCount: completed.length,
  }
}
