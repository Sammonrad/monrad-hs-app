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
import { formatSubmittedAt, formatReportType } from '../utils/formatting.js'
import { createEmptyDraft, getRecordTitle } from '../utils/records.js'
import { persistSavedRecords } from '../utils/storage/recordsStorage.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
import {
  fetchJobStartRecords,
  getMergedJobStartRecords,
  getUnavailableSyncStatus,
  isCloudSaveUnavailable,
  resolveRecordSyncStatus,
  saveJobStartRecord,
  SYNC_STATUS,
} from '../utils/storage/jobStartCloudStorage.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import {
  scrollToFirstInvalid,
  hasValidationErrors,
  getValidationSummary,
} from '../utils/formValidation.js'

export function JobStartView({
  onBack,
  savedRecords,
  setSavedRecords,
  setPrintRecord,
  highlightRecordId,
  onClearHighlight,
  settings,
  user,
  profile,
  cloudJobStarts,
  setCloudJobStarts,
}) {
  const formConfig = FORM_TYPES['job-start']
  const [draft, setDraft] = useState(() => createEmptyDraft('job-start'))
  useDefaultFormDate(setDraft)
  const [completedRecord, setCompletedRecord] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [completedSyncStatus, setCompletedSyncStatus] = useState(null)
  const [cloudLoadWarning, setCloudLoadWarning] = useState(null)
  const [cloudSaving, setCloudSaving] = useState(false)
  const [recordFilter, setRecordFilter] = useState('job-start')
  const recordRef = useRef(null)

  const { fields, checked, signatureConfirmation, photos } = draft
  const comboOptions = getSettingsOptions(settings)
  const checklist = formConfig.checklist
  const total = checklist.length
  const completed = checked.size
  const allComplete = completed === total
  const isAdmin = isAdminProfile(profile)

  const mergedJobStarts = useMemo(
    () => getMergedJobStartRecords(savedRecords, cloudJobStarts),
    [savedRecords, cloudJobStarts],
  )

  const cloudJobStartCount = mergedJobStarts.filter(
    (record) => resolveRecordSyncStatus(record) === SYNC_STATUS.CLOUD,
  ).length

  const filteredRecords = useMemo(() => {
    if (recordFilter === 'job-start') return mergedJobStarts
    if (recordFilter === 'all') {
      const otherRecords = savedRecords.filter((record) => record.formType !== 'job-start')
      return [...mergedJobStarts, ...otherRecords].sort((a, b) =>
        (b.submittedAt || '').localeCompare(a.submittedAt || ''),
      )
    }
    return savedRecords.filter((record) => record.formType === recordFilter)
  }, [recordFilter, mergedJobStarts, savedRecords])

  function patchSavedJobStartRecord(recordId, patch) {
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

    async function loadCloudJobStarts() {
      const { records, error } = await fetchJobStartRecords(user.id, { isAdmin })
      if (!isMounted) return

      if (error) {
        setCloudLoadWarning(
          `Could not load cloud job start records: ${error.message}. Showing device records only.`,
        )
        return
      }

      setCloudLoadWarning(null)
      setCloudJobStarts(records)
    }

    loadCloudJobStarts()

    return () => {
      isMounted = false
    }
  }, [user?.id, isAdmin, setCloudJobStarts])

  useHighlightRecord(highlightRecordId, onClearHighlight, [filteredRecords])

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
      formType: 'job-start',
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

    if (isCloudSaveUnavailable(user)) {
      const syncStatus = getUnavailableSyncStatus(user)
      patchSavedJobStartRecord(record.id, { syncStatus })
      setCompletedSyncStatus(syncStatus)
      return
    }

    setCloudSaving(true)
    const { record: cloudRecord, error } = await saveJobStartRecord(user, record)
    setCloudSaving(false)

    if (error) {
      patchSavedJobStartRecord(record.id, { syncStatus: SYNC_STATUS.CLOUD_FAILED })
      setCompletedSyncStatus(SYNC_STATUS.CLOUD_FAILED)
      return
    }

    const cloudPatch = {
      syncStatus: SYNC_STATUS.CLOUD,
      cloudId: cloudRecord?.cloudId ?? null,
    }
    patchSavedJobStartRecord(record.id, cloudPatch)
    setCompletedSyncStatus(SYNC_STATUS.CLOUD)

    if (cloudRecord) {
      setCloudJobStarts((prev) => {
        const withoutDup = prev.filter(
          (item) => item.cloudId !== cloudRecord.cloudId && item.id !== record.id,
        )
        return [cloudRecord, ...withoutDup]
      })
    }
  }

  function handleReset() {
    setDraft(createEmptyDraft('job-start'))
    setCompletedRecord(null)
    setFieldErrors({})
    setCompletedSyncStatus(null)
  }

  function handleClearAllRecords() {
    if (savedRecords.length === 0) return
    const confirmed = window.confirm(
      'Delete all saved records from this device? This cannot be undone.',
    )
    if (!confirmed) return
    if (!persistSavedRecords([])) return
    setSavedRecords([])
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <FormPageHeader
        title={formConfig.title}
        subtitle="Confirm site readiness before work begins"
        progress={`${completed} of ${total} completed`}
      />

      <form className="job-form no-print" onSubmit={handleSubmit} noValidate>
        <FormSection title="Job Details" id="job-details">
          <FormGrid>
            <TextField label="Job name" field="jobName" value={fields.jobName} onChange={updateField} placeholder="e.g. Driveway excavation" />
            <ComboField label="Site location" field="siteLocation" value={fields.siteLocation} onChange={updateField} placeholder="Address or site name" options={comboOptions.sites} listId="job-start-sites" />
            <ComboField label="Employee / operator name" field="employeeName" value={fields.employeeName} onChange={updateField} placeholder="Your name" options={comboOptions.operators} listId="job-start-operators" />
            <ComboField label="Machine used" field="machineUsed" value={fields.machineUsed} onChange={updateField} placeholder="e.g. 5T excavator" options={comboOptions.machines} listId="job-start-machines" />
            <DateField value={fields.date} onChange={updateField} />
            <FormGridFull>
              <NotesField value={fields.notes} onChange={updateField} />
            </FormGridFull>
          </FormGrid>
        </FormSection>

        <FormSection title="Safety Checklist" id="safety-checklist">
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

        <FormSection title="Confirmation & Photos" id="confirmation">
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
            Checklist complete. Job can begin.
          </p>
        )}

        <FormActions>
          {hasValidationErrors(fieldErrors) && (
            <ValidationMessage variant="summary" messages={getValidationSummary(fieldErrors)} />
          )}
          <p className="form-hint">Fill in job details, tick each safety item, then submit your record.</p>
          <button type="submit" className="submit-btn" disabled={cloudSaving}>
            {cloudSaving ? 'Saving…' : 'Submit Record'}
          </button>
        </FormActions>
      </form>

      {completedRecord && (
        <section ref={recordRef} className="record no-print" aria-labelledby="record-heading" role="region">
          <div className="record__header">
            <div>
              <span className="type-badge">{completedRecord.formTypeLabel}</span>
              <h2 id="record-heading" className="record__title">
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

      <section className="saved-records no-print" aria-labelledby="saved-records-heading">
        <div className="saved-records__header">
          <div>
            <h2 id="saved-records-heading" className="saved-records__title">
              Saved records
            </h2>
            <p className="saved-records__count">
              {filteredRecords.length} record{filteredRecords.length === 1 ? '' : 's'}
              {recordFilter === 'job-start' && user?.id && cloudJobStartCount > 0
                ? isAdmin
                  ? ` (${cloudJobStartCount} from cloud — all users)`
                  : ` (${cloudJobStartCount} synced from cloud)`
                : ''}
            </p>
          </div>
          {savedRecords.length > 0 && (
            <button type="button" className="saved-records__clear" onClick={handleClearAllRecords}>
              Clear all
            </button>
          )}
        </div>

        {cloudLoadWarning && (
          <p className="backup-warning" role="alert">
            {cloudLoadWarning}
          </p>
        )}

        {isAdmin && user?.id && recordFilter === 'job-start' && (
          <p className="form-hint">
            Admin view: device records on this device plus all users&apos; cloud job start records.
          </p>
        )}

        <div className="saved-records__filters" role="tablist" aria-label="Filter records">
          <button
            type="button"
            className={recordFilter === 'all' ? 'filter-btn filter-btn--active' : 'filter-btn'}
            onClick={() => setRecordFilter('all')}
          >
            All
          </button>
          {Object.values(FORM_TYPES).map((type) => (
            <button
              key={type.id}
              type="button"
              className={recordFilter === type.id ? 'filter-btn filter-btn--active' : 'filter-btn'}
              onClick={() => setRecordFilter(type.id)}
            >
              {type.label}
            </button>
          ))}
        </div>

        {filteredRecords.length === 0 ? (
          <p className="saved-records__empty">
            {savedRecords.length === 0 && mergedJobStarts.length === 0
              ? 'No saved records yet. Submit a completed checklist to save one here.'
              : 'No records match this filter.'}
          </p>
        ) : (
          <ul className="saved-records__list">
            {filteredRecords.map((record) => {
              const isOtherUserCloudRecord =
                record.formType === 'job-start' &&
                isAdmin &&
                record.cloudUserId &&
                record.cloudUserId !== user?.id &&
                resolveRecordSyncStatus(record) === SYNC_STATUS.CLOUD

              return (
              <li key={record.id} data-record-id={record.id} className="saved-record">
                <div className="saved-record__header">
                  <div className="saved-record__badges">
                    <span className="type-badge type-badge--small">{record.formTypeLabel}</span>
                    {record.formType === 'job-start' && (
                      <CloudSyncBadge record={record} size="small" />
                    )}
                    {isOtherUserCloudRecord && (
                      <span className="type-badge type-badge--small type-badge--cloud-user">
                        {record.fields?.employeeName?.trim() || 'Other user'}
                      </span>
                    )}
                  </div>
                  <p className="saved-record__title">{getRecordTitle(record)}</p>
                </div>
                <dl className="saved-record__details">
                  {record.formType === 'job-start' && (
                    <>
                      <SummaryRow label="Site" value={record.fields.siteLocation} />
                      <SummaryRow label="Operator" value={record.fields.employeeName} />
                      <SummaryRow label="Machine" value={record.fields.machineUsed} />
                    </>
                  )}
                  {record.formType === 'pre-start' && (
                    <>
                      <SummaryRow label="Operator" value={record.fields.operatorName ?? record.fields.operator} />
                      <SummaryRow label="Machine" value={record.fields.machineNameId ?? record.fields.machine} />
                      <SummaryRow label="Site" value={record.fields.siteLocation} />
                      <SummaryRow label="Hours" value={record.fields.machineHours ?? record.fields.hourMeter} />
                    </>
                  )}
                  {record.formType === 'toolbox' && (
                    <>
                      <SummaryRow label="Site" value={record.fields.siteLocation} />
                      <SummaryRow label="Led by" value={record.fields.meetingLedBy ?? record.fields.facilitator} />
                      <SummaryRow label="Attendees" value={record.fields.attendees} />
                    </>
                  )}
                  {record.formType === 'incident' && (
                    <>
                      <SummaryRow label="Type" value={formatReportType(record.fields.reportType)} />
                      <SummaryRow label="Site" value={record.fields.siteLocation ?? record.fields.location} />
                      <SummaryRow label="Reported by" value={record.fields.reportedBy} />
                    </>
                  )}
                  {record.formType === 'timesheet' && (
                    <>
                      <SummaryRow label="Employee" value={record.fields.employeeName} />
                      <SummaryRow label="Job" value={record.fields.jobProjectName} />
                      <SummaryRow label="Site" value={record.fields.siteLocation} />
                      <SummaryRow label="Hours" value={record.fields.totalHoursWorked} />
                    </>
                  )}
                  <SummaryRow label="Date" value={record.fields.date} />
                  {record.totalCount > 0 && (
                    <SummaryRow
                      label="Checklist"
                      value={`${record.completedCount} of ${record.totalCount} completed`}
                    />
                  )}
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
            )})}
          </ul>
        )}
      </section>
    </>
  )
}
