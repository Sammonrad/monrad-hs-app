import { formatHoursTotal } from '../utils/weeklyTimesheet.js'
import { formatDecimalHoursDisplay } from '../utils/formatting.js'

export function WeeklyPrintSummary({ totals, weekGroups, filterDescription, generatedAt }) {
  return (
    <article className="print-record weekly-print">
      <header className="print-record__header">
        <p className="print-record__company">Monrad Earthworx</p>
        <h1 className="print-record__title">Weekly Timesheet Summary</h1>
        <p className="print-record__meta">Generated {generatedAt}</p>
        <p className="print-record__meta">{filterDescription}</p>
      </header>

      <section className="print-record__section">
        <h2 className="print-record__section-title">Summary totals</h2>
        <dl className="print-record__details">
          <div className="print-record__row">
            <dt>Total hours worked</dt>
            <dd>{formatHoursTotal(totals.totalHoursWorked)}</dd>
          </div>
          <div className="print-record__row">
            <dt>Total chargeable hours</dt>
            <dd>{formatHoursTotal(totals.totalChargeableHours)}</dd>
          </div>
          <div className="print-record__row">
            <dt>Total non-chargeable hours</dt>
            <dd>{formatHoursTotal(totals.totalNonChargeableHours)}</dd>
          </div>
          <div className="print-record__row">
            <dt>Records</dt>
            <dd>{totals.recordCount}</dd>
          </div>
          <div className="print-record__row">
            <dt>Days worked</dt>
            <dd>{totals.daysWorked}</dd>
          </div>
        </dl>
      </section>

      {weekGroups.map((group) => (
        <section key={group.weekKey} className="print-record__section">
          <h2 className="print-record__section-title">{group.weekLabel}</h2>
          <table className="weekly-print__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Job</th>
                <th>Site</th>
                <th>Machine</th>
                <th>Start</th>
                <th>Finish</th>
                <th>Break</th>
                <th>Total</th>
                <th>Chargeable</th>
                <th>Non-ch.</th>
                <th>Work completed</th>
              </tr>
            </thead>
            <tbody>
              {group.records.map((record) => {
                const fields = record.fields ?? {}
                return (
                  <tr key={record.id}>
                    <td>{fields.date || '—'}</td>
                    <td>{fields.employeeName || '—'}</td>
                    <td>{fields.jobProjectName || '—'}</td>
                    <td>{fields.siteLocation || '—'}</td>
                    <td>{fields.machineUsed || '—'}</td>
                    <td>{fields.startTime || '—'}</td>
                    <td>{fields.finishTime || '—'}</td>
                    <td>{fields.breakMinutes ? `${fields.breakMinutes}m` : '—'}</td>
                    <td>{fields.totalHoursWorked || '—'}</td>
                    <td>{formatDecimalHoursDisplay(fields.chargeableHours) || '—'}</td>
                    <td>{formatDecimalHoursDisplay(fields.nonChargeableHours) || '—'}</td>
                    <td>{fields.workCompleted || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ))}

      <footer className="print-record__footer">
        Monrad Earthworx — Weekly Timesheet Summary — {generatedAt}
      </footer>
    </article>
  )
}
