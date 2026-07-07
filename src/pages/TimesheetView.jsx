import { useEffect, useMemo, useRef, useState } from 'react'
import { FORM_TYPES } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { SignatureConfirmationField } from '../components/SignatureConfirmationField.jsx'
import { RecordDetails } from '../components/RecordDetails.jsx'
import { RecordActions } from '../components/RecordActions.jsx'
import { SavedRecordSignature } from '../components/SavedRecordSignature.jsx'
import {
  ComboField,
  TextField,
  DateField,
  NotesField,
  TimeField,
  SummaryRow,
} from '../components/FormFields.jsx'
import { useHighlightRecord } from '../hooks/useHighlightRecord.js'
import { createRecordId } from '../utils/ids.js'
import { formatSubmittedAt, formatDecimalHoursDisplay } from '../utils/formatting.js'
import { createEmptyDraft, getRecordTitle } from '../utils/records.js'
import { persistSavedRecords } from '../utils/storage/recordsStorage.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
import {
  fetchTimesheetRecords,
  getMergedTimesheetRecords,
  saveTimesheetRecord,
} from '../utils/storage/timesheetCloudStorage.js'
import {
  calculateLabourHours,
  calculateAutoChargeableHours,
  parseDecimalHours,
} from '../utils/time.js'

export function TimesheetView({
  onBack,
  savedRecords,
  setSavedRecords,
  setPrintRecord,
  highlightRecordId,
  onClearHighlight,
  settings,
  user,
  cloudTimesheets,
  setCloudTimesheets,
}) {
  const formConfig = FORM_TYPES.timesheet
  const [draft, setDraft] = useState(() => createEmptyDraft('timesheet'))
  const [completedRecord, setCompletedRecord] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [cloudSaveWarning, setCloudSaveWarning] = useState(null)
  const [cloudLoadWarning, setCloudLoadWarning] = useState(null)
  const [cloudSaving, setCloudSaving] = useState(false)
  const [chargeableEdited, setChargeableEdited] = useState(false)
  const recordRef = useRef(null)

  const { fields, signatureConfirmation } = draft
  const comboOptions = getSettingsOptions(settings)

  const labourCalc = useMemo(
    () => calculateLabourHours(fields.startTime, fields.finishTime, fields.breakMinutes),
    [fields.startTime, fields.finishTime, fields.breakMinutes],
  )

  const autoChargeableHours = useMemo(
    () => calculateAutoChargeableHours(labourCalc.minutes, fields.nonChargeableHours),
    [labourCalc.minutes, fields.nonChargeableHours],
  )

  const displayedChargeableHours = chargeableEdited ? fields.chargeableHours : autoChargeableHours

  const timesheetRecords = useMemo(
    () => getMergedTimesheetRecords(savedRecords, cloudTimesheets),
    [savedRecords, cloudTimesheets],
  )

  const cloudRecordCount = timesheetRecords.filter(
    (record) => record.storageSource === 'cloud' || record.storageSource === 'both',
  ).length

  useEffect(() => {
    if (!user?.id) {
      setCloudLoadWarning(null)
      return undefined
    }

    let isMounted = true

    async function loadCloudTimesheets() {
      const { records, error } = await fetchTimesheetRecords(user.id)
      if (!isMounted) return

      if (error) {
        setCloudLoadWarning(
          `Could not load cloud timesheets: ${error.message}. Showing device records only.`,
        )
        return
      }

      setCloudLoadWarning(null)
      setCloudTimesheets(records)
    }

    loadCloudTimesheets()

    return () => {
      isMounted = false
    }
  }, [user?.id, setCloudTimesheets])

  useHighlightRecord(highlightRecordId, onClearHighlight, [timesheetRecords])

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
    if (field === 'startTime' || field === 'finishTime' || field === 'breakMinutes' || field === 'nonChargeableHours') {
      setChargeableEdited(false)
    }
    updateDraft({ fields: { ...fields, [field]: value } })
  }

  function handleChargeableChange(value) {
    setValidationError(null)
    setChargeableEdited(true)
    updateDraft({ fields: { ...fields, chargeableHours: value } })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (
      !fields.date.trim() ||
      !fields.employeeName.trim() ||
      !fields.jobProjectName.trim() ||
      !fields.siteLocation.trim() ||
      !fields.startTime ||
      !fields.finishTime ||
      !fields.workCompleted.trim()
    ) {
      setValidationError(
        'Date, employee / operator, job / project, site, start time, finish time, and work completed are required before saving.',
      )
      return
    }

    if (!signatureConfirmation.trim()) {
      setValidationError('Signature / Name Confirmation is required before saving.')
      return
    }

    if (labourCalc.invalid) {
      setValidationError('Finish time must be after start time on the same day.')
      return
    }

    const nonChargeable = parseDecimalHours(fields.nonChargeableHours)
    if (nonChargeable > 0 && !fields.nonChargeableReason.trim()) {
      setValidationError('Reason for non-chargeable time is required when non-chargeable hours are entered.')
      return
    }

    setValidationError(null)
    const submittedAt = new Date().toISOString()
    const chargeableHours =
      chargeableEdited && fields.chargeableHours.trim()
        ? fields.chargeableHours.trim()
        : autoChargeableHours

    const record = {
      id: createRecordId(),
      formType: 'timesheet',
      formTypeLabel: formConfig.title,
      fields: {
        date: fields.date,
        employeeName: fields.employeeName,
        jobProjectName: fields.jobProjectName,
        siteLocation: fields.siteLocation,
        customerName: fields.customerName,
        machineUsed: fields.machineUsed,
        startTime: fields.startTime,
        finishTime: fields.finishTime,
        breakMinutes: fields.breakMinutes,
        totalHoursWorked: labourCalc.value,
        chargeableHours,
        nonChargeableHours: fields.nonChargeableHours,
        nonChargeableReason: fields.nonChargeableReason,
        workCompleted: fields.workCompleted,
        materialsUsed: fields.materialsUsed,
        docketNumber: fields.docketNumber,
        delaysOrIssues: fields.delaysOrIssues,
        safetyIssues: fields.safetyIssues,
        notes: fields.notes,
      },
      completedItems: [],
      completedCount: 0,
      totalCount: 0,
      allComplete: true,
      signatureConfirmation: signatureConfirmation.trim(),
      photos: [],
      submittedAt,
    }

    const nextRecords = [record, ...savedRecords]
    if (!persistSavedRecords(nextRecords)) return
    setSavedRecords(nextRecords)
    setCompletedRecord(record)
    setCloudSaveWarning(null)

    if (!user?.id) return

    setCloudSaving(true)
    const { record: cloudRecord, error } = await saveTimesheetRecord(user, record)
    setCloudSaving(false)

    if (error) {
      setCloudSaveWarning(
        `Saved on this device, but cloud sync failed: ${error.message}. Your record is safe locally.`,
      )
      return
    }

    if (cloudRecord) {
      setCloudTimesheets((prev) => {
        const withoutDup = prev.filter(
          (item) => item.cloudId !== cloudRecord.cloudId && item.id !== record.id,
        )
        return [cloudRecord, ...withoutDup]
      })
    }
  }

  function handleReset() {
    setDraft(createEmptyDraft('timesheet'))
    setCompletedRecord(null)
    setValidationError(null)
    setCloudSaveWarning(null)
    setChargeableEdited(false)
  }

  function handleClearTimesheetRecords() {
    if (timesheetRecords.length === 0) return
    const confirmed = window.confirm(
      'Delete all saved timesheet records? Other saved records will be kept.',
    )
    if (!confirmed) return
    setSavedRecords((prev) => {
      const next = prev.filter((record) => record.formType !== 'timesheet')
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
        <p className="progress">Daily work and hours record</p>
      </header>

      <form className="job-form no-print" onSubmit={handleSubmit} noValidate>
        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">1. Job details</legend>
          <DateField value={fields.date} onChange={updateField} />
          <ComboField
            label="Employee / operator name"
            field="employeeName"
            value={fields.employeeName}
            onChange={updateField}
            placeholder="Your name"
            options={comboOptions.operators}
            listId="timesheet-operators"
          />
          <TextField
            label="Job / project name"
            field="jobProjectName"
            value={fields.jobProjectName}
            onChange={updateField}
            placeholder="e.g. Driveway excavation"
          />
          <ComboField
            label="Site location"
            field="siteLocation"
            value={fields.siteLocation}
            onChange={updateField}
            placeholder="Address or site name"
            options={comboOptions.sites}
            listId="timesheet-sites"
          />
          <TextField
            label="Customer / client name"
            field="customerName"
            value={fields.customerName}
            onChange={updateField}
            placeholder="Client or company name"
          />
          <ComboField
            label="Machine used"
            field="machineUsed"
            value={fields.machineUsed}
            onChange={updateField}
            placeholder="e.g. EX-01"
            options={comboOptions.machines}
            listId="timesheet-machines"
          />
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">2. Labour time</legend>
          <TimeField label="Start time" field="startTime" value={fields.startTime} onChange={updateField} />
          <TimeField label="Finish time" field="finishTime" value={fields.finishTime} onChange={updateField} />
          <TextField
            label="Break time (minutes)"
            field="breakMinutes"
            value={fields.breakMinutes}
            onChange={updateField}
            placeholder="e.g. 30"
          />
          <div className="timesheet-calc" aria-live="polite">
            <span className="timesheet-calc__label">Total hours worked</span>
            <span className="timesheet-calc__value">
              {labourCalc.invalid
                ? '—'
                : labourCalc.value || 'Enter start and finish times'}
            </span>
          </div>
          {labourCalc.invalid && (
            <p className="validation-message" role="alert">
              Finish time must be after start time on the same day.
            </p>
          )}
          <label className="field">
            <span className="field__label">Chargeable hours</span>
            <input
              type="text"
              className="field__input"
              value={displayedChargeableHours}
              onChange={(e) => handleChargeableChange(e.target.value)}
              placeholder="Auto-calculated from total minus non-chargeable"
            />
            <span className="field__hint">
              {chargeableEdited
                ? 'Manual override — change times or non-chargeable to recalculate automatically'
                : 'Auto: total hours worked minus non-chargeable hours'}
            </span>
          </label>
          <TextField
            label="Non-chargeable hours"
            field="nonChargeableHours"
            value={fields.nonChargeableHours}
            onChange={updateField}
            placeholder="e.g. 1.5"
          />
          <TextField
            label="Reason for non-chargeable time"
            field="nonChargeableReason"
            value={fields.nonChargeableReason}
            onChange={updateField}
            placeholder="Required if non-chargeable hours entered"
          />
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">3. Work details</legend>
          <label className="field">
            <span className="field__label">Work completed</span>
            <textarea
              className="field__input field__textarea"
              value={fields.workCompleted}
              onChange={(e) => updateField('workCompleted', e.target.value)}
              placeholder="Describe work completed today..."
              rows={4}
            />
          </label>
          <TextField
            label="Materials used or delivered"
            field="materialsUsed"
            value={fields.materialsUsed}
            onChange={updateField}
            placeholder="Materials, quantities, deliveries..."
          />
          <TextField
            label="Docket / reference number"
            field="docketNumber"
            value={fields.docketNumber}
            onChange={updateField}
            placeholder="Docket or job reference"
          />
          <TextField
            label="Delays or issues"
            field="delaysOrIssues"
            value={fields.delaysOrIssues}
            onChange={updateField}
            placeholder="Any delays or issues encountered"
          />
          <TextField
            label="Safety issues or hazards noticed"
            field="safetyIssues"
            value={fields.safetyIssues}
            onChange={updateField}
            placeholder="Hazards or safety concerns"
          />
          <NotesField value={fields.notes} onChange={updateField} />
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">4. Name confirmation</legend>
          <SignatureConfirmationField
            value={signatureConfirmation}
            onChange={(value) => {
              setValidationError(null)
              updateDraft({ signatureConfirmation: value })
            }}
          />
        </fieldset>

        {validationError && (
          <p className="validation-message" role="alert">
            {validationError}
          </p>
        )}

        <p className="form-hint">
          Complete job and time details, then save your daily work record.
        </p>

        <button type="submit" className="submit-btn">
          Save timesheet record
        </button>
      </form>

      {completedRecord && (
        <section ref={recordRef} className="record no-print" aria-labelledby="timesheet-record-heading" role="region">
          <div className="record__header">
            <div>
              <span className="type-badge">{completedRecord.formTypeLabel}</span>
              <h2 id="timesheet-record-heading" className="record__title">
                Completed record
              </h2>
              <p className="record__meta">Saved {formatSubmittedAt(completedRecord.submittedAt)}</p>
            </div>
          </div>

          <p className="record__saved" role="status">
            {cloudSaving
              ? 'Saved on this device. Syncing to cloud…'
              : cloudSaveWarning
                ? 'Saved on this device. Cloud sync did not complete — see warning below.'
                : user?.id
                  ? 'Record saved to this device and cloud. Review the details below.'
                  : 'Record saved to this device. Review the details below.'}
          </p>

          {cloudSaveWarning && (
            <p className="backup-warning" role="alert">
              {cloudSaveWarning}
            </p>
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

      <section className="saved-records no-print" aria-labelledby="timesheet-saved-heading">
        <div className="saved-records__header">
          <div>
            <h2 id="timesheet-saved-heading" className="saved-records__title">
              Saved timesheet records
            </h2>
            <p className="saved-records__count">
              {timesheetRecords.length} record{timesheetRecords.length === 1 ? '' : 's'}
              {user?.id && cloudRecordCount > 0
                ? ` (${cloudRecordCount} synced from cloud)`
                : ' on this device'}
            </p>
          </div>
          {timesheetRecords.length > 0 && (
            <button type="button" className="saved-records__clear" onClick={handleClearTimesheetRecords}>
              Clear all
            </button>
          )}
        </div>

        {cloudLoadWarning && (
          <p className="backup-warning" role="alert">
            {cloudLoadWarning}
          </p>
        )}

        {timesheetRecords.length === 0 ? (
          <p className="saved-records__empty">
            No saved timesheet records yet. Submit a completed record to save one here.
          </p>
        ) : (
          <ul className="saved-records__list">
            {timesheetRecords.map((record) => (
              <li key={record.id} data-record-id={record.id} className="saved-record">
                <div className="saved-record__header">
                  <span className="type-badge type-badge--small">{record.formTypeLabel}</span>
                  <p className="saved-record__title">{getRecordTitle(record)}</p>
                </div>
                <dl className="saved-record__details">
                  <SummaryRow label="Employee" value={record.fields.employeeName} />
                  <SummaryRow label="Job" value={record.fields.jobProjectName} />
                  <SummaryRow label="Site" value={record.fields.siteLocation} />
                  <SummaryRow label="Date" value={record.fields.date} />
                  <SummaryRow label="Labour hours" value={record.fields.totalHoursWorked} />
                  <SummaryRow
                    label="Chargeable"
                    value={formatDecimalHoursDisplay(record.fields.chargeableHours)}
                  />
                  <SummaryRow label="Docket" value={record.fields.docketNumber} />
                </dl>

                <SavedRecordSignature record={record} />

                <p className="saved-record__meta">
                  Saved {formatSubmittedAt(record.submittedAt)}
                  {record.storageSource === 'cloud' && ' · Cloud only'}
                  {record.storageSource === 'both' && ' · Device + cloud'}
                </p>
                <RecordActions record={record} onPrint={setPrintRecord} variant="saved" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
