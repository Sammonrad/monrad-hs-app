export const SSSP_STATUS = {
  DRAFT: 'draft',
  READY_FOR_REVIEW: 'ready_for_review',
  APPROVED: 'approved',
  SUBMITTED: 'submitted',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
}

export const SSSP_STATUS_LABELS = {
  [SSSP_STATUS.DRAFT]: 'Draft',
  [SSSP_STATUS.READY_FOR_REVIEW]: 'Ready for Review',
  [SSSP_STATUS.APPROVED]: 'Approved',
  [SSSP_STATUS.SUBMITTED]: 'Submitted',
  [SSSP_STATUS.CLOSED]: 'Closed',
  [SSSP_STATUS.ARCHIVED]: 'Archived',
}

export const SSSP_DASHBOARD_TABS = [
  { id: 'new', label: 'New SSSP', statuses: null, adminOnly: true },
  { id: 'drafts', label: 'Drafts', statuses: [SSSP_STATUS.DRAFT] },
  { id: 'ready', label: 'Ready for Review', statuses: [SSSP_STATUS.READY_FOR_REVIEW] },
  { id: 'approved', label: 'Approved', statuses: [SSSP_STATUS.APPROVED] },
  { id: 'submitted', label: 'Submitted', statuses: [SSSP_STATUS.SUBMITTED] },
  { id: 'closed', label: 'Closed', statuses: [SSSP_STATUS.CLOSED] },
  { id: 'archived', label: 'Archived', statuses: [SSSP_STATUS.ARCHIVED] },
]

export const SSSP_LOCKED_STATUSES = [SSSP_STATUS.APPROVED, SSSP_STATUS.SUBMITTED, SSSP_STATUS.CLOSED]

export const SSSP_STAFF_VISIBLE_STATUSES = [
  SSSP_STATUS.APPROVED,
  SSSP_STATUS.SUBMITTED,
  SSSP_STATUS.CLOSED,
]

export function getSsspStatusLabel(status) {
  return SSSP_STATUS_LABELS[status] ?? status ?? 'Unknown'
}

export function getSsspStatusModifier(status) {
  return (status ?? 'draft').replace(/_/g, '-')
}

export function isSsspLocked(status) {
  return SSSP_LOCKED_STATUSES.includes(status)
}

export function isSsspEditable(status, isAdmin) {
  if (!isAdmin) return false
  if (status === SSSP_STATUS.ARCHIVED) return false
  if (status === SSSP_STATUS.DRAFT || status === SSSP_STATUS.READY_FOR_REVIEW) return true
  return false
}
