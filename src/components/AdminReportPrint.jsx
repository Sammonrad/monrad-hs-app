import { MonradLogo } from './MonradLogo.jsx'
import { formatHoursTotal } from '../utils/weeklyTimesheet.js'

export function AdminReportPrint({ summary, groups, filterDescription, generatedAt }) {
  return (
    <article className="print-record admin-report-print">
      <header className="print-record__header">
        <MonradLogo variant="print" />
        <h1 className="print-record__title">Admin H&amp;S Report</h1>
        <p className="print-record__meta">Generated {generatedAt}</p>
        <p className="print-record__meta">{filterDescription}</p>
      </header>

      <section className="print-record__section">
        <h2 className="print-record__section-title">Summary</h2>
        <dl className="print-record__details admin-report-print__summary">
          <div className="print-record__row">
            <dt>Timesheets</dt>
            <dd>{summary.totalTimesheets}</dd>
          </div>
          <div className="print-record__row">
            <dt>Total labour hours</dt>
            <dd>{formatHoursTotal(summary.totalLabourHours)}</dd>
          </div>
          <div className="print-record__row">
            <dt>Total chargeable hours</dt>
            <dd>{formatHoursTotal(summary.totalChargeableHours)}</dd>
          </div>
          <div className="print-record__row">
            <dt>Job starts</dt>
            <dd>{summary.totalJobStarts}</dd>
          </div>
          <div className="print-record__row">
            <dt>Pre-starts</dt>
            <dd>{summary.totalPreStarts}</dd>
          </div>
          <div className="print-record__row">
            <dt>Toolbox meetings</dt>
            <dd>{summary.totalToolbox}</dd>
          </div>
          <div className="print-record__row">
            <dt>Incidents / near misses</dt>
            <dd>{summary.totalIncidents}</dd>
          </div>
          <div className="print-record__row">
            <dt>Open actions</dt>
            <dd>{summary.openActions}</dd>
          </div>
          <div className="print-record__row">
            <dt>Overdue actions</dt>
            <dd>{summary.overdueActions}</dd>
          </div>
          <div className="print-record__row">
            <dt>Critical actions</dt>
            <dd>{summary.criticalActions}</dd>
          </div>
          <div className="print-record__row">
            <dt>Machine defects recorded</dt>
            <dd>{summary.machineDefects}</dd>
          </div>
          <div className="print-record__row">
            <dt>Unresolved machine defects</dt>
            <dd>{summary.unresolvedMachineDefects}</dd>
          </div>
          <div className="print-record__row">
            <dt>Unresolved incident actions</dt>
            <dd>{summary.unresolvedIncidentActions}</dd>
          </div>
        </dl>
      </section>

      {groups.map((group) => (
        <section key={group.id} className="print-record__section">
          <h2 className="print-record__section-title">
            {group.title} ({group.rows.length})
          </h2>
          <table className="admin-report-print__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Staff</th>
                <th>Site</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date || '—'}</td>
                  <td>{row.staff || '—'}</td>
                  <td>{row.site || '—'}</td>
                  <td>{row.description || '—'}</td>
                  <td>{row.status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <footer className="print-record__footer">
        Monrad Earthworx — Admin H&amp;S Report — {generatedAt}
      </footer>
    </article>
  )
}
