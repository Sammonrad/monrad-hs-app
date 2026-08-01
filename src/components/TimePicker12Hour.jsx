import { useEffect, useId, useMemo, useState } from 'react'
import {
  from24Hour,
  to24Hour,
  getMinuteOptions,
} from '../utils/time12Hour.js'

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const AMPM_OPTIONS = ['AM', 'PM']

/**
 * Mobile-friendly 12-hour time picker.
 * Value / onChange use stored 24-hour `HH:mm` (or '') for drop-in replacement of type="time".
 */
export function TimePicker12Hour({
  value = '',
  onChange,
  id,
  disabled = false,
  required = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}) {
  const autoId = useId()
  const baseId = id || `time-12h-${autoId}`
  const parsed = useMemo(() => from24Hour(value), [value])
  const [parts, setParts] = useState(parsed)

  useEffect(() => {
    setParts(parsed)
  }, [parsed.hour, parsed.minute, parsed.ampm])

  const minuteOptions = useMemo(() => getMinuteOptions(parts.minute), [parts.minute])

  function updateParts(patch) {
    const next = { ...parts, ...patch }
    setParts(next)
    if (!onChange) return
    if (next.hour && next.minute !== '' && next.ampm) {
      onChange(to24Hour(next.hour, next.minute, next.ampm))
      return
    }
    // Only clear the stored value once a previously complete time becomes incomplete.
    if (value) onChange('')
  }

  const groupLabel = ariaLabel || 'Time'

  return (
    <div
      className="time-picker-12h"
      role="group"
      aria-label={ariaLabelledBy ? undefined : groupLabel}
      aria-labelledby={ariaLabelledBy}
    >
      <div className="time-picker-12h__clock">
        <label className="time-picker-12h__part" htmlFor={`${baseId}-hour`}>
          <span className="visually-hidden">Hour</span>
          <select
            id={`${baseId}-hour`}
            className="field__input time-picker-12h__select time-picker-12h__select--hour"
            value={parts.hour}
            onChange={(e) => updateParts({ hour: e.target.value })}
            disabled={disabled}
            required={required}
            aria-label={`${groupLabel} hour`}
          >
            <option value="">—</option>
            {HOUR_OPTIONS.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </label>

        <span className="time-picker-12h__sep" aria-hidden="true">
          :
        </span>

        <label className="time-picker-12h__part" htmlFor={`${baseId}-minute`}>
          <span className="visually-hidden">Minute</span>
          <select
            id={`${baseId}-minute`}
            className="field__input time-picker-12h__select time-picker-12h__select--minute"
            value={parts.minute}
            onChange={(e) => updateParts({ minute: e.target.value })}
            disabled={disabled}
            required={required}
            aria-label={`${groupLabel} minute`}
          >
            <option value="">—</option>
            {minuteOptions.map((minute) => (
              <option key={minute} value={minute}>
                {minute}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="time-picker-12h__part time-picker-12h__part--ampm" htmlFor={`${baseId}-ampm`}>
        <span className="visually-hidden">AM or PM</span>
        <select
          id={`${baseId}-ampm`}
          className="field__input time-picker-12h__select time-picker-12h__select--ampm"
          value={parts.ampm}
          onChange={(e) => updateParts({ ampm: e.target.value })}
          disabled={disabled}
          required={required}
          aria-label={`${groupLabel} AM or PM`}
        >
          <option value="">—</option>
          {AMPM_OPTIONS.map((period) => (
            <option key={period} value={period}>
              {period}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
