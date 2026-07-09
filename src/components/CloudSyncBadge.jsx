import {
  getSyncStatusLabel,
  getSyncStatusModifier,
  resolveRecordSyncStatus,
} from '../utils/storage/cloudSyncStatus.js'

export function CloudSyncBadge({ record, syncStatus, size = 'default', className = '' }) {
  const status = syncStatus ?? resolveRecordSyncStatus(record)
  const label = getSyncStatusLabel(status)
  const modifier = getSyncStatusModifier(status)
  const sizeClass = size === 'small' ? 'cloud-sync-status--small' : ''

  return (
    <span
      className={['cloud-sync-status', modifier, sizeClass, className].filter(Boolean).join(' ')}
      role="status"
    >
      {label}
    </span>
  )
}
