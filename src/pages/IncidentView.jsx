import { useEffect, useMemo, useRef, useState } from 'react'
import { FORM_TYPES } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { SignatureConfirmationField } from '../components/SignatureConfirmationField.jsx'
import { PhotoUpload } from '../components/PhotoUpload.jsx'
import { RecordDetails } from '../components/RecordDetails.jsx'
import { RecordActions } from '../components/RecordActions.jsx'
import { SavedRecordSignature } from '../components/SavedRecordSignature.jsx'
import { CloudSyncBadge } from '../components/CloudSyncBadge.jsx'
import {
  ComboField,
  TextField,
  DateField,
  NotesField,
  SelectField,
  SummaryRow,
} from '../components/FormFields.jsx'
import { useHighlightRecord } from '../hooks/useHighlightRecord.js'
import { useDefaultFormDate } from '../hooks/useDefaultFormDate.js'
import { createRecordId } from '../utils/ids.js'
import { formatSubmittedAt, formatReportType } from '../utils/formatting.js'
import { createEmptyDraft, getRecordTitle } from '../utils/records.js'
import { persistSavedRecords } from '../utils/storage/recordsStorage.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
import {
  fetchIncidentRecords,
  getMergedIncidentRecords,
  getUnavailableSyncStatus,
  isCloudSaveUnavailable,
  resolveRecordSyncStatus,
  saveIncidentRecord,
  SYNC_STATUS,
} from '../utils/storage/incidentCloudStorage.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'

export function IncidentView({
  onBack,
  savedRecords,
  setSavedRecords,
  setPrintRecord,
  onRecordSaved,
  highlightRecordId,
  onClearHighlight,
  recordFocus,
  onClearRecordFocus,
  settings,
  user,
  profile,
  cloudIncidents,
  setCloudIncidents,
}) {
  const formConfig = FORM_TYPES.incident
  const [draft, setDraft] = useState(() => createEmptyDraft('incident'))
  useDefaultFormDate(setDraft)
  const [completedRecord, setCompletedRecord] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [completedSyncStatus, setCompletedSyncStatus] = useState(null)
  const [cloudLoadWarning, setCloudLoadWarning] = useState(null)
  const [cloudSaving, setCloudSaving] = useState(false)
  const recordRef = useRef(null)

  const { fields, checked, signatureConfirmation, photos } = draft
  const comboOptions = getSettingsOptions(settings)
  const checklist = formConfig.checklist
  const total = checklist.length
  const completed = checked.size
  const allComplete = completed === total
  const isAdmin = isAdminProfile(profile)

  const incidentRecords = useMemo(
    () => getMergedIncidentRecords(savedRecords, cloudIncidents),
    [savedRecords, cloudIncidents],
  )

  const cloudIncidentCount = incidentRecords.filter(
    (record) => resolveRecordSyncStatus(record) === SYNC_STATUS.CLOUD,
  ).length

  function patchSavedIncidentRecord(recordId, patch) {
    setSavedRecords((prev) => {
      const next = prev.map((item) => (item.id === recordId ? { ...item, ...patch } : item))
      persistSavedRecords(next)
      return next
    })
    setCompletedRecord((prev) => (prev?.id === recordId ? { ...prev, ...patch } : prev))
  }

  useEffect(() => {
    if (!user?.id) {
      setCloudLoadWarning(null)
      return undefined
    }

    let isMounted = true

    async function loadCloudIncidents() {
      const { records, error } = await fetchIncidentRecords(user.id, { isAdmin })
      if (!isMounted) return

      if (error) {
        setCloudLoadWarning(
          `Could not load cloud incident records: ${error.message}. Showing device records only.`,
        )
        return
      }

      setCloudLoadWarning(null)
      setCloudIncidents(records)
    }

    loadCloudIncidents()

    return () => {
      isMounted = false
    }
  }, [user?.id, isAdmin, setCloudIncidents])

  useHighlightRecord(highlightRecordId, onClearHighlight, [incidentRecords])

  useEffect(() => {
    if (recordFocus !== 'corrective') return undefined
    const timer = window.setTimeout(() => {
      onClearRecordFocus?.()
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [recordFocus, onClearRecordFocus])

  useEffect(() => {
    if (completedRecord && recordRef.current) {
      recordRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [completedRecord])

  function updateDraft(updates) {
    setDraft((prev) => ({ ...prev, ...updates }))
  }

  function updateField(field, value) {
    setValidationError(null)
    updateDraft({ fields: { ...fields, [field]: value } })
  }

  function toggleItem(index) {
    const next = new Set(checked)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    updateDraft({ checked: next })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (
      !fields.date.trim() ||
      !fields.reportedBy.trim() ||
      !fields.siteLocation.trim() ||
      !fields.reportType ||
      !fields.whatHappened.trim()
    ) {
      setValidationError(
        'Date, reported by, site / job location, type of report, and what happened are required before saving.',
      )
      return
    }

    if (!signatureConfirmation.trim()) {
      setValidationError('Signature / Name Confirmation is required before saving.')
      return
    }

    setValidationError(null)
    const completedItems = checklist.filter((_, index) => checked.has(index))
    const submittedAt = new Date().toISOString()
    const record = {
      id: createRecordId(),
      formType: 'incident',
      formTypeLabel: formConfig.title,
      fields: { ...fields },
      completedItems,
      completedCount: completed,
      totalCount: total,
      allComplete,
      signatureConfirmation: signatureConfirmation.trim(),
      photos,
      submittedAt,
    }

    const nextRecords = [record, ...savedRecords]
    if (!persistSavedRecords(nextRecords)) return
    setSavedRecords(nextRecords)
    setCompletedRecord(record)
    setCompletedSyncStatus(null)
    onRecordSaved?.(record)

    if (isCloudSaveUnavailable(user)) {
      const syncStatus = getUnavailableSyncStatus(user)
      patchSavedIncidentRecord(record.id, { syncStatus })
      setCompletedSyncStatus(syncStatus)
      return
    }

    setCloudSaving(true)
    const { record: cloudRecord, error } = await saveIncidentRecord(user, record)
    setCloudSaving(false)

    if (error) {
      patchSavedIncidentRecord(record.id, { syncStatus: SYNC_STATUS.CLOUD_FAILED })
      setCompletedSyncStatus(SYNC_STATUS.CLOUD_FAILED)
      return
    }

    const cloudPatch = {
      syncStatus: SYNC_STATUS.CLOUD,
      cloudId: cloudRecord?.cloudId ?? null,
    }
    patchSavedIncidentRecord(record.id, cloudPatch)
    setCompletedSyncStatus(SYNC_STATUS.CLOUD)

    if (cloudRecord) {
      setCloudIncidents((prev) => {
        const withoutDup = prev.filter(
          (item) => item.cloudId !== cloudRecord.cloudId && item.id !== record.id,
        )
        return [cloudRecord, ...withoutDup]
      })
    }
  }

  function handleReset() {
    setDraft(createEmptyDraft('incident'))
    setCompletedRecord(null)
    setValidationError(null)
    setCompletedSyncStatus(null)
  }

  function handleClearIncidentRecords() {
    if (incidentRecords.length === 0) return
    const confirmed = window.confirm(
      'Delete all saved incident records from this device? Cloud records will remain. Other saved records will be kept.',
    )
    if (!confirmed) return
    setSavedRecords((prev) => {
      const next = prev.filter((record) => record.formType !== 'incident')
      return persistSavedRecords(next) ? next : prev
    })
    if (completedRecord) setCompletedRecord(null)
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header no-print">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">{formConfig.title}</h1>
        <p className="progress" aria-live="polite">
          {completed} of {total} completed
        </p>
      </header>

      <form className="job-form no-print" onSubmit={handleSubmit} noValidate>
        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">1. Report details</legend>
          <DateField value={fields.date} onChange={updateField} />
          <TextField label="Time" field="time" value={fields.time} onChange={updateField} placeholder="e.g. 14:30" />
          <ComboField label="Reported by" field="reportedBy" value={fields.reportedBy} onChange={updateField} placeholder="Your name" options={comboOptions.operators} listId="incident-operators" />
          <ComboField label="Site / job location" field="siteLocation" value={fields.siteLocation} onChange={updateField} placeholder="Where it occurred" options={comboOptions.sites} listId="incident-sites" />
          <SelectField
            label="Type of report"
            field="reportType"
            value={fields.reportType}
            onChange={updateField}
            options={[
              { value: '', label: 'Select type...' },
              { value: 'incident', label: 'Incident' },
              { value: 'near-miss', label: 'Near Miss' },
              { value: 'property-damage', label: 'Property Damage' },
              { value: 'injury', label: 'Injury' },
              { value: 'environmental', label: 'Environmental' },
            ]}
          />
          <TextField label="Person involved" field="personInvolved" value={fields.personInvolved} onChange={updateField} placeholder="Names or roles" />
          <label className="field">
            <span className="field__label">What happened?</span>
            <textarea
              className="field__input field__textarea"
              value={fields.whatHappened}
              onChange={(e) => updateField('whatHappened', e.target.value)}
              placeholder="Describe what happened..."
              rows={4}
            />
          </label>
          <TextField label="Immediate action taken" field="immediateActionTaken" value={fields.immediateActionTaken} onChange={updateField} placeholder="Actions taken immediately" />
          <TextField label="Possible cause" field="possibleCause" value={fields.possibleCause} onChange={updateField} placeholder="What may have caused this?" />
          <TextField label="Corrective action required" field="correctiveActionRequired" value={fields.correctiveActionRequired} onChange={updateField} placeholder="Required corrective actions" />
          <TextField label="Person responsible for corrective action" field="correctiveActionPerson" value={fields.correctiveActionPerson} onChange={updateField} placeholder="Who will follow up?" />
          <DateField label="Follow-up date" field="followUpDate" value={fields.followUpDate} onChange={updateField} />
          <NotesField value={fields.notes} onChange={updateField} />
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">2. Incident checklist</legend>
          <ul className="checklist" role="list">
            {checklist.map((label, index) => {
              const isChecked = checked.has(index)
              return (
                <li key={label} className={isChecked ? 'item item--checked' : 'item'}>
                  <label className="item__label">
                    <input
                      type="checkbox"
                      className="item__checkbox"
                      checked={isChecked}
                      onChange={() => toggleItem(index)}
                    />
                    <span className="item__text">{label}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">3. Name confirmation &amp; photos</legend>
          <SignatureConfirmationField
            value={signatureConfirmation}
            onChange={(value) => {
              setValidationError(null)
              updateDraft({ signatureConfirmation: value })
            }}
          />
          <PhotoUpload photos={photos} onChange={(value) => updateDraft({ photos: value })} />
        </fieldset>

        {allComplete && (
          <p className="complete-message" role="status">
            Report complete. All checks completed accurately.
          </p>
        )}

        {validationError && (
          <p className="validation-message" role="alert">
            {validationError}
          </p>
        )}

        <p className="form-hint">
          Record incident details, complete the checklist, attach photos if available, then save.
        </p>

        <button type="submit" className="submit-btn" disabled={cloudSaving}>
          {cloudSaving ? 'Saving…' : 'Save completed record'}
        </button>
      </form>

      {completedRecord && (
        <section ref={recordRef} className="record no-print" aria-labelledby="incident-record-heading" role="region">
          <div className="record__header">
            <div>
              <span className="type-badge">{completedRecord.formTypeLabel}</span>
              <h2 id="incident-record-heading" className="record__title">
                Completed record
              </h2>
              <p className="record__meta">Saved {formatSubmittedAt(completedRecord.submittedAt)}</p>
            </div>
            <span
              className={
                completedRecord.allComplete
                  ? 'record__badge record__badge--complete'
                  : 'record__badge record__badge--partial'
              }
            >
              {completedRecord.allComplete ? 'All checks done' : 'Partial'}
            </span>
          </div>

          <p className="record__saved" role="status">
            Record saved to this device. Review the details below.
          </p>

          {cloudSaving ? (
            <p className="cloud-sync-status cloud-sync-status--pending" role="status">
              Syncing to cloud…
            </p>
          ) : (
            completedSyncStatus && (
              <CloudSyncBadge syncStatus={completedSyncStatus} className="cloud-sync-status--block" />
            )
          )}

          <RecordDetails record={completedRecord} />
          <RecordActions record={completedRecord} onPrint={setPrintRecord} />
        </section>
      )}

      <button type="button" className="reset-btn no-print" onClick={handleReset}>
        Reset form
      </button>
      {completedRecord && (
        <p className="reset-hint no-print">Clears the current form and record view.</p>
      )}

      <section className="saved-records no-print" aria-labelledby="incident-saved-heading">
        <div className="saved-records__header">
          <div>
            <h2 id="incident-saved-heading" className="saved-records__title">
              Saved incident records
            </h2>
            <p className="saved-records__count">
              {incidentRecords.length} record{incidentRecords.length === 1 ? '' : 's'}
              {user?.id && cloudIncidentCount > 0
                ? isAdmin
                  ? ` (${cloudIncidentCount} from cloud — all users)`
                  : ` (${cloudIncidentCount} synced from cloud)`
                : ' on this device'}
            </p>
          </div>
          {incidentRecords.length > 0 && (
            <button type="button" className="saved-records__clear" onClick={handleClearIncidentRecords}>
              Clear all
            </button>
          )}
        </div>

        {recordFocus === 'corrective' && (
          <p className="form-hint safety-alerts-focus-hint" role="status">
            Opened from an unresolved corrective action
            {highlightRecordId
              ? ' — the related incident is highlighted below if present.'
              : ' — review incident records and follow up on corrective actions.'}
          </p>
        )}

        {cloudLoadWarning && (
          <p className="backup-warning" role="alert">
            {cloudLoadWarning}
          </p>
        )}

        {isAdmin && user?.id && (
          <p className="form-hint">
            Admin view: device records on this device plus all users&apos; cloud incident records.
          </p>
        )}

        {incidentRecords.length === 0 ? (
          <p className="saved-records__empty">
            No saved incident records yet. Submit a completed report to save one here.
          </p>
        ) : (
          <ul className="saved-records__list">
            {incidentRecords.map((record) => {
              const isOtherUserCloudRecord =
                isAdmin &&
                record.cloudUserId &&
                record.cloudUserId !== user?.id &&
                resolveRecordSyncStatus(record) === SYNC_STATUS.CLOUD

              return (
              <li key={record.id} data-record-id={record.id} className="saved-record">
                <div className="saved-record__header">
                  <div className="saved-record__badges">
                    <span className="type-badge type-badge--small">{record.formTypeLabel}</span>
                    <CloudSyncBadge record={record} size="small" />
                    {isOtherUserCloudRecord && (
                      <span className="type-badge type-badge--small type-badge--cloud-user">
                        {record.fields?.reportedBy?.trim() || 'Other user'}
                      </span>
                    )}
                  </div>
                  <p className="saved-record__title">{getRecordTitle(record)}</p>
                </div>
                <dl className="saved-record__details">
                  <SummaryRow label="Type" value={formatReportType(record.fields.reportType)} />
                  <SummaryRow label="Site" value={record.fields.siteLocation ?? record.fields.location} />
                  <SummaryRow label="Reported by" value={record.fields.reportedBy} />
                  <SummaryRow label="Date" value={record.fields.date} />
                  <SummaryRow
                    label="Checklist"
                    value={`${record.completedCount} of ${record.totalCount} completed`}
                  />
                  <SummaryRow label="Notes" value={record.fields.notes} />
                </dl>

                <SavedRecordSignature record={record} />

                {record.photos?.length > 0 && (
                  <ul className="photos__thumbs photos__thumbs--compact">
                    {record.photos.map((photo) => (
                      <li key={photo.id} className="photos__thumb">
                        <img src={photo.dataUrl} alt={photo.name} />
                      </li>
                    ))}
                  </ul>
                )}

                <p className="saved-record__meta">Saved {formatSubmittedAt(record.submittedAt)}</p>
                <RecordActions record={record} onPrint={setPrintRecord} variant="saved" />
              </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
