import { getMaintenanceDueStatus } from '../../utils/equipmentMaintenance.js'

export function MaintenanceDueBadge({ equipment }) {
  const status = getMaintenanceDueStatus(equipment)
  if (status.level === 'current') {
    return <span className="maintenance-due-badge maintenance-due-badge--current">Current</span>
  }
  return (
    <span className={`maintenance-due-badge maintenance-due-badge--${status.level}`}>
      {status.primary?.label ?? status.level}
    </span>
  )
}
