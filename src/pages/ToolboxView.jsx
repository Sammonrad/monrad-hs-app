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
  SummaryRow,
} from '../components/FormFields.jsx'
import { useHighlightRecord } from '../hooks/useHighlightRecord.js'
import { useDefaultFormDate } from '../hooks/useDefaultFormDate.js'
import { createRecordId } from '../utils/ids.js'
import { formatSubmittedAt } from '../utils/formatting.js'
import { createEmptyDraft, getRecordTitle } from '../utils/records.js'
import { persistSavedRecords } from '../utils/storage/recordsStorage.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
import {
  fetchToolboxRecords,
  getMergedToolboxRecords,
  getUnavailableSyncStatus,
  isCloudSaveUnavailable,
  resolveRecordSyncStatus,
  saveToolboxRecord,
  SYNC_STATUS,
} from '../utils/storage/toolboxCloudStorage.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import {
  scrollToFirstInvalid,
  hasValidationErrors,
  getValidationSummary,
} from '../utils/formValidation.js'

export function ToolboxView({
  onBack,
  savedRecords,
  setSavedRecords,
  setPrintRecord,
  onRecordSaved,
  highlightRecordId,
  onClearHighlight,
  settings,
  user,
  profile,
  cloudToolboxRecords,
  setCloudToolboxRecords,
}) {
  const formConfig = FORM_TYPES.toolbox
  const [draft, setDraft] = useState(() => createEmptyDraft('toolbox'))
  useDefaultFormDate(setDraft)
  const [completedRecord, setCompletedRecord] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [completedSyncStatus, setCompletedSyncStatus] = useState(null)
  const [completedCloudError, setCompletedCloudError] = useState('')
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

  const toolboxRecords = useMemo(
    () => getMergedToolboxRecords(savedRecords, cloudToolboxRecords),
    [savedRecords, cloudToolboxRecords],
  )

  const cloudToolboxCount = toolboxRecords.filter(
    (record) => resolveRecordSyncStatus(record) === SYNC_STATUS.CLOUD,
  ).length

  function patchSavedToolboxRecord(recordId, patch) {
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

    async function loadCloudToolboxRecords() {
      const { records, error } = await fetchToolboxRecords(user.id, { isAdmin })
      if (!isMounted) return

      if (error) {
        setCloudLoadWarning(
          `Could not load cloud toolbox records: ${error.message}. Showing device records only.`,
        )
        return
      }

      setCloudLoadWarning(null)
      setCloudToolboxRecords(records)
    }

    loadCloudToolboxRecords()

    return () => {
      isMounted = false
    }
  }, [user?.id, isAdmin, setCloudToolboxRecords])

  useHighlightRecord(highlightRecordId, onClearHighlight, [toolboxRecords])

  useEffect(() => {
    if (completedRecord && recordRef.current) {
      recordRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [completedRecord])

  function updateDraft(updates) {
    setDraft((prev) => ({ ...prev, ...updates }))
  }

  function updateField(field, value) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    updateDraft({ fields: { ...fields, [field]: value } })
  }

  function validateForm() {
    const errors = {}
    if (!fields.jobProjectName.trim()) {
      errors.jobProjectName = 'Job / project name is required.'
    }
    if (!fields.siteLocation.trim()) {
      errors.siteLocation = 'Site location is required.'
    }
    if (!fields.meetingLedBy.trim()) {
      errors.meetingLedBy = 'Meeting led by is required.'
    }
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
      formType: 'toolbox',
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
      patchSavedToolboxRecord(record.id, { syncStatus })
      setCompletedSyncStatus(syncStatus)
      return
    }

    setCloudSaving(true)
    const { record: cloudRecord, error } = await saveToolboxRecord(user, record)
    setCloudSaving(false)

    if (error) {
      patchSavedToolboxRecord(record.id, { syncStatus: SYNC_STATUS.CLOUD_FAILED })
      setCompletedSyncStatus(SYNC_STATUS.CLOUD_FAILED)
      setCompletedCloudError(error.message)
      return
    }

    const cloudPatch = {
      syncStatus: SYNC_STATUS.CLOUD,
      cloudId: cloudRecord?.cloudId ?? null,
    }
    patchSavedToolboxRecord(record.id, cloudPatch)
    setCompletedSyncStatus(SYNC_STATUS.CLOUD)
    setCompletedCloudError('')

    if (cloudRecord) {
      setCloudToolboxRecords((prev) => {
        const withoutDup = prev.filter(
          (item) => item.cloudId !== cloudRecord.cloudId && item.id !== record.id,
        )
        return [cloudRecord, ...withoutDup]
      })
    }
  }

  function handleReset() {
    setDraft(createEmptyDraft('toolbox'))
    setCompletedRecord(null)
    setFieldErrors({})
    setCompletedSyncStatus(null)
  }

  function handleClearToolboxRecords() {
    if (toolboxRecords.length === 0) return
    const confirmed = window.confirm(
      'Delete all saved toolbox records? Other saved records will be kept.',
    )
    if (!confirmed) return
    setSavedRecords((prev) => {
      const next = prev.filter((record) => record.formType !== 'toolbox')
      return persistSavedRecords(next) ? next : prev
    })
    if (completedRecord) setCompletedRecord(null)
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <FormPageHeader
        title={formConfig.title}
        subtitle="Brief the team on hazards and controls"
        progress={`${completed} of ${total} completed`}
      />

      <form className="job-form no-print" onSubmit={handleSubmit} noValidate>
        <FormSection title="Meeting Details" id="toolbox-details">
          <FormGrid>
            <DateField value={fields.date} onChange={updateField} />
            <FormField label="Job / project name" fieldId="jobProjectName" required error={fieldErrors.jobProjectName}>
              <TextField label="" field="jobProjectName" value={fields.jobProjectName} onChange={updateField} placeholder="e.g. Riverside subdivision" />
            </FormField>
            <FormField label="Site location" fieldId="siteLocation" required error={fieldErrors.siteLocation}>
              <ComboField label="" field="siteLocation" value={fields.siteLocation} onChange={updateField} placeholder="Address or site name" options={comboOptions.sites} listId="toolbox-sites" />
            </FormField>
            <FormField label="Meeting led by" fieldId="meetingLedBy" required error={fieldErrors.meetingLedBy}>
              <ComboField label="" field="meetingLedBy" value={fields.meetingLedBy} onChange={updateField} placeholder="Facilitator name" options={comboOptions.operators} listId="toolbox-operators" />
            </FormField>
            <TextField label="Attendees" field="attendees" value={fields.attendees} onChange={updateField} placeholder="Names or crew count" />
            <FormGridFull>
              <TextField label="Work planned today" field="workPlannedToday" value={fields.workPlannedToday} onChange={updateField} placeholder="Tasks planned for today" />
            </FormGridFull>
          </FormGrid>
        </FormSection>

        <FormSection title="Hazards and Controls" id="toolbox-hazards">
          <FormGrid>
            <TextField label="Main hazards discussed" field="mainHazardsDiscussed" value={fields.mainHazardsDiscussed} onChange={updateField} placeholder="Key hazards covered" />
            <TextField label="Controls agreed" field="controlsAgreed" value={fields.controlsAgreed} onChange={updateField} placeholder="Agreed control measures" />
            <TextField label="Weather / ground conditions" field="weatherGroundConditions" value={fields.weatherGroundConditions} onChange={updateField} placeholder="e.g. Dry, firm ground" />
            <FormGridFull>
              <NotesField value={fields.notes} onChange={updateField} />
            </FormGridFull>
          </FormGrid>
        </FormSection>

        <FormSection title="Toolbox Checklist" id="toolbox-checklist">
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

        <FormSection title="Confirmation & Photos" id="toolbox-confirmation">
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
            Toolbox complete. Everyone understands the work plan.
          </p>
        )}

        <FormActions>
          {hasValidationErrors(fieldErrors) && (
            <ValidationMessage variant="summary" messages={getValidationSummary(fieldErrors)} />
          )}
          <p className="form-hint">Record meeting details, complete the checklist, then submit your record.</p>
          <button type="submit" className="submit-btn" disabled={cloudSaving}>
            {cloudSaving ? 'Saving…' : 'Submit Record'}
          </button>
        </FormActions>
      </form>

      {completedRecord && (
        <section ref={recordRef} className="record no-print" aria-labelledby="toolbox-record-heading" role="region">
          <div className="record__header">
            <div>
              <span className="type-badge">{completedRecord.formTypeLabel}</span>
              <h2 id="toolbox-record-heading" className="record__title">
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

      <section className="saved-records no-print" aria-labelledby="toolbox-saved-heading">
        <div className="saved-records__header">
          <div>
            <h2 id="toolbox-saved-heading" className="saved-records__title">
              Saved toolbox records
            </h2>
            <p className="saved-records__count">
              {toolboxRecords.length} record{toolboxRecords.length === 1 ? '' : 's'}
              {user?.id && cloudToolboxCount > 0
                ? isAdmin
                  ? ` (${cloudToolboxCount} from cloud — all users)`
                  : ` (${cloudToolboxCount} synced from cloud)`
                : ' on this device'}
            </p>
          </div>
          {toolboxRecords.length > 0 && (
            <button type="button" className="saved-records__clear" onClick={handleClearToolboxRecords}>
              Clear all
            </button>
          )}
        </div>

        {cloudLoadWarning && (
          <p className="backup-warning" role="alert">
            {cloudLoadWarning}
          </p>
        )}

        {isAdmin && user?.id && (
          <p className="form-hint">
            Admin view: device records on this device plus all users&apos; cloud toolbox records.
          </p>
        )}

        {toolboxRecords.length === 0 ? (
          <p className="saved-records__empty">
            No saved toolbox records yet. Submit a completed meeting to save one here.
          </p>
        ) : (
          <ul className="saved-records__list">
            {toolboxRecords.map((record) => {
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
                        {record.fields?.meetingLedBy?.trim() || 'Other user'}
                      </span>
                    )}
                  </div>
                  <p className="saved-record__title">{getRecordTitle(record)}</p>
                </div>
                <dl className="saved-record__details">
                  <SummaryRow label="Site" value={record.fields.siteLocation} />
                  <SummaryRow label="Led by" value={record.fields.meetingLedBy ?? record.fields.facilitator} />
                  <SummaryRow label="Attendees" value={record.fields.attendees} />
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
