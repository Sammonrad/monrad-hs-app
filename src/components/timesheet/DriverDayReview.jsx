import {
  computeBreakMinutes,
  computeDayWorkMinutes,
  detectTimeGaps,
  formatSegmentDuration,
  formatTimeFromIso,
  getActivityLabel,
  groupSegmentsByJob,
  SHEET_STATUSES,
  sortSegmentsChronologically,
} from '../../utils/driverDaySegments.js'
import { computeDailyLoadSummary } from '../../utils/driverLoads.js'

export function DriverDayReview({
  sheet,
  loads,
  onEditSegment,
  onSubmit,
  submitting = false,
  editable = true,
}) {
  const segments = sortSegmentsChronologically(sheet.segments ?? [])
  const summary = computeDailyLoadSummary(loads)
  const workMins = computeDayWorkMinutes(segments)
  const breakMins = computeBreakMinutes(segments)
  const gaps = detectTimeGaps(segments)
  const byJob = groupSegmentsByJob(segments)

  const missingTickets = loads.filter(
    (load) => !load.ticketNumber?.trim() || !load.netWeightTonnes,
  )

  return (
    <div className="driver-day-review">
      <header className="driver-day-review__header">
        <h2 className="driver-day-review__title">Review day</h2>
        <p className="driver-day-review__status">
          Status: <strong>{sheet.status}</strong>
        </p>
      </header>

      <div className="driver-day-review__stats">
        <div className="driver-day-review__stat">
          <span className="driver-day-review__stat-value">
            {formatTimeFromIso(sheet.startedAt)}
          </span>
          <span className="driver-day-review__stat-label">Started</span>
        </div>
        <div className="driver-day-review__stat">
          <span className="driver-day-review__stat-value">
            {sheet.finishedAt ? formatTimeFromIso(sheet.finishedAt) : '—'}
          </span>
          <span className="driver-day-review__stat-label">Finished</span>
        </div>
        <div className="driver-day-review__stat">
          <span className="driver-day-review__stat-value">
            {Math.round((workMins / 60) * 100) / 100}h
          </span>
          <span className="driver-day-review__stat-label">Work time</span>
        </div>
        <div className="driver-day-review__stat">
          <span className="driver-day-review__stat-value">
            {Math.round((breakMins / 60) * 100) / 100}h
          </span>
          <span className="driver-day-review__stat-label">Breaks</span>
        </div>
        <div className="driver-day-review__stat">
          <span className="driver-day-review__stat-value">{summary.totalTrips}</span>
          <span className="driver-day-review__stat-label">Loads</span>
        </div>
        <div className="driver-day-review__stat">
          <span className="driver-day-review__stat-value">{summary.totalNetTonnes}</span>
          <span className="driver-day-review__stat-label">Tonnes</span>
        </div>
      </div>

      {byJob.length > 0 && (
        <section className="driver-day-review__section">
          <h3>Time by job</h3>
          <ul className="driver-day-review__list">
            {byJob.map((item) => (
              <li key={item.jobName}>
                {item.jobName}: {item.hours}h
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.byMaterial.length > 0 && (
        <section className="driver-day-review__section">
          <h3>Tonnes by material</h3>
          <ul className="driver-day-review__list">
            {summary.byMaterial.map((item) => (
              <li key={item.label}>{item.label}: {item.tonnes} t</li>
            ))}
          </ul>
        </section>
      )}

      {summary.byQuarry.length > 0 && (
        <section className="driver-day-review__section">
          <h3>Tonnes by quarry</h3>
          <ul className="driver-day-review__list">
            {summary.byQuarry.map((item) => (
              <li key={item.label}>{item.label}: {item.tonnes} t</li>
            ))}
          </ul>
        </section>
      )}

      {gaps.length > 0 && (
        <section className="driver-day-review__section driver-day-review__warnings">
          <h3>Time gaps</h3>
          <ul className="driver-day-review__list">
            {gaps.map((gap) => (
              <li key={`${gap.from}-${gap.to}`}>
                {gap.gapMinutes} min gap between segments
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.duplicateTicketCount > 0 && (
        <p className="driver-day-review__warning" role="alert">
          {summary.duplicateTicketCount} duplicate ticket warning(s)
        </p>
      )}

      {missingTickets.length > 0 && (
        <p className="driver-day-review__warning" role="alert">
          {missingTickets.length} ticket(s) missing required info
        </p>
      )}

      <section className="driver-day-review__section">
        <h3>Segments</h3>
        <ul className="driver-day-review__segments">
          {segments.map((segment) => (
            <li key={segment.id || segment.cloudId}>
              <span>{getActivityLabel(segment)}</span>
              <span>{formatSegmentDuration(segment)}</span>
              {editable && onEditSegment && (
                <button
                  type="button"
                  className="btn btn--small btn--secondary"
                  onClick={() => onEditSegment(segment)}
                >
                  Edit
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {editable && sheet.status === SHEET_STATUSES.DRAFT && onSubmit && (
        <button
          type="button"
          className="driver-day-btn driver-day-btn--primary driver-day-btn--block"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting…' : 'Submit Daily Sheet'}
        </button>
      )}

      {sheet.status === SHEET_STATUSES.SUBMITTED && (
        <p className="driver-day-review__submitted" role="status">
          Daily sheet submitted — editing locked for driver.
        </p>
      )}
    </div>
  )
}
