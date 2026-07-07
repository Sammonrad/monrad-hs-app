import { useEffect, useMemo, useState } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import { WeeklyPrintSummary } from '../components/WeeklyPrintSummary.jsx'
import { ComboField } from '../components/FormFields.jsx'
import { formatDecimalHoursDisplay } from '../utils/formatting.js'
import {
  EMPTY_WEEKLY_FILTERS,
  getTimesheetRecords,
  filterTimesheets,
  groupByWeek,
  calculateTotals,
  formatHoursTotal,
  getFilterOptions,
  describeActiveFilters,
} from '../utils/weeklyTimesheet.js'

export function WeeklyTimesheetSummaryView({ onBack, savedRecords }) {
  const allTimesheets = useMemo(() => getTimesheetRecords(savedRecords), [savedRecords])
  const filterOptions = useMemo(() => getFilterOptions(allTimesheets), [allTimesheets])

  const [filters, setFilters] = useState(EMPTY_WEEKLY_FILTERS)
  const [printPayload, setPrintPayload] = useState(null)

  const filteredRecords = useMemo(
    () => filterTimesheets(allTimesheets, filters),
    [allTimesheets, filters],
  )
  const weekGroups = useMemo(() => groupByWeek(filteredRecords), [filteredRecords])
  const totals = useMemo(() => calculateTotals(filteredRecords), [filteredRecords])
  const filterDescription = useMemo(() => describeActiveFilters(filters), [filters])

  const hasActiveFilters =
    filters.employee ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.jobProject ||
    filters.site ||
    filters.machine

  function updateFilter(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  function clearFilters() {
    setFilters(EMPTY_WEEKLY_FILTERS)
  }

  function handlePrint() {
    setPrintPayload({
      totals,
      weekGroups,
      filterDescription,
      generatedAt: new Date().toLocaleString('en-NZ', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    })
  }

  useEffect(() => {
    if (!printPayload) return undefined

    const timer = window.setTimeout(() => {
      window.print()
    }, 350)

    function handleAfterPrint() {
      setPrintPayload(null)
    }

    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [printPayload])

  return (
    <>
      {printPayload && (
        <div className="print-area" aria-hidden="true">
          <WeeklyPrintSummary {...printPayload} />
        </div>
      )}

      <BackButton onClick={onBack} />

      <header className="header no-print">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">Weekly Timesheet Summary</h1>
        <p className="progress" aria-live="polite">
          {allTimesheets.length} timesheet record{allTimesheets.length === 1 ? '' : 's'} on this device
        </p>
      </header>

      <section className="weekly-filters no-print" aria-labelledby="weekly-filters-heading">
        <div className="weekly-filters__header">
          <h2 id="weekly-filters-heading" className="weekly-section__title">
            Filters
          </h2>
          {hasActiveFilters && (
            <button type="button" className="records-search__clear" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        <div className="weekly-filters__grid">
          <ComboField
            label="Employee / operator"
            field="employee"
            value={filters.employee}
            onChange={updateFilter}
            placeholder="All employees"
            options={filterOptions.employees}
            listId="weekly-employees"
          />
          <label className="field">
            <span className="field__label">Date from</span>
            <input
              type="date"
              className="field__input"
              value={filters.dateFrom}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Date to</span>
            <input
              type="date"
              className="field__input"
              value={filters.dateTo}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
            />
          </label>
          <ComboField
            label="Job / project"
            field="jobProject"
            value={filters.jobProject}
            onChange={updateFilter}
            placeholder="All jobs"
            options={filterOptions.jobs}
            listId="weekly-jobs"
          />
          <ComboField
            label="Site location"
            field="site"
            value={filters.site}
            onChange={updateFilter}
            placeholder="All sites"
            options={filterOptions.sites}
            listId="weekly-sites"
          />
          <ComboField
            label="Machine used"
            field="machine"
            value={filters.machine}
            onChange={updateFilter}
            placeholder="All machines"
            options={filterOptions.machines}
            listId="weekly-machines"
          />
        </div>
      </section>

      <section className="weekly-summary no-print" aria-labelledby="weekly-summary-heading">
        <h2 id="weekly-summary-heading" className="weekly-section__title">
          Summary totals
        </h2>
        <dl className="weekly-summary__grid">
          <div className="weekly-summary__item">
            <dt>Total hours worked</dt>
            <dd>{formatHoursTotal(totals.totalHoursWorked)}</dd>
          </div>
          <div className="weekly-summary__item">
            <dt>Total chargeable hours</dt>
            <dd>{formatHoursTotal(totals.totalChargeableHours)}</dd>
          </div>
          <div className="weekly-summary__item">
            <dt>Total non-chargeable hours</dt>
            <dd>{formatHoursTotal(totals.totalNonChargeableHours)}</dd>
          </div>
          <div className="weekly-summary__item">
            <dt>Records</dt>
            <dd>{totals.recordCount}</dd>
          </div>
          <div className="weekly-summary__item weekly-summary__item--highlight">
            <dt>Days worked</dt>
            <dd>{totals.daysWorked}</dd>
          </div>
        </dl>
        <p className="weekly-summary__filters">{filterDescription}</p>
      </section>

      <div className="weekly-toolbar no-print">
        <button
          type="button"
          className="print-record-btn"
          onClick={handlePrint}
          disabled={filteredRecords.length === 0}
        >
          Print weekly summary
        </button>
        <p className="weekly-toolbar__count" aria-live="polite">
          {filteredRecords.length} matching record{filteredRecords.length === 1 ? '' : 's'}
        </p>
      </div>

      {filteredRecords.length === 0 ? (
        <p className="weekly-empty no-print">
          {allTimesheets.length === 0
            ? 'No timesheet records yet. Save daily timesheets first, then return here for weekly totals.'
            : 'No timesheet records match your filters. Try adjusting or clearing filters.'}
        </p>
      ) : (
        weekGroups.map((group) => (
          <section
            key={group.weekKey}
            className="weekly-group no-print"
            aria-labelledby={`week-${group.weekKey}`}
          >
            <h2 id={`week-${group.weekKey}`} className="weekly-group__title">
              Week: {group.weekLabel}
            </h2>
            <ul className="weekly-records">
              {group.records.map((record) => {
                const fields = record.fields ?? {}
                return (
                  <li key={record.id} className="weekly-record">
                    <div className="weekly-record__header">
                      <span className="type-badge type-badge--small">Timesheet</span>
                      <p className="weekly-record__date">{fields.date || '—'}</p>
                    </div>
                    <dl className="weekly-record__details">
                      <div className="weekly-record__row">
                        <dt>Employee</dt>
                        <dd>{fields.employeeName || '—'}</dd>
                      </div>
                      <div className="weekly-record__row">
                        <dt>Job / project</dt>
                        <dd>{fields.jobProjectName || '—'}</dd>
                      </div>
                      <div className="weekly-record__row">
                        <dt>Site</dt>
                        <dd>{fields.siteLocation || '—'}</dd>
                      </div>
                      <div className="weekly-record__row">
                        <dt>Machine</dt>
                        <dd>{fields.machineUsed || '—'}</dd>
                      </div>
                      <div className="weekly-record__row">
                        <dt>Start</dt>
                        <dd>{fields.startTime || '—'}</dd>
                      </div>
                      <div className="weekly-record__row">
                        <dt>Finish</dt>
                        <dd>{fields.finishTime || '—'}</dd>
                      </div>
                      <div className="weekly-record__row">
                        <dt>Break</dt>
                        <dd>{fields.breakMinutes ? `${fields.breakMinutes} min` : '—'}</dd>
                      </div>
                      <div className="weekly-record__row">
                        <dt>Total hours</dt>
                        <dd>{fields.totalHoursWorked || '—'}</dd>
                      </div>
                      <div className="weekly-record__row">
                        <dt>Chargeable</dt>
                        <dd>{formatDecimalHoursDisplay(fields.chargeableHours) || '—'}</dd>
                      </div>
                      <div className="weekly-record__row">
                        <dt>Non-chargeable</dt>
                        <dd>{formatDecimalHoursDisplay(fields.nonChargeableHours) || '—'}</dd>
                      </div>
                    </dl>
                    {fields.workCompleted && (
                      <p className="weekly-record__work">
                        <span className="weekly-record__work-label">Work completed:</span>{' '}
                        {fields.workCompleted}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </>
  )
}
