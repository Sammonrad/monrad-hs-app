import { useEffect, useMemo, useRef, useState } from 'react'
import { FORM_TYPES } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { SignatureConfirmationField } from '../components/SignatureConfirmationField.jsx'
import { PhotoUpload } from '../components/PhotoUpload.jsx'
import { RecordDetails } from '../components/RecordDetails.jsx'
import { RecordActions } from '../components/RecordActions.jsx'
import { SavedRecordSignature } from '../components/SavedRecordSignature.jsx'
import { CloudSyncBadge } from '../components/CloudSyncBadge.jsx'
import { FormSection } from '../components/forms/FormSection.jsx'
import { FormField } from '../components/forms/FormField.jsx'
import { FormActions } from '../components/forms/FormActions.jsx'
import { FormGrid, FormGridFull } from '../components/layout/FormGrid.jsx'
import { FormPageHeader } from '../components/forms/FormPageHeader.jsx'
import { ValidationMessage } from '../components/forms/ValidationMessage.jsx'
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
import {
  scrollToFirstInvalid,
  hasValidationErrors,
  getValidationSummary,
} from '../utils/formValidation.js'

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
  const [fieldErrors, setFieldErrors] = useState({})
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

  const isSeriousType = ['incident', 'injury', 'property-damage'].includes(fields.reportType)

  function updateField(field, value) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    updateDraft({ fields: { ...fields, [field]: value } })
  }

  function validateForm() {
    const errors = {}
    if (!fields.date.trim()) errors.date = 'Date is required.'
    if (!fields.reportedBy.trim()) errors.reportedBy = 'Reported by is required.'
    if (!fields.siteLocation.trim()) errors.siteLocation = 'Site / job location is required.'
    if (!fields.reportType) errors.reportType = 'Type of report is required.'
    if (!fields.whatHappened.trim()) errors.whatHappened = 'Description of what happened is required.'
    if (!signatureConfirmation.trim()) {
      errors.signatureConfirmation = 'Signature / name confirmation is required.'
    }
    return errors
  }

  function toggleItem(index) {
    const next = new Set(checked)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    updateDraft({ checked: next })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const errors = validateForm()
    if (hasValidationErrors(errors)) {
      setFieldErrors(errors)
      scrollToFirstInvalid(errors)
      return
    }

    setFieldErrors({})
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
    setFieldErrors({})
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

      <FormPageHeader
        title={formConfig.title}
        subtitle="Record incidents, near misses, and follow-up actions"
        progress={`${completed} of ${total} completed`}
      />

      <form className="job-form no-print" onSubmit={handleSubmit} noValidate>
        <FormSection
          title="Event"
          id="incident-event"
          variant={isSeriousType ? 'urgent' : undefined}
          description="When and where did this occur?"
        >
          <FormGrid>
            <FormField label="Date" fieldId="date" required error={fieldErrors.date}>
              <DateField label="" value={fields.date} onChange={updateField} />
            </FormField>
            <TextField label="Time" field="time" value={fields.time} onChange={updateField} placeholder="e.g. 14:30" />
            <FormField label="Site / job location" fieldId="siteLocation" required error={fieldErrors.siteLocation}>
              <ComboField label="" field="siteLocation" value={fields.siteLocation} onChange={updateField} placeholder="Where it occurred" options={comboOptions.sites} listId="incident-sites" />
            </FormField>
            <FormField label="Type of report" fieldId="reportType" required error={fieldErrors.reportType}>
              <SelectField
                label=""
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
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Injury / Damage" id="incident-injury">
          <FormField label="What happened?" fieldId="whatHappened" required error={fieldErrors.whatHappened}>
            <textarea
              className="field__input field__textarea"
              value={fields.whatHappened}
              onChange={(e) => updateField('whatHappened', e.target.value)}
              placeholder="Describe what happened..."
              rows={4}
            />
          </FormField>
          <TextField label="Possible cause" field="possibleCause" value={fields.possibleCause} onChange={updateField} placeholder="What may have caused this?" />
        </FormSection>

        <FormSection title="Immediate Actions" id="incident-actions">
          <TextField label="Immediate action taken" field="immediateActionTaken" value={fields.immediateActionTaken} onChange={updateField} placeholder="Actions taken immediately" />
        </FormSection>

        <FormSection title="People" id="incident-people">
          <FormGrid>
            <FormField label="Reported by" fieldId="reportedBy" required error={fieldErrors.reportedBy}>
              <ComboField label="" field="reportedBy" value={fields.reportedBy} onChange={updateField} placeholder="Your name" options={comboOptions.operators} listId="incident-operators" />
            </FormField>
            <TextField label="Person involved" field="personInvolved" value={fields.personInvolved} onChange={updateField} placeholder="Names or roles" />
            <TextField label="Person responsible for corrective action" field="correctiveActionPerson" value={fields.correctiveActionPerson} onChange={updateField} placeholder="Who will follow up?" />
          </FormGrid>
        </FormSection>

        <FormSection title="Follow-Up" id="incident-followup">
          <TextField label="Corrective action required" field="correctiveActionRequired" value={fields.correctiveActionRequired} onChange={updateField} placeholder="Required corrective actions" />
          <DateField label="Follow-up date" field="followUpDate" value={fields.followUpDate} onChange={updateField} />
          <NotesField value={fields.notes} onChange={updateField} />
        </FormSection>

        <FormSection title="Incident Checklist" id="incident-checklist">
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
        </FormSection>

        <FormSection title="Confirmation & Photos" id="incident-confirmation">
          <FormField
            label="Signature / name confirmation"
            fieldId="signatureConfirmation"
            required
            error={fieldErrors.signatureConfirmation}
          >
            <SignatureConfirmationField
              value={signatureConfirmation}
              onChange={(value) => {
                setFieldErrors((prev) => ({ ...prev, signatureConfirmation: undefined }))
                updateDraft({ signatureConfirmation: value })
              }}
            />
          </FormField>
          <PhotoUpload photos={photos} onChange={(value) => updateDraft({ photos: value })} />
        </FormSection>

        {allComplete && (
          <p className="complete-message" role="status">
            Report complete. All checks completed accurately.
          </p>
        )}

        <FormActions>
          {hasValidationErrors(fieldErrors) && (
            <ValidationMessage variant="summary" messages={getValidationSummary(fieldErrors)} />
          )}
          <p className="form-hint">Record incident details, complete the checklist, then submit your report.</p>
          <button type="submit" className="submit-btn" disabled={cloudSaving}>
            {cloudSaving ? 'Saving…' : 'Submit Record'}
          </button>
        </FormActions>
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
