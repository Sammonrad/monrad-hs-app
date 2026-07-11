const STATUS_MODIFIERS = {
  Available: 'available',
  'In Use': 'in-use',
  Maintenance: 'maintenance',
  'Out of Service': 'out-of-service',
}

export function EquipmentStatusBadge({ status }) {
  const modifier = STATUS_MODIFIERS[status] ?? 'default'
  return <span className={`equipment-status-badge equipment-status-badge--${modifier}`}>{status || '—'}</span>
}
