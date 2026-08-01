/** 5-minute grid used by the 12-hour time picker. */
export const TIME_MINUTE_OPTIONS = Object.freeze(
  Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')),
)

/**
 * Convert 12-hour parts to 24-hour `HH:mm`.
 * @param {string|number} hour12 1–12
 * @param {string|number} minute 0–59
 * @param {'AM'|'PM'|string} ampm
 * @returns {string} `HH:mm` or ''
 */
export function to24Hour(hour12, minute, ampm) {
  if (hour12 === '' || hour12 == null || minute === '' || minute == null || !ampm) return ''
  let hour = Number(hour12)
  const min = Number(minute)
  const period = String(ampm).toUpperCase()
  if (!Number.isInteger(hour) || hour < 1 || hour > 12) return ''
  if (!Number.isInteger(min) || min < 0 || min > 59) return ''
  if (period !== 'AM' && period !== 'PM') return ''

  if (period === 'AM') {
    if (hour === 12) hour = 0
  } else if (hour !== 12) {
    hour += 12
  }

  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/**
 * Parse 24-hour `HH:mm` (or `H:mm`) into 12-hour parts.
 * Invalid / blank → empty parts (safe for legacy free-text).
 * @param {string} hhmm
 * @returns {{ hour: string, minute: string, ampm: string }}
 */
export function from24Hour(hhmm) {
  const empty = { hour: '', minute: '', ampm: '' }
  if (!hhmm?.trim()) return empty

  const match = String(hhmm).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return empty

  const hour24 = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour24) || hour24 < 0 || hour24 > 23) return empty
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return empty

  const ampm = hour24 >= 12 ? 'PM' : 'AM'
  let hour = hour24 % 12
  if (hour === 0) hour = 12

  return {
    hour: String(hour),
    minute: String(minute).padStart(2, '0'),
    ampm,
  }
}

/**
 * Display helper for stored `HH:mm` values.
 * Returns '' for blank; original trimmed string if unparseable (legacy-safe).
 * @param {string} hhmm
 * @returns {string}
 */
export function formatTime12Hour(hhmm) {
  if (!hhmm?.trim()) return ''
  const parts = from24Hour(hhmm)
  if (!parts.hour) return String(hhmm).trim()
  return `${parts.hour}:${parts.minute} ${parts.ampm}`
}

/**
 * Minute `<option>` values: 00–55 step 5, plus the stored minute when off-grid
 * so opening a record never changes the value.
 * @param {string|number} [currentMinute]
 * @returns {string[]}
 */
export function getMinuteOptions(currentMinute) {
  const options = [...TIME_MINUTE_OPTIONS]
  if (currentMinute === '' || currentMinute == null) return options

  const padded = String(Number(currentMinute)).padStart(2, '0')
  if (Number.isNaN(Number(currentMinute)) || Number(currentMinute) < 0 || Number(currentMinute) > 59) {
    return options
  }
  if (!options.includes(padded)) {
    options.push(padded)
    options.sort((a, b) => Number(a) - Number(b))
  }
  return options
}

/** Local `YYYY-MM-DD` from an ISO timestamp (for date + time split pickers). */
export function isoToLocalDatePart(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Local `HH:mm` from an ISO timestamp. */
export function isoToLocalTimePart(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** Combine local date (`YYYY-MM-DD`) + `HH:mm` into an ISO string. */
export function localDateAndTimeToIso(dateStr, timeStr) {
  if (!dateStr?.trim()) return ''
  const time = timeStr?.trim() || '00:00'
  const date = new Date(`${dateStr.trim()}T${time}:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}
