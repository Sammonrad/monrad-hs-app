import { useEffect, useMemo, useRef, useState } from 'react'
import { FORM_TYPES } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { SignatureConfirmationField } from '../components/SignatureConfirmationField.jsx'
import { RecordDetails } from '../components/RecordDetails.jsx'
import { RecordActions } from '../components/RecordActions.jsx'
import { AdminArchiveAction } from '../components/AdminArchiveAction.jsx'
import { SavedRecordSignature } from '../components/SavedRecordSignature.jsx'
import { TimesheetCloudSyncBadge } from '../components/TimesheetCloudSyncBadge.jsx'
import { WeeklyPrintSummary } from '../components/WeeklyPrintSummary.jsx'
import { ConfirmModal } from '../components/common/ConfirmModal.jsx'
import { buildWeeklyPrintSheetForRecord } from '../utils/weeklyTimesheet.js'
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
  TimeField,
  SummaryRow,
} from '../components/FormFields.jsx'
import { useHighlightRecord } from '../hooks/useHighlightRecord.js'
import { useDefaultFormDate } from '../hooks/useDefaultFormDate.js'
import { createRecordId } from '../utils/ids.js'
import { formatSubmittedAt, formatDecimalHoursDisplay } from '../utils/formatting.js'
import { createEmptyDraft, getRecordTitle } from '../utils/records.js'
import { persistSavedRecords } from '../utils/storage/recordsStorage.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
import {
  deleteTimesheetRecord,
  fetchTimesheetRecords,
  getMergedTimesheetRecords,
  getUnavailableSyncStatus,
  isCloudSaveUnavailable,
  resolveRecordSyncStatus,
  saveTimesheetRecord,
  SYNC_STATUS,
  updateTimesheetRecord,
} from '../utils/storage/timesheetCloudStorage.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import { ARCHIVE_RECORD_TYPES } from '../utils/storage/archiveFilter.js'
import { matchesArchiveTarget } from '../utils/storage/archiveActions.js'
import {
  calculateLabourHours,
  calculateAutoChargeableHours,
  parseDecimalHours,
} from '../utils/time.js'
import {
  scrollToFirstInvalid,
  hasValidationErrors,
  getValidationSummary,
} from '../utils/formValidation.js'

function isOwnTimesheetRecord(record, user) {
  if (!user?.id || !record) return false
  if (record.cloudUserId) return record.cloudUserId === user.id
  // Local-only / not yet attributed in cloud — device copy belongs to current user
  return true
}

function matchesTimesheetIdentity(item, record) {
  if (!item || !record) return false
  if (record.cloudId && item.cloudId === record.cloudId) return true
  if (record.id && item.id === record.id) return true
  return false
}

export function TimesheetView({
  onBack,
  savedRecords,
  setSavedRecords,
  highlightRecordId,
  onClearHighlight,
  settings,
  user,
  profile,
  cloudTimesheets,
  setCloudTimesheets,
}) {
  const formConfig = FORM_TYPES.timesheet
  const [draft, setDraft] = useState(() => createEmptyDraft('timesheet'))
  useDefaultFormDate(setDraft)
  const [completedRecord, setCompletedRecord] = useState(null)
  const [editingRecord, setEditingRecord] = useState(null)
  const [viewingRecordId, setViewingRecordId] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [completedSyncStatus, setCompletedSyncStatus] = useState(null)
  const [completedCloudError, setCompletedCloudError] = useState('')
  const [formStatusMessage, setFormStatusMessage] = useState('')
  const [formStatusError, setFormStatusError] = useState('')
  const [cloudLoadWarning, setCloudLoadWarning] = useState(null)
  const [cloudSaving, setCloudSaving] = useState(false)
  const [chargeableEdited, setChargeableEdited] = useState(false)
  const [archiveMessage, setArchiveMessage] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [printPayload, setPrintPayload] = useState(null)
  const recordRef = useRef(null)
  const formRef = useRef(null)

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
    (record) => resolveRecordSyncStatus(record) === SYNC_STATUS.CLOUD,
  ).length
  const isAdmin = isAdminProfile(profile)

  function handleRecordArchived(archived, { localOnly } = {}) {
    setSavedRecords((prev) => {
      const next = prev.map((item) =>
        matchesArchiveTarget(item, archived) ? { ...item, archived: true } : item,
      )
      persistSavedRecords(next)
      return next
    })
    setCloudTimesheets((prev) =>
      prev.map((item) => (matchesArchiveTarget(item, archived) ? { ...item, archived: true } : item)),
    )
    setCompletedRecord((prev) => (matchesArchiveTarget(prev, archived) ? null : prev))
    setArchiveMessage(
      localOnly
        ? 'Record archived on this device (Local). Find it under Archived Records.'
        : 'Record archived. Find it under Archived Records.',
    )
  }

  function patchSavedTimesheetRecord(recordId, patch) {
    setSavedRecords((prev) => {
      const next = prev.map((item) => (item.id === recordId ? { ...item, ...patch } : item))
      persistSavedRecords(next)
      return next
    })
    setCompletedRecord((prev) => (prev?.id === recordId ? { ...prev, ...patch } : prev))
    setEditingRecord((prev) => (prev?.id === recordId ? { ...prev, ...patch } : prev))
  }

  function upsertLocalTimesheet(record) {
    setSavedRecords((prev) => {
      const without = prev.filter((item) => !matchesTimesheetIdentity(item, record))
      const next = [record, ...without]
      persistSavedRecords(next)
      return next
    })
  }

  function removeLocalAndCloudTimesheet(record) {
    setSavedRecords((prev) => {
      const next = prev.filter((item) => !matchesTimesheetIdentity(item, record))
      persistSavedRecords(next)
      return next
    })
    setCloudTimesheets((prev) => prev.filter((item) => !matchesTimesheetIdentity(item, record)))
    setCompletedRecord((prev) => (matchesTimesheetIdentity(prev, record) ? null : prev))
    setEditingRecord((prev) => (matchesTimesheetIdentity(prev, record) ? null : prev))
    setViewingRecordId((prev) => (prev === record.id ? null : prev))
  }

  useEffect(() => {
    if (!user?.id) {
      setCloudLoadWarning(null)
      return undefined
    }

    let isMounted = true

    async function loadCloudTimesheets() {
      const { records, error } = await fetchTimesheetRecords(user.id, { isAdmin })
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
  }, [user?.id, isAdmin, setCloudTimesheets])

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
    setFieldErrors((prev) => ({ ...prev, [field]: undefined, labourTime: undefined }))
    if (field === 'startTime' || field === 'finishTime' || field === 'breakMinutes' || field === 'nonChargeableHours') {
      setChargeableEdited(false)
    }
    updateDraft({ fields: { ...fields, [field]: value } })
  }

  function handleChargeableChange(value) {
    setFieldErrors((prev) => ({ ...prev, chargeableHours: undefined }))
    setChargeableEdited(true)
    updateDraft({ fields: { ...fields, chargeableHours: value } })
  }

  function validateForm() {
    const errors = {}
    if (!fields.date.trim()) errors.date = 'Date is required.'
    if (!fields.employeeName.trim()) errors.employeeName = 'Employee / operator is required.'
    if (!fields.jobProjectName.trim()) errors.jobProjectName = 'Job / project is required.'
    if (!fields.siteLocation.trim()) errors.siteLocation = 'Site location is required.'
    if (!fields.startTime) errors.startTime = 'Start time is required.'
    if (!fields.finishTime) errors.finishTime = 'Finish time is required.'
    if (!fields.workCompleted.trim()) errors.workCompleted = 'Work completed is required.'
    if (!signatureConfirmation.trim()) {
      errors.signatureConfirmation = 'Signature / name confirmation is required.'
    }
    if (labourCalc.invalid) {
      errors.labourTime = 'Finish time must be after start time on the same day.'
    }
    const nonChargeable = parseDecimalHours(fields.nonChargeableHours)
    if (nonChargeable > 0 && !fields.nonChargeableReason.trim()) {
      errors.nonChargeableReason = 'Reason for non-chargeable time is required.'
    }
    return errors
  }

  function buildTimesheetFieldsFromDraft() {
    const chargeableHours =
      chargeableEdited && fields.chargeableHours.trim()
        ? fields.chargeableHours.trim()
        : autoChargeableHours

    return {
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
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (cloudSaving || deleting) return

    const errors = validateForm()
    if (hasValidationErrors(errors)) {
      setFieldErrors(errors)
      scrollToFirstInvalid(errors)
      return
    }

    setFieldErrors({})
    setFormStatusMessage('')
    setFormStatusError('')
    setCompletedCloudError('')

    const nextFields = buildTimesheetFieldsFromDraft()
    const isEditing = Boolean(editingRecord)

    if (isEditing) {
      if (!isOwnTimesheetRecord(editingRecord, user)) {
        setFormStatusError('You can only edit your own timesheets.')
        return
      }

      const updatedRecord = {
        ...editingRecord,
        formType: 'timesheet',
        formTypeLabel: formConfig.title,
        fields: nextFields,
        completedItems: editingRecord.completedItems ?? [],
        completedCount: editingRecord.completedCount ?? 0,
        totalCount: editingRecord.totalCount ?? 0,
        allComplete: true,
        signatureConfirmation: signatureConfirmation.trim(),
        photos: editingRecord.photos ?? [],
        // Preserve original submittedAt / owner metadata
        submittedAt: editingRecord.submittedAt,
        cloudId: editingRecord.cloudId ?? null,
        cloudUserId: editingRecord.cloudUserId ?? null,
      }

      upsertLocalTimesheet(updatedRecord)
      setCompletedRecord(updatedRecord)
      setCompletedSyncStatus(null)

      if (!updatedRecord.cloudId) {
        if (isCloudSaveUnavailable(user)) {
          const syncStatus = getUnavailableSyncStatus(user)
          patchSavedTimesheetRecord(updatedRecord.id, { syncStatus })
          setCompletedSyncStatus(syncStatus)
          setFormStatusMessage('Timesheet updated on this device.')
          setEditingRecord(null)
          return
        }

        setCloudSaving(true)
        const { record: cloudRecord, error } = await saveTimesheetRecord(user, updatedRecord)
        setCloudSaving(false)

        if (error) {
          patchSavedTimesheetRecord(updatedRecord.id, { syncStatus: SYNC_STATUS.CLOUD_FAILED })
          setCompletedSyncStatus(SYNC_STATUS.CLOUD_FAILED)
          setFormStatusError(error.message || 'Could not save updated timesheet to the cloud.')
          return
        }

        const cloudPatch = {
          syncStatus: SYNC_STATUS.CLOUD,
          cloudId: cloudRecord?.cloudId ?? null,
          cloudUserId: cloudRecord?.cloudUserId ?? user.id,
        }
        patchSavedTimesheetRecord(updatedRecord.id, cloudPatch)
        setCompletedSyncStatus(SYNC_STATUS.CLOUD)
        setFormStatusMessage('Timesheet updated.')
        setEditingRecord(null)
        if (cloudRecord) {
          setCloudTimesheets((prev) => {
            const withoutDup = prev.filter(
              (item) =>
                !matchesTimesheetIdentity(item, cloudRecord) &&
                !matchesTimesheetIdentity(item, updatedRecord),
            )
            return [cloudRecord, ...withoutDup]
          })
        }
        return
      }

      if (isCloudSaveUnavailable(user)) {
        const syncStatus = getUnavailableSyncStatus(user)
        patchSavedTimesheetRecord(updatedRecord.id, { syncStatus })
        setCompletedSyncStatus(syncStatus)
        setFormStatusMessage('Timesheet updated on this device. Cloud sync unavailable.')
        setEditingRecord(null)
        return
      }

      setCloudSaving(true)
      const { record: cloudRecord, error } = await updateTimesheetRecord(user, updatedRecord)
      setCloudSaving(false)

      if (error) {
        patchSavedTimesheetRecord(updatedRecord.id, { syncStatus: SYNC_STATUS.CLOUD_FAILED })
        setCompletedSyncStatus(SYNC_STATUS.CLOUD_FAILED)
        setFormStatusError(error.message || 'Could not update timesheet in the cloud.')
        return
      }

      const merged = {
        ...updatedRecord,
        ...(cloudRecord ?? {}),
        id: updatedRecord.id,
        cloudId: cloudRecord?.cloudId ?? updatedRecord.cloudId,
        cloudUserId: cloudRecord?.cloudUserId ?? updatedRecord.cloudUserId,
        submittedAt: updatedRecord.submittedAt,
        syncStatus: SYNC_STATUS.CLOUD,
        storageSource: 'both',
      }
      upsertLocalTimesheet(merged)
      setCompletedRecord(merged)
      setCompletedSyncStatus(SYNC_STATUS.CLOUD)
      setFormStatusMessage('Timesheet updated.')
      setFormStatusError('')
      setEditingRecord(null)
      if (cloudRecord) {
        setCloudTimesheets((prev) => {
          const withoutDup = prev.filter(
            (item) =>
              !matchesTimesheetIdentity(item, cloudRecord) &&
              !matchesTimesheetIdentity(item, updatedRecord),
          )
          return [merged, ...withoutDup]
        })
      }
      return
    }

    const submittedAt = new Date().toISOString()
    const record = {
      id: createRecordId(),
      formType: 'timesheet',
      formTypeLabel: formConfig.title,
      fields: nextFields,
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
    setCompletedSyncStatus(null)
    setCompletedCloudError('')
    setFormStatusMessage('')
    setFormStatusError('')

    if (isCloudSaveUnavailable(user)) {
      const syncStatus = getUnavailableSyncStatus(user)
      patchSavedTimesheetRecord(record.id, { syncStatus })
      setCompletedSyncStatus(syncStatus)
      return
    }

    setCloudSaving(true)
    const { record: cloudRecord, error } = await saveTimesheetRecord(user, record)
    setCloudSaving(false)

    if (error) {
      patchSavedTimesheetRecord(record.id, { syncStatus: SYNC_STATUS.CLOUD_FAILED })
      setCompletedSyncStatus(SYNC_STATUS.CLOUD_FAILED)
      setCompletedCloudError(error.message)
      return
    }

    const cloudPatch = {
      syncStatus: SYNC_STATUS.CLOUD,
      cloudId: cloudRecord?.cloudId ?? null,
      cloudUserId: cloudRecord?.cloudUserId ?? user?.id ?? null,
    }
    patchSavedTimesheetRecord(record.id, cloudPatch)
    setCompletedSyncStatus(SYNC_STATUS.CLOUD)
    setCompletedCloudError('')

    if (cloudRecord) {
      setCloudTimesheets((prev) => {
        const withoutDup = prev.filter(
          (item) => item.cloudId !== cloudRecord.cloudId && item.id !== record.id,
        )
        return [cloudRecord, ...withoutDup]
      })
    }
  }

  function handleStartEdit(record) {
    if (!isOwnTimesheetRecord(record, user) || cloudSaving || deleting) return

    setEditingRecord(record)
    setViewingRecordId(null)
    setCompletedRecord(null)
    setFieldErrors({})
    setFormStatusMessage('')
    setFormStatusError('')
    setCompletedSyncStatus(null)
    setCompletedCloudError('')
    setChargeableEdited(Boolean(record.fields?.chargeableHours?.trim()))
    setDraft({
      fields: {
        ...FORM_TYPES.timesheet.emptyFields,
        ...record.fields,
      },
      signatureConfirmation: record.signatureConfirmation ?? '',
      checked: new Set(),
      photos: record.photos ?? [],
    })

    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function handleCancelEdit() {
    if (cloudSaving) return
    setEditingRecord(null)
    setDraft(createEmptyDraft('timesheet'))
    setFieldErrors({})
    setChargeableEdited(false)
    setFormStatusMessage('')
    setFormStatusError('')
  }

  function handleToggleView(record) {
    setViewingRecordId((prev) => (prev === record.id ? null : record.id))
  }

  function openDeleteModal(record) {
    if (!isOwnTimesheetRecord(record, user) || deleting || cloudSaving) return
    setDeleteError('')
    setDeleteTarget(record)
  }

  function closeDeleteModal() {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteError('')
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleting) return
    if (!isOwnTimesheetRecord(deleteTarget, user)) {
      setDeleteError('You can only delete your own timesheets.')
      return
    }

    setDeleting(true)
    setDeleteError('')

    try {
      if (deleteTarget.cloudId) {
        if (isCloudSaveUnavailable(user)) {
          setDeleteError('Cloud delete unavailable. Sign in and check your connection, then try again.')
          setDeleting(false)
          return
        }

        const { ok, error } = await deleteTimesheetRecord(user, deleteTarget)
        if (!ok) {
          setDeleteError(
            error?.message
              || 'Could not permanently delete this timesheet from the cloud. The record was not removed.',
          )
          setDeleting(false)
          return
        }
      }

      removeLocalAndCloudTimesheet(deleteTarget)
      setArchiveMessage('')
      setFormStatusMessage('Timesheet permanently deleted.')
      setFormStatusError('')
      setDeleteTarget(null)
      setDeleteError('')

      if (editingRecord && matchesTimesheetIdentity(editingRecord, deleteTarget)) {
        setEditingRecord(null)
        setDraft(createEmptyDraft('timesheet'))
        setChargeableEdited(false)
      }
    } catch (error) {
      setDeleteError(
        error?.message
          || 'Could not permanently delete this timesheet. Please try again.',
      )
    } finally {
      setDeleting(false)
    }
  }

  function handleReset() {
    if (cloudSaving) return
    setDraft(createEmptyDraft('timesheet'))
    setCompletedRecord(null)
    setEditingRecord(null)
    setFieldErrors({})
    setCompletedSyncStatus(null)
    setCompletedCloudError('')
    setFormStatusMessage('')
    setFormStatusError('')
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

  function handlePrintTimesheet(record) {
    setPrintPayload({
      sheets: buildWeeklyPrintSheetForRecord(record, timesheetRecords),
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

      <FormPageHeader
        title={formConfig.title}
        subtitle={editingRecord ? 'Edit your timesheet record' : 'Daily work and hours record'}
      />

      <form ref={formRef} className="job-form no-print" onSubmit={handleSubmit} noValidate>
        {editingRecord && (
          <p className="form-hint" role="status">
            Editing a saved timesheet. Changes update the same record (owner and original save date are kept).
          </p>
        )}
        {formStatusMessage && (
          <p className="form-hint" role="status">
            {formStatusMessage}
          </p>
        )}
        {formStatusError && (
          <p className="validation-message validation-message--error" role="alert">
            {formStatusError}
          </p>
        )}
        <FormSection title="Date & Employee" id="timesheet-employee">
          <FormGrid>
            <FormField label="Date" fieldId="date" required error={fieldErrors.date}>
              <DateField label="" value={fields.date} onChange={updateField} />
            </FormField>
            <FormField label="Employee / operator name" fieldId="employeeName" required error={fieldErrors.employeeName}>
              <ComboField label="" field="employeeName" value={fields.employeeName} onChange={updateField} placeholder="Your name" options={comboOptions.operators} listId="timesheet-operators" />
            </FormField>
            <FormField label="Job / project name" fieldId="jobProjectName" required error={fieldErrors.jobProjectName}>
              <TextField label="" field="jobProjectName" value={fields.jobProjectName} onChange={updateField} placeholder="e.g. Driveway excavation" />
            </FormField>
            <FormField label="Site location" fieldId="siteLocation" required error={fieldErrors.siteLocation}>
              <ComboField label="" field="siteLocation" value={fields.siteLocation} onChange={updateField} placeholder="Address or site name" options={comboOptions.sites} listId="timesheet-sites" />
            </FormField>
            <TextField label="Customer / client name" field="customerName" value={fields.customerName} onChange={updateField} placeholder="Client or company name" />
            <ComboField label="Machine used" field="machineUsed" value={fields.machineUsed} onChange={updateField} placeholder="e.g. EX-01" options={comboOptions.machines} listId="timesheet-machines" />
          </FormGrid>
        </FormSection>

        <FormSection title="Hours" id="timesheet-hours">
          <FormGrid>
            <FormField label="Start time" fieldId="startTime" required error={fieldErrors.startTime}>
              <TimeField
                label=""
                field="startTime"
                value={fields.startTime}
                onChange={updateField}
                ariaLabel="Start time"
                required
              />
            </FormField>
            <FormField label="Finish time" fieldId="finishTime" required error={fieldErrors.finishTime}>
              <TimeField
                label=""
                field="finishTime"
                value={fields.finishTime}
                onChange={updateField}
                ariaLabel="Finish time"
                required
              />
            </FormField>
            <FormGridFull>
              <div className="timesheet-calc" aria-live="polite" data-field-id="labourTime">
                <span className="timesheet-calc__label">Total hours worked</span>
                <span className="timesheet-calc__value">
                  {labourCalc.invalid
                    ? '—'
                    : labourCalc.value || 'Enter start and finish times'}
                </span>
              </div>
              {fieldErrors.labourTime && <ValidationMessage message={fieldErrors.labourTime} />}
            </FormGridFull>
            <label className="field">
              <span className="field__label">Chargeable hours</span>
              <input
                type="text"
                inputMode="decimal"
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
              type="text"
            />
          </FormGrid>
        </FormSection>

        <FormSection title="Breaks" id="timesheet-breaks">
          <TextField
            label="Break time (minutes)"
            field="breakMinutes"
            value={fields.breakMinutes}
            onChange={updateField}
            placeholder="e.g. 30"
            type="number"
          />
          <FormField label="Reason for non-chargeable time" fieldId="nonChargeableReason" error={fieldErrors.nonChargeableReason}>
            <TextField label="" field="nonChargeableReason" value={fields.nonChargeableReason} onChange={updateField} placeholder="Required if non-chargeable hours entered" />
          </FormField>
        </FormSection>

        <FormSection title="Work" id="timesheet-work">
          <FormField label="Work completed" fieldId="workCompleted" required error={fieldErrors.workCompleted}>
            <textarea
              className="field__input field__textarea"
              value={fields.workCompleted}
              onChange={(e) => updateField('workCompleted', e.target.value)}
              placeholder="Describe work completed today..."
              rows={4}
            />
          </FormField>
          <TextField label="Materials used or delivered" field="materialsUsed" value={fields.materialsUsed} onChange={updateField} placeholder="Materials, quantities, deliveries..." />
          <TextField label="Docket / reference number" field="docketNumber" value={fields.docketNumber} onChange={updateField} placeholder="Docket or job reference" />
          <TextField label="Delays or issues" field="delaysOrIssues" value={fields.delaysOrIssues} onChange={updateField} placeholder="Any delays or issues encountered" />
          <TextField label="Safety issues or hazards noticed" field="safetyIssues" value={fields.safetyIssues} onChange={updateField} placeholder="Hazards or safety concerns" />
        </FormSection>

        <FormSection title="Notes" id="timesheet-notes">
          <NotesField value={fields.notes} onChange={updateField} />
        </FormSection>

        <FormSection title="Confirmation" id="timesheet-confirmation">
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
        </FormSection>

        <FormActions>
          {hasValidationErrors(fieldErrors) && (
            <ValidationMessage variant="summary" messages={getValidationSummary(fieldErrors)} />
          )}
          <p className="form-hint">
            {editingRecord
              ? 'Update the details below, then save your changes.'
              : 'Complete job and time details, then submit your daily work record.'}
          </p>
          <div className="timesheet-form-actions">
            <button type="submit" className="submit-btn" disabled={cloudSaving || deleting}>
              {cloudSaving ? 'Saving…' : editingRecord ? 'Save Changes' : 'Submit Record'}
            </button>
            {editingRecord && (
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleCancelEdit}
                disabled={cloudSaving || deleting}
              >
                Cancel edit
              </button>
            )}
          </div>
        </FormActions>
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
            Record saved to this device. Review the details below.
          </p>

          {cloudSaving ? (
            <p className="cloud-sync-status cloud-sync-status--pending" role="status">
              Syncing to cloud…
            </p>
          ) : (
            completedSyncStatus && (
              <>
                <TimesheetCloudSyncBadge syncStatus={completedSyncStatus} className="cloud-sync-status--block" />
                {completedCloudError && (
                  <p className="validation-message validation-message--error" role="alert">
                    {completedCloudError}
                  </p>
                )}
              </>
            )
          )}

          <RecordDetails record={completedRecord} />
          <RecordActions record={completedRecord} onPrint={handlePrintTimesheet} />
          <div className="record__actions record__actions--saved no-print">
            <AdminArchiveAction
              recordType={ARCHIVE_RECORD_TYPES.TIMESHEET}
              record={completedRecord}
              user={user}
              profile={profile}
              onArchived={handleRecordArchived}
            />
          </div>
        </section>
      )}

      <button type="button" className="reset-btn no-print" onClick={handleReset}>
        Reset form
      </button>
      {completedRecord && (
        <p className="reset-hint no-print">Clears the current form and record view.</p>
      )}

      <section className="saved-records no-print" aria-labelledby="timesheet-saved-heading">
        {archiveMessage && (
          <p className="form-hint" role="status">
            {archiveMessage}
          </p>
        )}
        <div className="saved-records__header">
          <div>
            <h2 id="timesheet-saved-heading" className="saved-records__title">
              Saved timesheet records
            </h2>
            <p className="saved-records__count">
              {timesheetRecords.length} record{timesheetRecords.length === 1 ? '' : 's'}
              {user?.id && cloudRecordCount > 0
                ? isAdmin
                  ? ` (${cloudRecordCount} from cloud — all users)`
                  : ` (${cloudRecordCount} synced from cloud)`
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

        {isAdmin && user?.id && (
          <p className="form-hint">
            Admin view: device records on this device plus all users&apos; cloud timesheets.
          </p>
        )}

        {timesheetRecords.length === 0 ? (
          <p className="saved-records__empty">
            No saved timesheet records yet. Submit a completed record to save one here.
          </p>
        ) : (
          <ul className="saved-records__list">
            {timesheetRecords.map((record) => {
              const isOtherUserCloudRecord =
                isAdmin &&
                record.cloudUserId &&
                record.cloudUserId !== user?.id &&
                resolveRecordSyncStatus(record) === SYNC_STATUS.CLOUD
              const isOwn = isOwnTimesheetRecord(record, user)
              const isViewing = viewingRecordId === record.id
              const isEditingThis = editingRecord && matchesTimesheetIdentity(editingRecord, record)

              return (
              <li key={record.id} data-record-id={record.id} className="saved-record">
                <div className="saved-record__header">
                  <div className="saved-record__badges">
                    <span className="type-badge type-badge--small">{record.formTypeLabel}</span>
                    <TimesheetCloudSyncBadge record={record} size="small" />
                    {isOtherUserCloudRecord && (
                      <span className="type-badge type-badge--small type-badge--cloud-user">
                        {record.fields?.employeeName?.trim() || 'Other user'}
                      </span>
                    )}
                    {isEditingThis && (
                      <span className="type-badge type-badge--small">Editing</span>
                    )}
                  </div>
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
                </p>

                {isOwn && (
                  <div className="saved-record__manage no-print">
                    <button
                      type="button"
                      className="btn btn--secondary saved-record__manage-btn"
                      onClick={() => handleToggleView(record)}
                      disabled={deleting || cloudSaving}
                    >
                      {isViewing ? 'Hide' : 'View'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary saved-record__manage-btn"
                      onClick={() => handleStartEdit(record)}
                      disabled={deleting || cloudSaving || isEditingThis}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary btn--danger-text saved-record__manage-btn"
                      onClick={() => openDeleteModal(record)}
                      disabled={deleting || cloudSaving}
                    >
                      Delete
                    </button>
                  </div>
                )}

                {isViewing && (
                  <div className="saved-record__view no-print">
                    <RecordDetails record={record} />
                  </div>
                )}

                <RecordActions record={record} onPrint={handlePrintTimesheet} variant="saved" />
                <div className="record__actions record__actions--saved no-print">
                  <AdminArchiveAction
                    recordType={ARCHIVE_RECORD_TYPES.TIMESHEET}
                    record={record}
                    user={user}
                    profile={profile}
                    onArchived={handleRecordArchived}
                  />
                </div>
              </li>
            )})}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete timesheet?"
        message="Permanently delete this timesheet? This cannot be undone and the record will also be removed from the admin view."
        confirmLabel="Permanently Delete"
        cancelLabel="Cancel"
        processingLabel="Deleting…"
        processing={deleting}
        variant="danger"
        error={deleteError}
        onCancel={closeDeleteModal}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
