import {
  formatSegmentDuration,
  formatTimeFromIso,
  getActivityLabel,
  sortSegmentsChronologically,
} from '../../utils/driverDaySegments.js'
import { parseWeightTonnes } from '../../utils/driverLoads.js'

export function DriverDayTimeline({ segments, loads = [] }) {
  const sorted = sortSegmentsChronologically(segments)

  if (!sorted.length) {
    return <p className="driver-timeline__empty">No segments yet.</p>
  }

  return (
    <ul className="driver-timeline">
      {sorted.map((segment) => {
        const segmentLoads = loads.filter(
          (load) =>
            (load.segmentCloudId && load.segmentCloudId === segment.cloudId) ||
            (load.segmentId && load.segmentId === segment.id),
        )
        const loadCount = segmentLoads.length
        const netTonnes = segmentLoads.reduce(
          (sum, load) => sum + (parseWeightTonnes(load.netWeightTonnes) ?? 0),
          0,
        )

        return (
          <li key={segment.id || segment.cloudId} className="driver-timeline__item">
            <div className="driver-timeline__times">
              <span>{formatTimeFromIso(segment.startedAt)}</span>
              <span>–</span>
              <span>{segment.endedAt ? formatTimeFromIso(segment.endedAt) : 'now'}</span>
            </div>
            <div className="driver-timeline__body">
              <p className="driver-timeline__job">{getActivityLabel(segment)}</p>
              <p className="driver-timeline__meta">
                {formatSegmentDuration(segment)}
                {loadCount > 0 && ` · ${loadCount} load${loadCount === 1 ? '' : 's'}`}
                {netTonnes > 0 && ` · ${Math.round(netTonnes * 1000) / 1000} t`}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
