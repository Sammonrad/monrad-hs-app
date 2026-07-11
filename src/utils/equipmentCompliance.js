import { COMPLIANCE_THRESHOLDS } from '../constants/complianceConfig.js'
import { TODAY } from '../constants/index.js'

function daysBetween(fromDate, toDate) {
  const from = new Date(fromDate)
  const to = new Date(toDate)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

export function getDocumentExpiryStatus(document, thresholds = COMPLIANCE_THRESHOLDS) {
  const expiry = document.expiryDate?.trim()
  if (!expiry) return { level: 'none', label: 'No expiry entered' }

  const today = TODAY()
  const days = daysBetween(today, expiry)
  if (days == null) return { level: 'none', label: 'No expiry entered' }
  if (days < 0) return { level: 'expired', label: 'Expired' }
  if (days <= thresholds.expiringSoonDays)
    return { level: 'expiring-soon', label: 'Expires within 30 days' }
  return { level: 'current', label: 'Current' }
}

export function isDocumentExpired(document) {
  return getDocumentExpiryStatus(document).level === 'expired'
}

export function isDocumentExpiringSoon(document) {
  return getDocumentExpiryStatus(document).level === 'expiring-soon'
}
