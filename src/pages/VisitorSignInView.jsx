import { useEffect, useMemo, useState } from 'react'
import {
  VISITOR_ACKNOWLEDGEMENT_ITEMS,
  VISITOR_DECLARATION_TEXT,
  VISITOR_PRIVACY_NOTE,
  VISITOR_SIGN_IN_DRAFT_KEY,
} from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { CloudSyncBadge } from '../components/CloudSyncBadge.jsx'
import { PrintableVisitorRecord } from '../components/PrintableVisitorRecord.jsx'
import { PrintableVisitorRollCall } from '../components/PrintableVisitorRollCall.jsx'
import { TextField, NotesField, SummaryRow } from '../components/FormFields.jsx'
import { FormSection } from '../components/forms/FormSection.jsx'
import { FormField } from '../components/forms/FormField.jsx'
import { FormActions } from '../components/forms/FormActions.jsx'
import { FormPageHeader } from '../components/forms/FormPageHeader.jsx'
import { ValidationMessage } from '../components/forms/ValidationMessage.jsx'
import { createRecordId } from '../utils/ids.js'
import { formatSubmittedAt } from '../utils/formatting.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
import {
  createEmptyVisitorDraft,
  isVisitorOnSite,
  normalizeVisitorRecord,
  patchVisitorRecord,
  persistVisitorRecords,
  VISITOR_ACKNOWLEDGEMENT_KEYS,
} from '../utils/storage/visitorSignInStorage.js'
import {
  fetchVisitorSignInRecords,
  formatCloudSaveError,
  getMergedVisitorRecords,
  getUnavailableSyncStatus,
  isCloudSaveUnavailable,
  saveVisitorSignInRecord,
  SYNC_STATUS,
  updateVisitorSignInRecord,
} from '../utils/storage/visitorSignInCloudStorage.js'
import {
  filterVisitorHistory,
  formatVisitorDuration,
  getUniqueVisitorSites,
  getVisitorStatusLabel,
} from '../utils/visitorSignIn.js'
import {
  hasValidationErrors,
  scrollToFirstInvalid,
  getValidationSummary,
} from '../utils/formValidation.js'

const TABS = [
  { id: 'sign-in', label: 'Sign In' },
  { id: 'on-site', label: 'Currently On Site' },
  { id: 'history', label: 'Visitor History' },
]

const HISTORY_STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'on-site', label: 'On Site' },
  { id: 'signed-out', label: 'Signed Out' },
]

function loadDraftFromSession() {
  try {
    const raw = sessionStorage.getItem(VISITOR_SIGN_IN_DRAFT_KEY)
    if (!raw) return createEmptyVisitorDraft()
    const parsed = JSON.parse(raw)
    return { ...createEmptyVisitorDraft(), ...parsed }
  } catch {
    return createEmptyVisitorDraft()
  }
}

function saveDraftToSession(draft) {
  try {
    sessionStorage.setItem(VISITOR_SIGN_IN_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // sessionStorage may be unavailable
  }
}

function clearDraftSession() {
  try {
    sessionStorage.removeItem(VISITOR_SIGN_IN_DRAFT_KEY)
  } catch {
    // ignore
  }
}

export function VisitorSignInView({
  onBack,
  onNavigate,
  visitorRecords,
  setVisitorRecords,
  settings,
  user,
  cloudVisitorRecords,
  setCloudVisitorRecords,
}) {
  const [activeTab, setActiveTab] = useState('sign-in')
  const [draft, setDraft] = useState(loadDraftFromSession)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [signInSuccess, setSignInSuccess] = useState(null)
  const [completedSyncStatus, setCompletedSyncStatus] = useState(null)
  const [completedCloudError, setCompletedCloudError] = useState('')
  const [cloudLoadWarning, setCloudLoadWarning] = useState(null)
  const [signingOutId, setSigningOutId] = useState(null)
  const [historySearch, setHistorySearch] = useState('')
  const [historyDate, setHistoryDate] = useState('')
  const [historySite, setHistorySite] = useState('')
  const [historyStatus, setHistoryStatus] = useState('all')
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [printRecord, setPrintRecord] = useState(null)
  const [printRollCall, setPrintRollCall] = useState(false)

  const comboOptions = getSettingsOptions(settings)

  const mergedRecords = useMemo(
    () => getMergedVisitorRecords(visitorRecords, cloudVisitorRecords),
    [visitorRecords, cloudVisitorRecords],
  )

  const onSiteVisitors = useMemo(
    () => mergedRecords.filter(isVisitorOnSite),
    [mergedRecords],
  )

  const filteredHistory = useMemo(
    () =>
      filterVisitorHistory(mergedRecords, {
        search: historySearch,
        date: historyDate,
        site: historySite,
        status: historyStatus,
      }),
    [mergedRecords, historySearch, historyDate, historySite, historyStatus],
  )

  const historySites = useMemo(() => getUniqueVisitorSites(mergedRecords), [mergedRecords])

  const arrivalDisplay = useMemo(
    () =>
      new Date().toLocaleString(undefined, {
        dateStyle: 'full',
        timeStyle: 'short',
      }),
    [],
  )

  useEffect(() => {
    saveDraftToSession(draft)
  }, [draft])

  useEffect(() => {
    if (!user?.id) {
      setCloudLoadWarning(null)
      return undefined
    }

    let isMounted = true

    async function loadCloudRecords() {
      const { records, error } = await fetchVisitorSignInRecords(user.id)
      if (!isMounted) return

      if (error) {
        setCloudLoadWarning(
          `Could not load cloud visitor records: ${formatCloudSaveError(error)}. Showing device records only.`,
        )
        return
      }

      setCloudLoadWarning(null)
      setCloudVisitorRecords(records)
    }

    loadCloudRecords()

    return () => {
      isMounted = false
    }
  }, [user?.id, setCloudVisitorRecords])

  useEffect(() => {
    if (!printRecord && !printRollCall) return undefined

    const timer = window.setTimeout(() => {
      window.print()
    }, 350)

    function handleAfterPrint() {
      setPrintRecord(null)
      setPrintRollCall(false)
    }

    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [printRecord, printRollCall])

  function updateDraft(updates) {
    setDraft((prev) => ({ ...prev, ...updates }))
  }

  function updateField(field, value) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    updateDraft({ [field]: value })
  }

  function toggleAcknowledgement(key) {
    setFieldErrors((prev) => ({ ...prev, acknowledgements: undefined }))
    updateDraft({
      acknowledgements: {
        ...draft.acknowledgements,
        [key]: !draft.acknowledgements[key],
      },
    })
  }

  function validateSignInForm() {
    const errors = {}
    if (!draft.visitorName.trim()) errors.visitorName = 'Visitor full name is required.'
    if (!draft.siteName.trim()) errors.siteName = 'Site name is required.'
    if (!draft.purpose.trim()) errors.purpose = 'Purpose of visit is required.'

    const missingAck = VISITOR_ACKNOWLEDGEMENT_KEYS.filter((key) => !draft.acknowledgements[key])
    if (missingAck.length > 0) {
      errors.acknowledgements = 'All acknowledgement checkboxes are required.'
    }

    if (!draft.declarationName.trim()) {
      errors.declarationName = 'Please enter your name to confirm the declaration.'
    }

    return errors
  }

  function patchLocalRecord(recordId, patch) {
    setVisitorRecords((prev) => {
      const next = patchVisitorRecord(prev, recordId, patch)
      persistVisitorRecords(next)
      return next
    })
    setSelectedRecord((prev) => (prev?.id === recordId ? { ...prev, ...patch } : prev))
    setSignInSuccess((prev) => (prev?.id === recordId ? { ...prev, ...patch } : prev))
  }

  async function handleSignIn(event) {
    event.preventDefault()
    if (submitting) return

    const errors = validateSignInForm()
    if (hasValidationErrors(errors)) {
      setFieldErrors(errors)
      scrollToFirstInvalid(errors)
      return
    }

    setFieldErrors({})
    setSubmitting(true)
    setSignInSuccess(null)
    setCompletedSyncStatus(null)

    const arrivalTime = new Date().toISOString()
    const record = normalizeVisitorRecord({
      id: createRecordId(),
      ...draft,
      visitorName: draft.visitorName.trim(),
      siteName: draft.siteName.trim(),
      purpose: draft.purpose.trim(),
      company: draft.company.trim(),
      phone: draft.phone.trim(),
      personVisited: draft.personVisited.trim(),
      vehicleReg: draft.vehicleReg.trim(),
      hazardsReported: draft.hazardsReported.trim(),
      notes: draft.notes.trim(),
      declarationName: draft.declarationName.trim(),
      arrivalTime,
      createdAt: arrivalTime,
      departureTime: null,
      signedOutBy: null,
    })

    const nextRecords = [record, ...visitorRecords]
    if (!persistVisitorRecords(nextRecords)) {
      setSubmitting(false)
      return
    }
    setVisitorRecords(nextRecords)
    setSignInSuccess(record)
    setActiveTab('on-site')
    setDraft(createEmptyVisitorDraft())
    clearDraftSession()

    if (isCloudSaveUnavailable(user)) {
      const syncStatus = getUnavailableSyncStatus(user)
      patchLocalRecord(record.id, { syncStatus })
      setCompletedSyncStatus(syncStatus)
      setSubmitting(false)
      return
    }

    const { record: cloudRecord, error } = await saveVisitorSignInRecord(user, record)
    setSubmitting(false)

    if (error) {
      patchLocalRecord(record.id, { syncStatus: SYNC_STATUS.CLOUD_FAILED })
      setCompletedSyncStatus(SYNC_STATUS.CLOUD_FAILED)
      setCompletedCloudError(formatCloudSaveError(error))
      return
    }

    patchLocalRecord(record.id, {
      syncStatus: SYNC_STATUS.CLOUD,
      cloudId: cloudRecord?.cloudId ?? null,
      cloudUserId: cloudRecord?.cloudUserId ?? null,
      storageSource: 'both',
    })
    setCompletedSyncStatus(SYNC_STATUS.CLOUD)
    setCompletedCloudError('')

    if (cloudRecord) {
      setCloudVisitorRecords((prev) => {
        const withoutDup = prev.filter(
          (item) => item.cloudId !== cloudRecord.cloudId && item.id !== record.id,
        )
        return [cloudRecord, ...withoutDup]
      })
    }
  }

  async function handleSignOut(visitor) {
    const confirmed = window.confirm(
      `Sign out ${visitor.visitorName || 'this visitor'}?\n\nThis records their departure time as now.`,
    )
    if (!confirmed) return

    setSigningOutId(visitor.id)
    const departureTime = new Date().toISOString()
    const signedOutBy = user?.id ?? null
    const patch = { departureTime, signedOutBy }

    const nextRecords = patchVisitorRecord(visitorRecords, visitor.id, patch)
    if (!persistVisitorRecords(nextRecords)) {
      setSigningOutId(null)
      return
    }
    setVisitorRecords(nextRecords)

    const updated = { ...visitor, ...patch }

    if (isCloudSaveUnavailable(user)) {
      const syncStatus = getUnavailableSyncStatus(user)
      patchLocalRecord(visitor.id, { ...patch, syncStatus })
      setSigningOutId(null)
      return
    }

    const { record: cloudRecord, error } = await updateVisitorSignInRecord(user, {
      ...updated,
      cloudId: visitor.cloudId,
    })

    if (error) {
      patchLocalRecord(visitor.id, { ...patch, syncStatus: SYNC_STATUS.CLOUD_FAILED })
      setSigningOutId(null)
      window.alert(`Cloud sign-out failed — saved on this device.\n\n${formatCloudSaveError(error)}`)
      return
    }

    patchLocalRecord(visitor.id, {
      ...patch,
      syncStatus: SYNC_STATUS.CLOUD,
      storageSource: visitor.cloudId ? 'both' : visitor.storageSource,
    })

    if (cloudRecord) {
      setCloudVisitorRecords((prev) => {
        const withoutDup = prev.filter((item) => item.cloudId !== cloudRecord.cloudId)
        return [cloudRecord, ...withoutDup]
      })
    }

    setSigningOutId(null)
  }

  function handleReviewCriticalRisks() {
    saveDraftToSession(draft)
    onNavigate('critical-risks', { returnView: 'visitor-sign-in' })
  }

  function handleResetForm() {
    const empty = createEmptyVisitorDraft()
    setDraft(empty)
    clearDraftSession()
    setFieldErrors({})
    setSignInSuccess(null)
    setCompletedSyncStatus(null)
  }

  function handleRollCallPrint() {
    setPrintRollCall(true)
  }

  return (
    <>
      {printRecord && (
        <div className="print-area" aria-hidden="true">
          <PrintableVisitorRecord record={printRecord} />
        </div>
      )}

      {printRollCall && (
        <div className="print-area" aria-hidden="true">
          <PrintableVisitorRollCall visitors={onSiteVisitors} />
        </div>
      )}

      <BackButton onClick={onBack} />

      <FormPageHeader
        title="Visitor Sign-In"
        subtitle="Register visitors, track who is on site, and keep a sign-in history"
      />

      <div className="visitor-sign-in__tabs no-print" role="tablist" aria-label="Visitor sign-in sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'filter-btn filter-btn--active' : 'filter-btn'}
            onClick={() => {
              setActiveTab(tab.id)
              if (tab.id !== 'history') setSelectedRecord(null)
            }}
          >
            {tab.label}
            {tab.id === 'on-site' && onSiteVisitors.length > 0 ? (
              <span className="visitor-sign-in__tab-badge">{onSiteVisitors.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {cloudLoadWarning && (
        <p className="backup-warning no-print" role="alert">
          {cloudLoadWarning}
        </p>
      )}

      {activeTab === 'sign-in' && (
        <form className="visitor-sign-in__form no-print" onSubmit={handleSignIn} noValidate>
          <FormSection title="Arrival" id="visitor-arrival">
            <p className="visitor-sign-in__arrival" role="status">
              Arrival date &amp; time: <strong>{arrivalDisplay}</strong>
            </p>
            <p className="form-field__hint">Recorded automatically when you sign in the visitor.</p>
          </FormSection>

          <FormSection title="Visitor Details" id="visitor-details">
            <FormField label="Visitor full name" fieldId="visitorName" required error={fieldErrors.visitorName}>
              <input
                id="visitorName"
                type="text"
                className="field__input"
                value={draft.visitorName}
                onChange={(event) => updateField('visitorName', event.target.value)}
                placeholder="Full name"
              />
            </FormField>
            <FormField label="Site name" fieldId="siteName" required error={fieldErrors.siteName}>
              <input
                id="siteName"
                type="text"
                className="field__input"
                value={draft.siteName}
                onChange={(event) => updateField('siteName', event.target.value)}
                placeholder="Site or project name"
                list={comboOptions.sites.length > 0 ? 'visitor-sign-in-sites' : undefined}
              />
              {comboOptions.sites.length > 0 && (
                <datalist id="visitor-sign-in-sites">
                  {comboOptions.sites.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              )}
            </FormField>
            <FormField label="Purpose of visit" fieldId="purpose" required error={fieldErrors.purpose}>
              <input
                id="purpose"
                type="text"
                className="field__input"
                value={draft.purpose}
                onChange={(event) => updateField('purpose', event.target.value)}
                placeholder="e.g. Site inspection, delivery, meeting"
              />
            </FormField>
            <TextField
              label="Company"
              field="company"
              value={draft.company}
              onChange={updateField}
              placeholder="Visitor's company (optional)"
            />
            <TextField
              label="Phone"
              field="phone"
              value={draft.phone}
              onChange={updateField}
              placeholder="Contact number (optional)"
            />
            <TextField
              label="Person visited"
              field="personVisited"
              value={draft.personVisited}
              onChange={updateField}
              placeholder="Who they are meeting (optional)"
            />
            <TextField
              label="Vehicle registration"
              field="vehicleReg"
              value={draft.vehicleReg}
              onChange={updateField}
              placeholder="Vehicle reg (optional)"
            />
            <FormField label="Hazards / concerns reported" fieldId="hazardsReported">
              <textarea
                id="hazardsReported"
                className="field__input field__textarea"
                value={draft.hazardsReported}
                onChange={(event) => updateField('hazardsReported', event.target.value)}
                placeholder="Any hazards or concerns the visitor reported (optional)"
                rows={3}
              />
            </FormField>
            <NotesField value={draft.notes} onChange={updateField} />
          </FormSection>

          <FormSection title="Safety Acknowledgements" id="visitor-acknowledgements">
            <p className="form-field__hint">
              The visitor must confirm each item before signing in.
            </p>
            <button
              type="button"
              className="action-btn visitor-sign-in__critical-risks-btn"
              onClick={handleReviewCriticalRisks}
            >
              Review Critical Risks
            </button>
            <ul className="visitor-sign-in__ack-list" role="list">
              {VISITOR_ACKNOWLEDGEMENT_ITEMS.map((item) => {
                const checked = Boolean(draft.acknowledgements[item.key])
                return (
                  <li key={item.key} className={checked ? 'item item--checked' : 'item'}>
                    <label className="item__label visitor-sign-in__ack-label">
                      <input
                        type="checkbox"
                        className="item__checkbox"
                        checked={checked}
                        onChange={() => toggleAcknowledgement(item.key)}
                      />
                      <span className="item__text">{item.label}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
            {fieldErrors.acknowledgements && (
              <ValidationMessage message={fieldErrors.acknowledgements} />
            )}
          </FormSection>

          <FormSection title="Declaration" id="visitor-declaration">
            <p className="visitor-sign-in__declaration">{VISITOR_DECLARATION_TEXT}</p>
            <FormField
              label="Visitor name (acknowledgement)"
              fieldId="declarationName"
              required
              error={fieldErrors.declarationName}
            >
              <input
                id="declarationName"
                type="text"
                className="field__input"
                value={draft.declarationName}
                onChange={(event) => updateField('declarationName', event.target.value)}
                placeholder="Type visitor name to confirm"
                autoComplete="name"
              />
            </FormField>
            <p className="visitor-sign-in__privacy" role="note">
              {VISITOR_PRIVACY_NOTE}
            </p>
          </FormSection>

          {signInSuccess && (
            <div className="visitor-sign-in__success" role="status">
              <p className="complete-message">
                {signInSuccess.visitorName} signed in successfully.
              </p>
              {submitting ? (
                <p className="cloud-sync-status cloud-sync-status--pending">Signing in…</p>
              ) : (
                completedSyncStatus && (
                  <>
                    <CloudSyncBadge syncStatus={completedSyncStatus} className="cloud-sync-status--block" />
                    {completedCloudError && (
                      <p className="validation-message validation-message--error" role="alert">
                        {completedCloudError}
                      </p>
                    )}
                  </>
                )
              )}
            </div>
          )}

          <FormActions>
            {hasValidationErrors(fieldErrors) && (
              <ValidationMessage variant="summary" messages={getValidationSummary(fieldErrors)} />
            )}
            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign In Visitor'}
            </button>
          </FormActions>
        </form>
      )}

      {activeTab === 'sign-in' && (
        <button type="button" className="reset-btn no-print" onClick={handleResetForm}>
          Reset form
        </button>
      )}

      {activeTab === 'on-site' && (
        <section className="visitor-sign-in__on-site no-print" aria-labelledby="on-site-heading">
          <div className="visitor-sign-in__section-header">
            <div>
              <h2 id="on-site-heading" className="saved-records__title">
                Currently on site
              </h2>
              <p className="saved-records__count">
                {onSiteVisitors.length} visitor{onSiteVisitors.length === 1 ? '' : 's'} on site
              </p>
            </div>
            <button
              type="button"
              className="action-btn action-btn--primary visitor-sign-in__roll-call-btn"
              onClick={handleRollCallPrint}
              disabled={onSiteVisitors.length === 0}
            >
              Visitor Roll Call
            </button>
          </div>

          {onSiteVisitors.length === 0 ? (
            <p className="saved-records__empty">No visitors currently on site.</p>
          ) : (
            <ul className="visitor-sign-in__card-list" role="list">
              {onSiteVisitors.map((visitor) => (
                <li key={visitor.id} className="visitor-sign-in__card">
                  <div className="visitor-sign-in__card-header">
                    <h3 className="visitor-sign-in__card-name">{visitor.visitorName}</h3>
                    <CloudSyncBadge record={visitor} size="small" />
                  </div>
                  <dl className="saved-record__details">
                    <SummaryRow label="Company" value={visitor.company} />
                    <SummaryRow label="Site" value={visitor.siteName} />
                    <SummaryRow label="Purpose" value={visitor.purpose} />
                    <SummaryRow label="Person visited" value={visitor.personVisited} />
                    <SummaryRow label="Arrival" value={formatSubmittedAt(visitor.arrivalTime)} />
                    <SummaryRow
                      label="Time on site"
                      value={formatVisitorDuration(visitor.arrivalTime, null)}
                    />
                    <SummaryRow label="Vehicle" value={visitor.vehicleReg} />
                  </dl>
                  <button
                    type="button"
                    className="submit-btn visitor-sign-in__sign-out-btn"
                    onClick={() => handleSignOut(visitor)}
                    disabled={signingOutId === visitor.id}
                  >
                    {signingOutId === visitor.id ? 'Signing out…' : 'Sign Out'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === 'history' && (
        <section className="visitor-sign-in__history no-print" aria-labelledby="history-heading">
          <h2 id="history-heading" className="saved-records__title">
            Visitor history
          </h2>

          <div className="visitor-sign-in__filters">
            <FormField label="Search" fieldId="visitor-history-search">
              <input
                id="visitor-history-search"
                type="search"
                className="field__input"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Name, company, site, person visited…"
              />
            </FormField>
            <FormField label="Date" fieldId="visitor-history-date">
              <input
                id="visitor-history-date"
                type="date"
                className="field__input"
                value={historyDate}
                onChange={(event) => setHistoryDate(event.target.value)}
              />
            </FormField>
            <FormField label="Site" fieldId="visitor-history-site">
              <input
                id="visitor-history-site"
                type="text"
                className="field__input"
                value={historySite}
                onChange={(event) => setHistorySite(event.target.value)}
                placeholder="Filter by site"
                list="visitor-history-sites"
              />
              <datalist id="visitor-history-sites">
                {historySites.map((site) => (
                  <option key={site} value={site} />
                ))}
              </datalist>
            </FormField>
          </div>

          <div className="saved-records__filters" role="tablist" aria-label="Filter by status">
            {HISTORY_STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={
                  historyStatus === filter.id ? 'filter-btn filter-btn--active' : 'filter-btn'
                }
                onClick={() => setHistoryStatus(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {selectedRecord ? (
            <article className="visitor-sign-in__detail record">
              <div className="record__header">
                <div>
                  <span className="type-badge">{getVisitorStatusLabel(selectedRecord)}</span>
                  <h3 className="record__title">{selectedRecord.visitorName}</h3>
                  <p className="record__meta">
                    Arrived {formatSubmittedAt(selectedRecord.arrivalTime)}
                  </p>
                </div>
                <CloudSyncBadge record={selectedRecord} />
              </div>

              <dl className="saved-record__details">
                <SummaryRow label="Company" value={selectedRecord.company} />
                <SummaryRow label="Site" value={selectedRecord.siteName} />
                <SummaryRow label="Purpose" value={selectedRecord.purpose} />
                <SummaryRow label="Person visited" value={selectedRecord.personVisited} />
                <SummaryRow label="Vehicle" value={selectedRecord.vehicleReg} />
                <SummaryRow label="Phone" value={selectedRecord.phone} />
                <SummaryRow label="Hazards reported" value={selectedRecord.hazardsReported} />
                <SummaryRow label="Notes" value={selectedRecord.notes} />
                <SummaryRow
                  label="Departure"
                  value={
                    selectedRecord.departureTime
                      ? formatSubmittedAt(selectedRecord.departureTime)
                      : 'Still on site'
                  }
                />
                <SummaryRow
                  label="Duration"
                  value={formatVisitorDuration(
                    selectedRecord.arrivalTime,
                    selectedRecord.departureTime,
                  )}
                />
              </dl>

              <section className="visitor-sign-in__detail-acks" aria-label="Acknowledgements">
                <h4 className="form-section__title">Acknowledgements</h4>
                <ul className="visitor-sign-in__ack-summary" role="list">
                  {VISITOR_ACKNOWLEDGEMENT_ITEMS.map((item) => (
                    <li key={item.key}>
                      {selectedRecord.acknowledgements?.[item.key] ? '✓' : '✗'} {item.label}
                    </li>
                  ))}
                </ul>
                <p className="form-field__hint">
                  Declaration: {selectedRecord.declarationName || selectedRecord.visitorName || '—'}
                </p>
              </section>

              <div className="record__actions record__actions--full">
                <button
                  type="button"
                  className="print-record-btn"
                  onClick={() => setPrintRecord(selectedRecord)}
                >
                  Print
                </button>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => setSelectedRecord(null)}
                >
                  Back to list
                </button>
              </div>
            </article>
          ) : filteredHistory.length === 0 ? (
            <p className="saved-records__empty">No visitor records match your filters.</p>
          ) : (
            <ul className="visitor-sign-in__history-list" role="list">
              {filteredHistory.map((record) => (
                <li key={record.id} className="visitor-sign-in__history-item">
                  <button
                    type="button"
                    className="visitor-sign-in__history-btn"
                    onClick={() => setSelectedRecord(record)}
                  >
                    <div className="visitor-sign-in__history-row">
                      <span className="visitor-sign-in__history-name">{record.visitorName}</span>
                      <span
                        className={`type-badge type-badge--small${
                          isVisitorOnSite(record) ? ' type-badge--on-site' : ''
                        }`}
                      >
                        {getVisitorStatusLabel(record)}
                      </span>
                    </div>
                    <p className="visitor-sign-in__history-meta">
                      {[record.company, record.siteName, record.purpose].filter(Boolean).join(' · ')}
                    </p>
                    <p className="visitor-sign-in__history-times">
                      {formatSubmittedAt(record.arrivalTime)}
                      {record.departureTime
                        ? ` → ${formatSubmittedAt(record.departureTime)}`
                        : ''}
                      {' · '}
                      {formatVisitorDuration(record.arrivalTime, record.departureTime)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}
