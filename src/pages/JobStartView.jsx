import { useEffect, useRef, useState } from 'react'
import { FORM_TYPES } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { SignatureConfirmationField } from '../components/SignatureConfirmationField.jsx'
import { PhotoUpload } from '../components/PhotoUpload.jsx'
import { RecordDetails } from '../components/RecordDetails.jsx'
import { RecordActions } from '../components/RecordActions.jsx'
import { SavedRecordSignature } from '../components/SavedRecordSignature.jsx'
import {
  ComboField,
  TextField,
  DateField,
  NotesField,
  SummaryRow,
} from '../components/FormFields.jsx'
import { useHighlightRecord } from '../hooks/useHighlightRecord.js'
import { createRecordId } from '../utils/ids.js'
import { formatSubmittedAt, formatReportType } from '../utils/formatting.js'
import { createEmptyDraft, getRecordTitle } from '../utils/records.js'
import { persistSavedRecords } from '../utils/storage/recordsStorage.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'

export function JobStartView({
  onBack,
  savedRecords,
  setSavedRecords,
  setPrintRecord,
  highlightRecordId,
  onClearHighlight,
  settings,
}) {
  const formConfig = FORM_TYPES['job-start']
  const [draft, setDraft] = useState(() => createEmptyDraft('job-start'))
  const [completedRecord, setCompletedRecord] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [recordFilter, setRecordFilter] = useState('job-start')
  const recordRef = useRef(null)

  const { fields, checked, signatureConfirmation, photos } = draft
  const comboOptions = getSettingsOptions(settings)
  const checklist = formConfig.checklist
  const total = checklist.length
  const completed = checked.size
  const allComplete = completed === total

  const filteredRecords =
    recordFilter === 'all'
      ? savedRecords
      : savedRecords.filter((record) => record.formType === recordFilter)

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
    setValidationError(null)
    updateDraft({ fields: { ...fields, [field]: value } })
  }

  function toggleItem(index) {
    const next = new Set(checked)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    updateDraft({ checked: next })
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (!signatureConfirmation.trim()) {
      setValidationError('Signature / Name Confirmation is required before saving.')
      return
    }

    setValidationError(null)
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
  }

  function handleReset() {
    setDraft(createEmptyDraft('job-start'))
    setCompletedRecord(null)
    setValidationError(null)
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

      <header className="header no-print">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">{formConfig.title}</h1>
        <p className="progress" aria-live="polite">
          {completed} of {total} completed
        </p>
      </header>

      <form className="job-form no-print" onSubmit={handleSubmit} noValidate>
        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">1. Job details</legend>
          <TextField label="Job name" field="jobName" value={fields.jobName} onChange={updateField} placeholder="e.g. Driveway excavation" />
          <ComboField label="Site location" field="siteLocation" value={fields.siteLocation} onChange={updateField} placeholder="Address or site name" options={comboOptions.sites} listId="job-start-sites" />
          <ComboField label="Employee / operator name" field="employeeName" value={fields.employeeName} onChange={updateField} placeholder="Your name" options={comboOptions.operators} listId="job-start-operators" />
          <ComboField label="Machine used" field="machineUsed" value={fields.machineUsed} onChange={updateField} placeholder="e.g. 5T excavator" options={comboOptions.machines} listId="job-start-machines" />
          <DateField value={fields.date} onChange={updateField} />
          <NotesField value={fields.notes} onChange={updateField} />
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">2. Safety checklist</legend>
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
            Checklist complete. Job can begin.
          </p>
        )}

        {validationError && (
          <p className="validation-message" role="alert">
            {validationError}
          </p>
        )}

        <p className="form-hint">Fill in job details, tick each safety item, then save your completed record.</p>

        <button type="submit" className="submit-btn">
          Save completed record
        </button>
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
              {savedRecords.length} record{savedRecords.length === 1 ? '' : 's'} on this device
            </p>
          </div>
          {savedRecords.length > 0 && (
            <button type="button" className="saved-records__clear" onClick={handleClearAllRecords}>
              Clear all
            </button>
          )}
        </div>

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
            {savedRecords.length === 0
              ? 'No saved records yet. Submit a completed checklist to save one here.'
              : 'No records match this filter.'}
          </p>
        ) : (
          <ul className="saved-records__list">
            {filteredRecords.map((record) => (
              <li key={record.id} data-record-id={record.id} className="saved-record">
                <div className="saved-record__header">
                  <span className="type-badge type-badge--small">{record.formTypeLabel}</span>
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
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
