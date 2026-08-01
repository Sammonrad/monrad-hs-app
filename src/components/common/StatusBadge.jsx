/**
 * Shared status / label badge. Prefer this for Draft/Open/Completed/etc.
 * CloudSyncBadge keeps its own semantics and is not replaced.
 */

const VARIANT_MAP = {
  draft: 'draft',
  open: 'open',
  'in progress': 'in-progress',
  in_progress: 'in-progress',
  'in-progress': 'in-progress',
  completed: 'completed',
  complete: 'completed',
  overdue: 'overdue',
  critical: 'critical',
  archived: 'archived',
  cloud: 'cloud',
  local: 'local',
  pending: 'pending',
  active: 'active',
  disabled: 'disabled',
  submitted: 'submitted',
  approved: 'approved',
  closed: 'closed',
  deferred: 'deferred',
  resolved: 'completed',
  available: 'active',
  'in use': 'in-progress',
  'in-use': 'in-progress',
  maintenance: 'pending',
  'out of service': 'overdue',
  'out-of-service': 'overdue',
  minor: 'draft',
  major: 'pending',
  serious: 'critical',
  ready: 'pending',
  'ready for review': 'pending',
  'ready-for-review': 'pending',
}

function toVariant(status, variant) {
  if (variant) return variant
  if (!status) return 'default'
  const key = String(status).trim().toLowerCase()
  return VARIANT_MAP[key] ?? 'default'
}

export function StatusBadge({
  status,
  label,
  variant,
  size = 'default',
  className = '',
}) {
  const text = label ?? status ?? '—'
  const resolved = toVariant(status ?? label, variant)
  const sizeClass = size === 'small' ? 'status-badge--small' : ''

  return (
    <span
      className={['status-badge', `status-badge--${resolved}`, sizeClass, className]
        .filter(Boolean)
        .join(' ')}
    >
      {text}
    </span>
  )
}
