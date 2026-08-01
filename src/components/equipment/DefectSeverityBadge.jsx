import { StatusBadge } from '../common/StatusBadge.jsx'

const SEVERITY_VARIANTS = {
  Minor: 'draft',
  Major: 'pending',
  Critical: 'critical',
}

export function DefectSeverityBadge({ severity }) {
  return (
    <StatusBadge
      status={severity}
      label={severity || '—'}
      variant={SEVERITY_VARIANTS[severity] ?? 'default'}
      className="defect-severity-badge"
    />
  )
}
