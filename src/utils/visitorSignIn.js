import { NZ_TIME_ZONE } from '../constants/index.js'
import { formatDurationMinutes } from './formatting.js'
import { isVisitorOnSite } from './storage/visitorSignInStorage.js'

/** YYYY-MM-DD in Pacific/Auckland for history date filters. */
export function getVisitorArrivalNzDateKey(isoString) {
  if (isoString == null || isoString === '') return ''
  const date = isoString instanceof Date ? isoString : new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NZ_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatVisitorDuration(arrivalTime, departureTime) {
  const start = new Date(arrivalTime)
  if (Number.isNaN(start.getTime())) return '—'
  const end = departureTime ? new Date(departureTime) : new Date()
  if (Number.isNaN(end.getTime())) return '—'
  const diffMs = Math.max(0, end.getTime() - start.getTime())
  const minutes = Math.floor(diffMs / 60000)
  return formatDurationMinutes(minutes)
}

export function getVisitorStatusLabel(record) {
  return isVisitorOnSite(record) ? 'On Site' : 'Signed Out'
}

export function filterVisitorHistory(records, { search = '', date = '', site = '', status = 'all' } = {}) {
  const query = search.trim().toLowerCase()

  return records.filter((record) => {
    if (status === 'on-site' && !isVisitorOnSite(record)) return false
    if (status === 'signed-out' && isVisitorOnSite(record)) return false

    if (site && record.siteName?.trim().toLowerCase() !== site.trim().toLowerCase()) {
      return false
    }

    if (date) {
      const arrivalDate = getVisitorArrivalNzDateKey(record.arrivalTime)
      if (arrivalDate !== date) return false
    }

    if (!query) return true

    const haystack = [
      record.visitorName,
      record.company,
      record.siteName,
      record.personVisited,
      record.purpose,
      record.vehicleReg,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
}

export function getUniqueVisitorSites(records) {
  const sites = new Set()
  records.forEach((record) => {
    const name = record.siteName?.trim()
    if (name) sites.add(name)
  })
  return [...sites].sort((a, b) => a.localeCompare(b))
}
