import { StatusBadge } from '../common/StatusBadge.jsx'

const STATUS_VARIANTS = {
  Available: 'active',
  'In Use': 'in-progress',
  Maintenance: 'pending',
  'Out of Service': 'overdue',
}

export function EquipmentStatusBadge({ status }) {
  return (
    <StatusBadge
      status={status}
      label={status || '—'}
      variant={STATUS_VARIANTS[status] ?? 'default'}
      className="equipment-status-badge"
    />
  )
}
