import { getDocumentExpiryStatus } from '../../utils/equipmentCompliance.js'

export function ComplianceExpiryBadge({ document }) {
  const status = getDocumentExpiryStatus(document)
  return (
    <span className={`compliance-expiry-badge compliance-expiry-badge--${status.level}`}>
      {status.label}
    </span>
  )
}
