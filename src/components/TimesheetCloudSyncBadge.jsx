import {
  getSyncStatusLabel,
  getSyncStatusModifier,
  resolveRecordSyncStatus,
} from '../utils/storage/timesheetCloudStorage.js'

export function TimesheetCloudSyncBadge({ record, syncStatus, size = 'default', className = '' }) {
  const status = syncStatus ?? resolveRecordSyncStatus(record)
  const label = getSyncStatusLabel(status)
  const modifier = getSyncStatusModifier(status)
  const sizeClass = size === 'small' ? 'cloud-sync-status--small' : ''

  return (
    <span
      className={`cloud-sync-status ${modifier} ${sizeClass} ${className}`.trim()}
      role="status"
    >
      {label}
    </span>
  )
}
