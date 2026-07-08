import { useEffect, useMemo, useState } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import { CloudSyncBadge } from '../components/CloudSyncBadge.jsx'
import { formatSubmittedAt } from '../utils/formatting.js'
import { getTimesheetRecords } from '../utils/weeklyTimesheet.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import {
  getRecordsDashboardStats,
  buildSearchableItems,
  filterSearchItems,
} from '../utils/recordsDashboard.js'
import {
  fetchAllCloudRecords,
  mergeAllDashboardRecords,
  isCloudBackedRecord,
  isLocalOnlyRecord,
} from '../utils/recordsDashboardCloud.js'

export function RecordsDashboardView({
  onBack,
  onNavigate,
  savedRecords,
  actions,
  setPrintRecord,
  onViewRecord,
  user,
  profile,
}) {
  const [cloudRecords, setCloudRecords] = useState(null)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [cloudError, setCloudError] = useState('')

  const isAdmin = isAdminProfile(profile)

  useEffect(() => {
    if (!user?.id) {
      setCloudRecords(null)
      setCloudLoading(false)
      setCloudError('')
      return undefined
    }

    let isMounted = true
    setCloudLoading(true)
    setCloudError('')

    fetchAllCloudRecords(user.id, { isAdmin }).then(({ error, ...records }) => {
      if (!isMounted) return
      setCloudRecords(records)
      setCloudLoading(false)
      if (error) setCloudError(error.message || 'Could not load cloud records.')
    })

    return () => {
      isMounted = false
    }
  }, [user?.id, isAdmin])

  const mergedRecords = useMemo(() => {
    if (!user?.id || cloudRecords === null) {
      return savedRecords
    }
    return mergeAllDashboardRecords(savedRecords, cloudRecords)
  }, [savedRecords, cloudRecords, user?.id])

  const stats = getRecordsDashboardStats(mergedRecords, actions)
  const timesheetCount = getTimesheetRecords(mergedRecords).length
  const allItems = useMemo(
    () => buildSearchableItems(mergedRecords, actions),
    [mergedRecords, actions],
  )

  const cloudRecordCount = mergedRecords.filter(isCloudBackedRecord).length
  const localOnlyRecordCount = mergedRecords.filter(isLocalOnlyRecord).length

  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [openActionsOnly, setOpenActionsOnly] = useState(false)
  const [defectsOnly, setDefectsOnly] = useState(false)
  const [incidentsOnly, setIncidentsOnly] = useState(false)
  const [cloudOnly, setCloudOnly] = useState(false)
  const [localOnly, setLocalOnly] = useState(false)

  const filteredItems = useMemo(
    () =>
      filterSearchItems(allItems, {
        searchQuery,
        typeFilter,
        dateFrom,
        dateTo,
        openActionsOnly,
        defectsOnly,
        incidentsOnly,
        cloudOnly,
        localOnly,
      }),
    [
      allItems,
      searchQuery,
      typeFilter,
      dateFrom,
      dateTo,
      openActionsOnly,
      defectsOnly,
      incidentsOnly,
      cloudOnly,
      localOnly,
    ],
  )

  const hasActiveFilters =
    searchQuery.trim() ||
    typeFilter !== 'all' ||
    dateFrom ||
    dateTo ||
    openActionsOnly ||
    defectsOnly ||
    incidentsOnly ||
    cloudOnly ||
    localOnly

  function clearFilters() {
    setSearchQuery('')
    setTypeFilter('all')
    setDateFrom('')
    setDateTo('')
    setOpenActionsOnly(false)
    setDefectsOnly(false)
    setIncidentsOnly(false)
    setCloudOnly(false)
    setLocalOnly(false)
  }

  function handleCloudOnlyChange(checked) {
    setCloudOnly(checked)
    if (checked) setLocalOnly(false)
  }

  function handleLocalOnlyChange(checked) {
    setLocalOnly(checked)
    if (checked) setCloudOnly(false)
  }

  function handleViewItem(item) {
    if (item.itemType === 'action') {
      onNavigate('action-register')
      return
    }
    onViewRecord?.(item.record)
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">Records Dashboard</h1>
        <p className="progress" aria-live="polite">
          {mergedRecords.length} record{mergedRecords.length === 1 ? '' : 's'}
          {user?.id && !cloudLoading && (
            <>
              {' '}
              · {cloudRecordCount} cloud · {localOnlyRecordCount} local only
            </>
          )}
          {cloudLoading && ' · Loading cloud records…'}
          {' · '}
          {actions.length} action{actions.length === 1 ? '' : 's'}
        </p>
        {cloudError && (
          <p className="records-search__empty" role="alert">
            {cloudError} Showing local records only.
          </p>
        )}
      </header>

      <section className="safety-summary" aria-labelledby="safety-summary-heading">
        <h2 id="safety-summary-heading" className="safety-summary__title">
          Safety summary
        </h2>
        <dl className="safety-summary__grid">
          <div className="safety-summary__item">
            <dt>Timesheets</dt>
            <dd>{stats.sections.find((s) => s.id === 'timesheet')?.count ?? 0}</dd>
          </div>
          <div className="safety-summary__item">
            <dt>Job starts</dt>
            <dd>{stats.sections.find((s) => s.id === 'job-start')?.count ?? 0}</dd>
          </div>
          <div className="safety-summary__item">
            <dt>Pre-starts</dt>
            <dd>{stats.sections.find((s) => s.id === 'pre-start')?.count ?? 0}</dd>
          </div>
          <div className="safety-summary__item">
            <dt>Toolbox meetings</dt>
            <dd>{stats.sections.find((s) => s.id === 'toolbox')?.count ?? 0}</dd>
          </div>
          <div className="safety-summary__item">
            <dt>Incidents / near misses</dt>
            <dd>{stats.incidentCount}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--alert">
            <dt>Open actions</dt>
            <dd>{stats.openActions}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--alert">
            <dt>Overdue actions</dt>
            <dd>{stats.overdueActions}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--alert">
            <dt>Critical actions</dt>
            <dd>{stats.criticalActions}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--complete">
            <dt>Completed actions</dt>
            <dd>{stats.completedActions}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--alert">
            <dt>Unresolved machine defects</dt>
            <dd>{stats.unresolvedMachineDefects}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--alert">
            <dt>Unresolved incident actions</dt>
            <dd>{stats.unresolvedIncidentActions}</dd>
          </div>
          <div className="safety-summary__item safety-summary__item--alert">
            <dt>Machine defects recorded</dt>
            <dd>{stats.defectCount}</dd>
          </div>
        </dl>
      </section>

      {timesheetCount > 0 && (
        <section className="weekly-dashboard-link no-print" aria-labelledby="weekly-link-heading">
          <h2 id="weekly-link-heading" className="records-summary__title">
            Timesheet reports
          </h2>
          <p className="weekly-dashboard-link__text">
            {timesheetCount} timesheet record{timesheetCount === 1 ? '' : 's'} saved — view weekly
            hours and chargeable totals.
          </p>
          <button
            type="button"
            className="action-btn action-btn--primary"
            onClick={() => onNavigate('weekly-timesheet-summary')}
          >
            Open weekly timesheet summary
          </button>
        </section>
      )}

      <section className="records-search" aria-labelledby="records-search-heading">
        <div className="records-search__header">
          <h2 id="records-search-heading" className="records-summary__title">
            Search &amp; filter
          </h2>
          {hasActiveFilters && (
            <button type="button" className="records-search__clear" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        <label className="field records-search__query">
          <span className="field__label">Search</span>
          <input
            type="search"
            className="field__input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Date, employee, job, site, machine, hazards, defects, incidents, notes..."
          />
        </label>

        <div className="records-search__filters">
          <label className="field records-search__filter">
            <span className="field__label">Record type</span>
            <select
              className="field__input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="job-start">Job Start</option>
              <option value="pre-start">Pre-Start</option>
              <option value="toolbox">Toolbox</option>
              <option value="incident">Incident</option>
              <option value="timesheet">Timesheet</option>
              <option value="action">Actions</option>
            </select>
          </label>

          <label className="field records-search__filter">
            <span className="field__label">Date from</span>
            <input
              type="date"
              className="field__input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>

          <label className="field records-search__filter">
            <span className="field__label">Date to</span>
            <input
              type="date"
              className="field__input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        </div>

        <div className="records-search__toggles">
          <label className="records-search__toggle">
            <input
              type="checkbox"
              checked={cloudOnly}
              onChange={(e) => handleCloudOnlyChange(e.target.checked)}
            />
            <span>Cloud records only</span>
          </label>
          <label className="records-search__toggle">
            <input
              type="checkbox"
              checked={localOnly}
              onChange={(e) => handleLocalOnlyChange(e.target.checked)}
            />
            <span>Local records only</span>
          </label>
          <label className="records-search__toggle">
            <input
              type="checkbox"
              checked={openActionsOnly}
              onChange={(e) => setOpenActionsOnly(e.target.checked)}
            />
            <span>Open actions only</span>
          </label>
          <label className="records-search__toggle">
            <input
              type="checkbox"
              checked={defectsOnly}
              onChange={(e) => setDefectsOnly(e.target.checked)}
            />
            <span>Machine defects only</span>
          </label>
          <label className="records-search__toggle">
            <input
              type="checkbox"
              checked={incidentsOnly}
              onChange={(e) => setIncidentsOnly(e.target.checked)}
            />
            <span>Incidents / near misses only</span>
          </label>
        </div>

        <p className="records-search__count" aria-live="polite">
          {filteredItems.length} result{filteredItems.length === 1 ? '' : 's'}
          {hasActiveFilters ? ' matching filters' : ''}
        </p>

        {filteredItems.length === 0 ? (
          <p className="records-search__empty">
            No records match your search and filters. Try different keywords or clear filters.
          </p>
        ) : (
          <ul className="records-search__results">
            {filteredItems.map((item) => (
              <li
                key={item.id}
                className={[
                  'search-result',
                  item.itemType === 'action' && item.isOpenAction ? 'search-result--open' : '',
                  item.isOverdue ? 'search-result--overdue' : '',
                  item.isCritical ? 'search-result--critical' : '',
                  item.hasDefect ? 'search-result--defect' : '',
                  item.action?.status === 'completed' ? 'search-result--completed' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="search-result__header">
                  <span className="type-badge type-badge--small">{item.typeLabel}</span>
                  {item.itemType === 'record' && (
                    <CloudSyncBadge record={item.record} size="small" />
                  )}
                  {item.itemType === 'action' && (
                    <CloudSyncBadge syncStatus="local-only" size="small" />
                  )}
                  {item.status && (
                    <span
                      className={
                        item.itemType === 'action'
                          ? `action-status action-status--${item.action.status}`
                          : 'search-result__status'
                      }
                    >
                      {item.status}
                    </span>
                  )}
                </div>
                <p className="search-result__title">{item.title}</p>
                <dl className="search-result__meta">
                  <div className="search-result__row">
                    <dt>Date</dt>
                    <dd>{item.date || (item.submittedAt ? formatSubmittedAt(item.submittedAt) : '—')}</dd>
                  </div>
                  {item.mainPerson && (
                    <div className="search-result__row">
                      <dt>Person</dt>
                      <dd>{item.mainPerson}</dd>
                    </div>
                  )}
                  <div className="search-result__row">
                    <dt>Site</dt>
                    <dd>{item.site || '—'}</dd>
                  </div>
                </dl>
                <div className="search-result__actions">
                  {item.itemType === 'record' && (
                    <button
                      type="button"
                      className="print-record-btn"
                      onClick={() => setPrintRecord(item.record)}
                    >
                      Print Record
                    </button>
                  )}
                  <button
                    type="button"
                    className="records-summary-card__btn"
                    onClick={() => handleViewItem(item)}
                  >
                    View
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="records-summary" aria-labelledby="records-summary-heading">
        <h2 id="records-summary-heading" className="records-summary__title">
          Records by type
        </h2>
        <ul className="records-summary__list">
          {stats.sections.map((section) => (
            <li key={section.id} className="records-summary-card">
              <div className="records-summary-card__content">
                <h3 className="records-summary-card__title">{section.title}</h3>
                <p className="records-summary-card__count">
                  {section.id === 'action-register'
                    ? `${section.count} action${section.count === 1 ? '' : 's'}`
                    : `${section.count} saved record${section.count === 1 ? '' : 's'}`}
                </p>
                {section.recentDate ? (
                  <p className="records-summary-card__recent">Most recent: {section.recentDate}</p>
                ) : (
                  <p className="records-summary-card__recent records-summary-card__recent--empty">
                    No records yet
                  </p>
                )}
              </div>
              <button
                type="button"
                className="records-summary-card__btn"
                onClick={() => onNavigate(section.id)}
              >
                View records
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
