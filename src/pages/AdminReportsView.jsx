import { useEffect, useMemo, useState } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import { AdminReportPrint } from '../components/AdminReportPrint.jsx'
import { ComboField } from '../components/FormFields.jsx'
import { formatHoursTotal } from '../utils/weeklyTimesheet.js'
import { fetchAllCloudRecords } from '../utils/recordsDashboardCloud.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import {
  ADMIN_REPORT_RECORD_TYPES,
  EMPTY_ADMIN_REPORT_FILTERS,
  buildAdminReportDataset,
  buildAdminReportRows,
  filterAdminReportRows,
  getAdminReportFilterOptions,
  computeAdminReportSummary,
  groupAdminReportRows,
  describeAdminReportFilters,
  splitFilteredDataset,
} from '../utils/adminReports.js'

export function AdminReportsView({ onBack, user, profile }) {
  const isAdmin = isAdminProfile(profile)
  const [cloudRecords, setCloudRecords] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [filters, setFilters] = useState(EMPTY_ADMIN_REPORT_FILTERS)
  const [printPayload, setPrintPayload] = useState(null)

  useEffect(() => {
    if (!isAdmin || !user?.id) {
      setCloudRecords(null)
      setLoading(false)
      setFetchError('')
      return undefined
    }

    let isMounted = true
    setLoading(true)
    setFetchError('')

    fetchAllCloudRecords(user.id, { isAdmin: true }).then(({ error, ...records }) => {
      if (!isMounted) return
      setCloudRecords(records)
      setLoading(false)
      if (error) setFetchError(error.message || 'Could not load cloud records.')
    })

    return () => {
      isMounted = false
    }
  }, [user?.id, isAdmin])

  const dataset = useMemo(
    () => (cloudRecords ? buildAdminReportDataset(cloudRecords) : { records: [], actions: [] }),
    [cloudRecords],
  )

  const filterOptions = useMemo(
    () => getAdminReportFilterOptions(dataset.records, dataset.actions),
    [dataset],
  )

  const allRows = useMemo(
    () => buildAdminReportRows(dataset.records, dataset.actions),
    [dataset],
  )

  const filteredRows = useMemo(
    () => filterAdminReportRows(allRows, filters),
    [allRows, filters],
  )

  const { records: filteredRecords, actions: filteredActions } = useMemo(
    () => splitFilteredDataset(filteredRows),
    [filteredRows],
  )

  const summary = useMemo(
    () => computeAdminReportSummary(filteredRecords, filteredActions),
    [filteredRecords, filteredActions],
  )

  const groups = useMemo(() => groupAdminReportRows(filteredRows), [filteredRows])
  const filterDescription = useMemo(() => describeAdminReportFilters(filters), [filters])

  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    filters.recordType !== 'all' ||
    filters.staff ||
    filters.site ||
    filters.openActionsOnly ||
    filters.overdueOnly ||
    filters.criticalOnly ||
    filters.incidentsOnly ||
    filters.machineDefectsOnly

  function updateFilter(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  function clearFilters() {
    setFilters(EMPTY_ADMIN_REPORT_FILTERS)
  }

  function handlePrint() {
    setPrintPayload({
      summary,
      groups,
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

  if (!isAdmin) {
    return (
      <>
        <BackButton onClick={onBack} />
        <p className="staff-management__access-denied" role="alert">
          Access denied — admin only.
        </p>
      </>
    )
  }

  return (
    <>
      {printPayload && (
        <div className="print-area" aria-hidden="true">
          <AdminReportPrint {...printPayload} />
        </div>
      )}

      <BackButton onClick={onBack} />

      <header className="header no-print">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">Admin Reports</h1>
        <p className="progress" aria-live="polite">
          {loading
            ? 'Loading cloud records…'
            : `${allRows.length} cloud record${allRows.length === 1 ? '' : 's'} across all users`}
        </p>
        {fetchError && (
          <p className="validation-message" role="alert">
            {fetchError}
          </p>
        )}
        <p className="form-hint">
          Organisation-wide report from cloud records. Device-only local records are not included.
        </p>
      </header>

      <section className="records-search no-print" aria-labelledby="admin-report-filters-heading">
        <div className="records-search__header">
          <h2 id="admin-report-filters-heading" className="records-summary__title">
            Filters
          </h2>
          {hasActiveFilters && (
            <button type="button" className="records-search__clear" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        <div className="records-search__filters">
          <label className="field records-search__filter">
            <span className="field__label">Record type</span>
            <select
              className="field__input"
              value={filters.recordType}
              onChange={(e) => updateFilter('recordType', e.target.value)}
            >
              {ADMIN_REPORT_RECORD_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field records-search__filter">
            <span className="field__label">Date from</span>
            <input
              type="date"
              className="field__input"
              value={filters.dateFrom}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
            />
          </label>

          <label className="field records-search__filter">
            <span className="field__label">Date to</span>
            <input
              type="date"
              className="field__input"
              value={filters.dateTo}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
            />
          </label>
        </div>

        <div className="records-search__filters">
          <ComboField
            label="Staff / user"
            field="staff"
            value={filters.staff}
            onChange={updateFilter}
            options={filterOptions.staff}
            placeholder="All staff"
          />

          <ComboField
            label="Site / location"
            field="site"
            value={filters.site}
            onChange={updateFilter}
            options={filterOptions.sites}
            placeholder="All sites"
          />
        </div>

        <div className="records-search__toggles">
          <label className="records-search__toggle">
            <input
              type="checkbox"
              checked={filters.openActionsOnly}
              onChange={(e) => updateFilter('openActionsOnly', e.target.checked)}
            />
            <span>Open actions only</span>
          </label>
          <label className="records-search__toggle">
            <input
              type="checkbox"
              checked={filters.overdueOnly}
              onChange={(e) => updateFilter('overdueOnly', e.target.checked)}
            />
            <span>Overdue only</span>
          </label>
          <label className="records-search__toggle">
            <input
              type="checkbox"
              checked={filters.criticalOnly}
              onChange={(e) => updateFilter('criticalOnly', e.target.checked)}
            />
            <span>Critical only</span>
          </label>
          <label className="records-search__toggle">
            <input
              type="checkbox"
              checked={filters.incidentsOnly}
              onChange={(e) => updateFilter('incidentsOnly', e.target.checked)}
            />
            <span>Incidents only</span>
          </label>
          <label className="records-search__toggle">
            <input
              type="checkbox"
              checked={filters.machineDefectsOnly}
              onChange={(e) => updateFilter('machineDefectsOnly', e.target.checked)}
            />
            <span>Machine defects only</span>
          </label>
        </div>

        <p className="records-search__count" aria-live="polite">
          {filteredRows.length} result{filteredRows.length === 1 ? '' : 's'}
          {hasActiveFilters ? ' matching filters' : ''}
        </p>
      </section>

      <section className="safety-summary no-print" aria-labelledby="admin-report-summary-heading">
        <h2 id="admin-report-summary-heading" className="safety-summary__title">
          Summary
        </h2>
        <dl className="safety-summary__grid">
          <div className="safety-summary__item">
            <dt>Timesheets</dt>
            <dd>{summary.totalTimesheets}</dd>
          </div>
          <div className="safety-summary__item">
            <dt>Total labour hours</dt>
            <dd>{formatHoursTotal(summary.totalLabourHours)}</dd>
          </div>
          <div className="safety-summary__item">
            <dt>Total chargeable hours</dt>
            <dd>{formatHoursTotal(summary.totalChargeableHours)}</dd>
          </div>
          <div className="safety-summary__item">
            <dt>Job starts</dt>
            <dd>{summary.totalJobStarts}</dd>
          </div>
          <div className="safety-summary__item">
            <dt>Pre-starts</dt>
            <dd>{summary.totalPreStarts}</dd>
          </div>
          <div className="safety-summary__item">
            <dt>Toolbox meetings</dt>
            <dd>{summary.totalToolbox}</dd>
          </div>
          <div className="safety-summary__item">
            <dt>Incidents / near misses</dt>
            <dd>{summary.totalIncidents}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--alert">
            <dt>Open actions</dt>
            <dd>{summary.openActions}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--alert">
            <dt>Overdue actions</dt>
            <dd>{summary.overdueActions}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--alert">
            <dt>Critical actions</dt>
            <dd>{summary.criticalActions}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--complete">
            <dt>Completed actions</dt>
            <dd>{summary.completedActions}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--alert">
            <dt>Machine defects recorded</dt>
            <dd>{summary.machineDefects}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--alert">
            <dt>Unresolved machine defects</dt>
            <dd>{summary.unresolvedMachineDefects}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--alert">
            <dt>Unresolved incident actions</dt>
            <dd>{summary.unresolvedIncidentActions}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-report-preview no-print" aria-labelledby="admin-report-preview-heading">
        <div className="admin-report-preview__header">
          <h2 id="admin-report-preview-heading" className="records-summary__title">
            Report preview
          </h2>
          <button
            type="button"
            className="action-btn action-btn--primary print-record-btn"
            onClick={handlePrint}
            disabled={loading || filteredRows.length === 0}
          >
            Print / Save as PDF
          </button>
        </div>

        {loading ? (
          <p className="progress">Loading records…</p>
        ) : filteredRows.length === 0 ? (
          <p className="records-search__empty">
            No records match your filters. Try adjusting the date range or clear filters.
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.id} className="admin-report-group" aria-labelledby={`group-${group.id}`}>
              <h3 id={`group-${group.id}`} className="admin-report-group__title">
                {group.title}
                <span className="admin-report-group__count">({group.rows.length})</span>
              </h3>
              <ul className="admin-report-group__list">
                {group.rows.map((row) => (
                  <li
                    key={row.id}
                    className={[
                      'admin-report-row',
                      row.isOverdue ? 'admin-report-row--overdue' : '',
                      row.isCritical ? 'admin-report-row--critical' : '',
                      row.hasDefect ? 'admin-report-row--defect' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="admin-report-row__header">
                      <span className="type-badge type-badge--small">{row.typeLabel}</span>
                      {row.status && <span className="admin-report-row__status">{row.status}</span>}
                    </div>
                    <dl className="admin-report-row__meta">
                      <div className="admin-report-row__field">
                        <dt>Date</dt>
                        <dd>{row.date || '—'}</dd>
                      </div>
                      <div className="admin-report-row__field">
                        <dt>Staff</dt>
                        <dd>{row.staff || '—'}</dd>
                      </div>
                      <div className="admin-report-row__field">
                        <dt>Site</dt>
                        <dd>{row.site || '—'}</dd>
                      </div>
                      <div className="admin-report-row__field admin-report-row__field--wide">
                        <dt>Description</dt>
                        <dd>{row.description || '—'}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </section>
    </>
  )
}
