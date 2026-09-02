import { useEffect, useState } from 'react'
import {
  formatElapsedSince,
  getActivityLabel,
} from '../../utils/driverDaySegments.js'

export function CurrentJobPanel({ segment }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (segment?.endedAt) return undefined
    const timer = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(timer)
  }, [segment?.endedAt, segment?.startedAt])

  if (!segment) {
    return (
      <div className="driver-current-job driver-current-job--empty">
        <p className="driver-current-job__label">Current job</p>
        <p className="driver-current-job__empty-text">No active segment</p>
      </div>
    )
  }

  return (
    <div className="driver-current-job">
      <p className="driver-current-job__label">Current job</p>
      <p className="driver-current-job__name">{getActivityLabel(segment)}</p>
      <p className="driver-current-job__activity">{segment.activityType}</p>
      <p className="driver-current-job__elapsed">
        {segment.endedAt ? 'Finished' : formatElapsedSince(segment.startedAt, now)}
      </p>
    </div>
  )
}
