import { formatSubmittedAt } from '../utils/formatting.js'
import { formatVisitorDuration } from '../utils/visitorSignIn.js'

export function PrintableVisitorRollCall({ visitors, siteFilter }) {
  const printedAt = formatSubmittedAt(new Date())

  return (
    <article className="print-record print-visitor-roll-call">
      <header className="print-record__header">
        <p className="print-record__company print-header__company">Monrad Earthworx</p>
        <h1 className="print-record__title">Visitor Roll Call</h1>
        <p className="print-record__meta">Emergency roll call — visitors currently on site</p>
        <p className="print-record__meta">Printed {printedAt}</p>
        {siteFilter ? <p className="print-record__meta">Site: {siteFilter}</p> : null}
      </header>

      <section className="print-record__section">
        <p className="print-record__roll-call-count">
          {visitors.length} visitor{visitors.length === 1 ? '' : 's'} on site
        </p>

        {visitors.length === 0 ? (
          <p className="print-record__meta">No visitors currently on site.</p>
        ) : (
          <table className="print-visitor-roll-call__table">
            <thead>
              <tr>
                <th scope="col">Visitor</th>
                <th scope="col">Company</th>
                <th scope="col">Site</th>
                <th scope="col">Purpose</th>
                <th scope="col">Person visited</th>
                <th scope="col">Arrival</th>
                <th scope="col">Time on site</th>
                <th scope="col">Vehicle</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((visitor) => (
                <tr key={visitor.id}>
                  <td>{visitor.visitorName || '—'}</td>
                  <td>{visitor.company || '—'}</td>
                  <td>{visitor.siteName || '—'}</td>
                  <td>{visitor.purpose || '—'}</td>
                  <td>{visitor.personVisited || '—'}</td>
                  <td>{formatSubmittedAt(visitor.arrivalTime)}</td>
                  <td>{formatVisitorDuration(visitor.arrivalTime, null)}</td>
                  <td>{visitor.vehicleReg || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="print-record__footer">
        Monrad Earthworx — Visitor Roll Call
      </footer>
    </article>
  )
}
