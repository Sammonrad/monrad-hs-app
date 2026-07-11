const SEVERITY_MODIFIERS = {
  Minor: 'minor',
  Major: 'major',
  Critical: 'critical',
}

export function DefectSeverityBadge({ severity }) {
  const modifier = SEVERITY_MODIFIERS[severity] ?? 'default'
  return <span className={`defect-severity-badge defect-severity-badge--${modifier}`}>{severity || '—'}</span>
}
