import { VISITOR_ACKNOWLEDGEMENT_ITEMS } from '../constants/index.js'
import { formatSubmittedAt } from '../utils/formatting.js'
import { formatVisitorDuration, getVisitorStatusLabel } from '../utils/visitorSignIn.js'

export function PrintableVisitorRecord({ record }) {
  const status = getVisitorStatusLabel(record)

  return (
    <article className="print-record print-visitor">
      <header className="print-record__header print-header">
        <p className="print-record__company print-header__company">Monrad Earthworx</p>
        <h1 className="print-record__title">Visitor Sign-In Record</h1>
        <p className="print-record__meta">{status}</p>
      </header>

      <section className="print-record__section">
        <h2 className="print-record__section-title">Visitor details</h2>
        <dl className="print-record__details">
          <div className="print-record__row">
            <dt>Visitor name</dt>
            <dd>{record.visitorName || '—'}</dd>
          </div>
          <div className="print-record__row">
            <dt>Company</dt>
            <dd>{record.company || '—'}</dd>
          </div>
          <div className="print-record__row">
            <dt>Phone</dt>
            <dd>{record.phone || '—'}</dd>
          </div>
          <div className="print-record__row">
            <dt>Site</dt>
            <dd>{record.siteName || '—'}</dd>
          </div>
          <div className="print-record__row">
            <dt>Purpose of visit</dt>
            <dd>{record.purpose || '—'}</dd>
          </div>
          <div className="print-record__row">
            <dt>Person visited</dt>
            <dd>{record.personVisited || '—'}</dd>
          </div>
          <div className="print-record__row">
            <dt>Vehicle registration</dt>
            <dd>{record.vehicleReg || '—'}</dd>
          </div>
          <div className="print-record__row">
            <dt>Hazards / concerns reported</dt>
            <dd>{record.hazardsReported || '—'}</dd>
          </div>
          <div className="print-record__row">
            <dt>Notes</dt>
            <dd>{record.notes || '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="print-record__section">
        <h2 className="print-record__section-title">Times</h2>
        <dl className="print-record__details">
          <div className="print-record__row">
            <dt>Arrival</dt>
            <dd>{formatSubmittedAt(record.arrivalTime)}</dd>
          </div>
          <div className="print-record__row">
            <dt>Departure</dt>
            <dd>{record.departureTime ? formatSubmittedAt(record.departureTime) : 'Still on site'}</dd>
          </div>
          <div className="print-record__row">
            <dt>Duration</dt>
            <dd>{formatVisitorDuration(record.arrivalTime, record.departureTime)}</dd>
          </div>
        </dl>
      </section>

      <section className="print-record__section">
        <h2 className="print-record__section-title">Acknowledgements</h2>
        <ul className="print-record__checklist">
          {VISITOR_ACKNOWLEDGEMENT_ITEMS.map((item) => (
            <li key={item.key}>
              {record.acknowledgements?.[item.key] ? '✓' : '✗'} {item.label}
            </li>
          ))}
        </ul>
        <p className="print-record__signature-text">
          Declaration confirmed by: {record.declarationName || record.visitorName || '—'}
        </p>
      </section>

      <footer className="print-record__footer">
        Monrad Earthworx — Visitor Sign-In — printed{' '}
        {formatSubmittedAt(new Date())}
      </footer>
    </article>
  )
}
