import {
  buildWeeklyPrintSheets,
  formatHoursTotal,
  formatTimesheetDateDay,
} from '../utils/weeklyTimesheet.js'
import { formatTime12Hour } from '../utils/time12Hour.js'
import { formatSubmittedAt } from '../utils/formatting.js'
import { MonradLogo } from './MonradLogo.jsx'

function formatPrintedAt(value) {
  if (value) return value
  return formatSubmittedAt(new Date())
}

function WeeklyPrintSheet({ sheet, generatedAt }) {
  return (
    <article className="weekly-print__sheet">
      <header className="weekly-print__header">
        <div className="weekly-print__brand-row">
          <MonradLogo variant="print" className="weekly-print__logo" />
          <div className="weekly-print__brand-text">
            <p className="weekly-print__company">Monrad Earthworx</p>
            <h1 className="weekly-print__title">Weekly Timesheet</h1>
          </div>
          <div className="weekly-print__hours-badge">
            <span className="weekly-print__hours-label">Total weekly hours</span>
            <span className="weekly-print__hours-value">
              {formatHoursTotal(sheet.totals.totalHoursWorked)}
            </span>
          </div>
        </div>

        <dl className="weekly-print__meta">
          <div className="weekly-print__meta-item">
            <dt>Employee</dt>
            <dd>{sheet.employeeName}</dd>
          </div>
          <div className="weekly-print__meta-item">
            <dt>Week starting</dt>
            <dd>{sheet.weekStartLabel}</dd>
          </div>
          <div className="weekly-print__meta-item">
            <dt>Week ending</dt>
            <dd>{sheet.weekEndLabel}</dd>
          </div>
          <div className="weekly-print__meta-item">
            <dt>Printed</dt>
            <dd>{generatedAt}</dd>
          </div>
        </dl>
      </header>

      <table className="weekly-print__table">
        <thead>
          <tr>
            <th className="weekly-print__col-date">Date / Day</th>
            <th className="weekly-print__col-time">Start</th>
            <th className="weekly-print__col-time">Finish</th>
            <th className="weekly-print__col-break">Break</th>
            <th className="weekly-print__col-hours">Total hours</th>
            <th className="weekly-print__col-job">Job / Client</th>
            <th className="weekly-print__col-notes">Work completed / notes</th>
          </tr>
        </thead>
        <tbody>
          {sheet.records.map((record) => {
            const fields = record.fields ?? {}
            return (
              <tr key={record.id}>
                <td>{formatTimesheetDateDay(fields.date)}</td>
                <td>{formatTime12Hour(fields.startTime) || '—'}</td>
                <td>{formatTime12Hour(fields.finishTime) || '—'}</td>
                <td>{fields.breakMinutes ? `${fields.breakMinutes}m` : '—'}</td>
                <td>{fields.totalHoursWorked || '—'}</td>
                <td>{fields.jobProjectName || '—'}</td>
                <td className="weekly-print__notes">{fields.workCompleted || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="weekly-print__totals">
        <span>
          Days worked: <strong>{sheet.totals.daysWorked}</strong>
        </span>
        <span>
          Entries: <strong>{sheet.totals.recordCount}</strong>
        </span>
        <span>
          Chargeable: <strong>{formatHoursTotal(sheet.totals.totalChargeableHours)}</strong>
        </span>
        <span>
          Non-chargeable:{' '}
          <strong>{formatHoursTotal(sheet.totals.totalNonChargeableHours)}</strong>
        </span>
        <span className="weekly-print__totals-emphasis">
          Total hours: <strong>{formatHoursTotal(sheet.totals.totalHoursWorked)}</strong>
        </span>
      </div>

      <footer className="weekly-print__signoff">
        <div className="weekly-print__sign-line">
          <span className="weekly-print__sign-label">Employee signature</span>
          <span className="weekly-print__sign-rule" />
        </div>
        <div className="weekly-print__sign-line">
          <span className="weekly-print__sign-label">Supervisor approval</span>
          <span className="weekly-print__sign-rule" />
        </div>
        <div className="weekly-print__sign-line weekly-print__sign-line--date">
          <span className="weekly-print__sign-label">Date</span>
          <span className="weekly-print__sign-rule" />
        </div>
      </footer>
    </article>
  )
}

function normalizeLegacySheets(weekGroups) {
  if (!Array.isArray(weekGroups) || weekGroups.length === 0) return []
  const records = weekGroups.flatMap((group) => group.records ?? [])
  return buildWeeklyPrintSheets(records)
}

/**
 * Print-only weekly timesheet layout (A4 landscape via scoped CSS).
 * Prefer `sheets` from buildWeeklyPrintSheets / buildWeeklyPrintSheetForRecord.
 * Legacy `weekGroups` is still normalised for compatibility.
 */
export function WeeklyPrintSummary({ sheets, weekGroups, generatedAt }) {
  const printedAt = formatPrintedAt(generatedAt)
  const resolvedSheets =
    Array.isArray(sheets) && sheets.length > 0
      ? sheets
      : normalizeLegacySheets(weekGroups)

  if (resolvedSheets.length === 0) {
    return (
      <div className="weekly-print">
        <p className="weekly-print__empty">No timesheet records to print.</p>
      </div>
    )
  }

  return (
    <div className="weekly-print">
      {resolvedSheets.map((sheet) => (
        <WeeklyPrintSheet key={sheet.sheetKey} sheet={sheet} generatedAt={printedAt} />
      ))}
    </div>
  )
}
