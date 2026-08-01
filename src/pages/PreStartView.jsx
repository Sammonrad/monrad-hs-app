import { useEffect, useMemo, useRef, useState } from 'react'
import { FORM_TYPES, MAX_PHOTOS } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { SignatureConfirmationField } from '../components/SignatureConfirmationField.jsx'
import { PhotoUpload } from '../components/PhotoUpload.jsx'
import { DefectWarning } from '../components/DefectWarning.jsx'
import { RecordDetails } from '../components/RecordDetails.jsx'
import { RecordActions } from '../components/RecordActions.jsx'
import { AdminArchiveAction } from '../components/AdminArchiveAction.jsx'
import { SavedRecordSignature } from '../components/SavedRecordSignature.jsx'
import { CloudSyncBadge } from '../components/CloudSyncBadge.jsx'
import { FormSection } from '../components/forms/FormSection.jsx'
import { FormField } from '../components/forms/FormField.jsx'
import { FormActions } from '../components/forms/FormActions.jsx'
import { FormGrid, FormGridFull } from '../components/layout/FormGrid.jsx'
import { FormPageHeader } from '../components/forms/FormPageHeader.jsx'
import { SegmentedChoice } from '../components/forms/SegmentedChoice.jsx'
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
import {
  formatSubmittedAt,
  formatDefectsFound,
  formatDefectSeverity,
  formatMachineOperable,
} from '../utils/formatting.js'
import { isSeriousDefect } from '../utils/defects.js'
import { createEmptyDraft, getRecordTitle } from '../utils/records.js'
import { persistSavedRecords } from '../utils/storage/recordsStorage.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
import {
  fetchPreStartRecords,
  getMergedPreStartRecords,
  getUnavailableSyncStatus,
  isCloudSaveUnavailable,
  resolveRecordSyncStatus,
  savePreStartRecord,
  SYNC_STATUS,
} from '../utils/storage/preStartCloudStorage.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import { ARCHIVE_RECORD_TYPES } from '../utils/storage/archiveFilter.js'
import { matchesArchiveTarget } from '../utils/storage/archiveActions.js'
import { getEquipmentReadableName, isPreStartSelectable } from '../constants/equipmentConfig.js'
import { getEquipmentByReadableName } from '../utils/storage/equipmentCloudStorage.js'
import { getMergedDefectRecords, findDefectBySource } from '../utils/storage/equipmentDefectStorage.js'
import { getPreStartEquipmentWarnings } from '../utils/equipmentStats.js'
import { EquipmentSelector } from '../components/equipment/EquipmentSelector.jsx'
import {
  scrollToFirstInvalid,
  hasValidationErrors,
  getValidationSummary,
} from '../utils/formValidation.js'

export function PreStartView({
  onBack,
  onNavigate,
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
  cloudPreStarts,
  setCloudPreStarts,
  equipment = [],
  defectRecords = [],
  localDefectRecords = [],
}) {
  const formConfig = FORM_TYPES['pre-start']
  const [draft, setDraft] = useState(() => createEmptyDraft('pre-start'))
  useDefaultFormDate(setDraft)
  const [completedRecord, setCompletedRecord] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [completedSyncStatus, setCompletedSyncStatus] = useState(null)
  const [completedCloudError, setCompletedCloudError] = useState('')
  const [cloudLoadWarning, setCloudLoadWarning] = useState(null)
  const [cloudSaving, setCloudSaving] = useState(false)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('')
  const [preSubmitWarnings, setPreSubmitWarnings] = useState([])
  const [preSubmitAcknowledged, setPreSubmitAcknowledged] = useState(false)
  const [archiveMessage, setArchiveMessage] = useState('')
  const recordRef = useRef(null)

  const {
    fields,
    checked,
    signatureConfirmation,
    photos,
    defectsFound,
    defectDescription,
    defectSeverity,
    machineOperableSafely,
    actionRequired,
    reportedTo,
    defectPhotos,
  } = draft
  const comboOptions = getSettingsOptions(settings)
  const checklist = formConfig.checklist
  const total = checklist.length
  const completed = checked.size
  const allComplete = completed === total
  const defectsSelected = defectsFound === 'found'
  const showDefectWarning =
    defectsSelected &&
    (defectSeverity === 'critical' || machineOperableSafely === 'no')

  const isAdmin = isAdminProfile(profile)

  const preStartRecords = useMemo(
    () => getMergedPreStartRecords(savedRecords, cloudPreStarts),
    [savedRecords, cloudPreStarts],
  )

  function handleRecordArchived(archived, { localOnly } = {}) {
    setSavedRecords((prev) => {
      const next = prev.map((item) =>
        matchesArchiveTarget(item, archived) ? { ...item, archived: true } : item,
      )
      persistSavedRecords(next)
      return next
    })
    setCloudPreStarts((prev) =>
      prev.map((item) => (matchesArchiveTarget(item, archived) ? { ...item, archived: true } : item)),
    )
    setCompletedRecord((prev) => (matchesArchiveTarget(prev, archived) ? null : prev))
    setArchiveMessage(
      localOnly
        ? 'Record archived on this device (Local). Find it under Archived Records.'
        : 'Record archived. Find it under Archived Records.',
    )
  }

  const preStartEquipment = useMemo(
    () => equipment.filter(isPreStartSelectable),
    [equipment],
  )

  const mergedDefects = useMemo(
    () => getMergedDefectRecords(localDefectRecords, defectRecords),
    [localDefectRecords, defectRecords],
  )

  const selectedEquipment = useMemo(() => {
    if (selectedEquipmentId) {
      return equipment.find((item) => (item.cloudId ?? item.id) === selectedEquipmentId) ?? null
    }
    return getEquipmentByReadableName(equipment, fields.machineNameId)
  }, [equipment, selectedEquipmentId, fields.machineNameId])

  const activePreSubmitWarnings = useMemo(() => {
    if (!selectedEquipment) return []
    return getPreStartEquipmentWarnings(selectedEquipment, mergedDefects)
  }, [selectedEquipment, mergedDefects])

  function handleEquipmentSelect(equipmentId) {
    setSelectedEquipmentId(equipmentId)
    setPreSubmitAcknowledged(false)
    const item = equipment.find((e) => (e.cloudId ?? e.id) === equipmentId)
    if (item) {
      updateField('machineNameId', getEquipmentReadableName(item))
    }
  }

  function handleManualMachineChange(value) {
    setSelectedEquipmentId('')
    setPreSubmitAcknowledged(false)
    updateField('machineNameId', value)
  }

  const cloudPreStartCount = preStartRecords.filter(
    (record) => resolveRecordSyncStatus(record) === SYNC_STATUS.CLOUD,
  ).length

  function mapPreStartSeverityToEquipment(severity) {
    const map = { low: 'Minor', medium: 'Major', high: 'Major', critical: 'Critical' }
    return map[severity] ?? 'Minor'
  }

  function handleCreateEquipmentDefect(record) {
    const existing = findDefectBySource(mergedDefects, 'Machine Pre-Start', record.cloudId ?? record.id)
    if (existing) {
      window.alert('An equipment defect has already been created from this pre-start record.')
      return
    }
    const confirmed = window.confirm('Create an equipment defect from this pre-start record?')
    if (!confirmed) return

    const matchedEquipment = getEquipmentByReadableName(equipment, record.fields?.machineNameId)
    onNavigate?.('machines-equipment', {
      equipmentTab: 'defects',
      defectPrefill: {
        equipmentId: matchedEquipment?.cloudId ?? '',
        equipmentName: record.fields?.machineNameId ?? '',
        description: record.defectDescription ?? '',
        severity: mapPreStartSeverityToEquipment(record.defectSeverity),
        immediateAction: record.actionRequired ?? '',
        safeToOperate: record.machineOperableSafely !== 'no',
        sourceType: 'Machine Pre-Start',
        sourceRecordId: record.cloudId ?? record.id,
        reportedByName: record.fields?.operatorName ?? profile?.full_name?.trim() ?? '',
      },
    })
  }

  function patchSavedPreStartRecord(recordId, patch) {
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

    async function loadCloudPreStarts() {
      const { records, error } = await fetchPreStartRecords(user.id, { isAdmin })
      if (!isMounted) return

      if (error) {
        setCloudLoadWarning(
          `Could not load cloud pre-start records: ${error.message}. Showing device records only.`,
        )
        return
      }

      setCloudLoadWarning(null)
      setCloudPreStarts(records)
    }

    loadCloudPreStarts()

    return () => {
      isMounted = false
    }
  }, [user?.id, isAdmin, setCloudPreStarts])

  useHighlightRecord(highlightRecordId, onClearHighlight, [preStartRecords])

  useEffect(() => {
    if (recordFocus !== 'defects') return undefined
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
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    updateDraft({ fields: { ...fields, [field]: value } })
  }

  function validateForm() {
    const errors = {}
    if (!fields.operatorName.trim()) {
      errors.operatorName = 'Operator name is required.'
    }
    if (!fields.machineNameId.trim()) {
      errors.machineNameId = 'Machine name / ID is required.'
    }
    if (!signatureConfirmation.trim()) {
      errors.signatureConfirmation = 'Signature / name confirmation is required.'
    }
    if (defectsSelected) {
      if (!defectDescription.trim()) {
        errors.defectDescription = 'Defect description is required when defects are found.'
      }
      if (!defectSeverity) {
        errors.defectSeverity = 'Defect severity is required when defects are found.'
      }
      if (!machineOperableSafely) {
        errors.machineOperableSafely =
          'Please indicate whether the machine can still be operated safely.'
      }
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

    const warnings = activePreSubmitWarnings
    if (warnings.length > 0 && !preSubmitAcknowledged) {
      setPreSubmitWarnings(warnings)
      return
    }
    setPreSubmitWarnings([])

    setFieldErrors({})
    const completedItems = checklist.filter((_, index) => checked.has(index))
    const submittedAt = new Date().toISOString()
    const record = {
      id: createRecordId(),
      formType: 'pre-start',
      formTypeLabel: formConfig.title,
      fields: { ...fields },
      completedItems,
      completedCount: completed,
      totalCount: total,
      allComplete,
      signatureConfirmation: signatureConfirmation.trim(),
      photos,
      defectsFound,
      submittedAt,
      ...(defectsSelected
        ? {
            defectDescription: defectDescription.trim(),
            defectSeverity,
            machineOperableSafely,
            actionRequired: actionRequired.trim(),
            reportedTo: reportedTo.trim(),
            defectPhotos,
          }
        : {}),
    }

    const nextRecords = [record, ...savedRecords]
    if (!persistSavedRecords(nextRecords)) return
    setSavedRecords(nextRecords)
    setCompletedRecord(record)
    setCompletedSyncStatus(null)
    setCompletedCloudError('')
    onRecordSaved?.(record)

    if (isCloudSaveUnavailable(user)) {
      const syncStatus = getUnavailableSyncStatus(user)
      patchSavedPreStartRecord(record.id, { syncStatus })
      setCompletedSyncStatus(syncStatus)
      return
    }

    setCloudSaving(true)
    const { record: cloudRecord, error } = await savePreStartRecord(user, record)
    setCloudSaving(false)

    if (error) {
      patchSavedPreStartRecord(record.id, { syncStatus: SYNC_STATUS.CLOUD_FAILED })
      setCompletedSyncStatus(SYNC_STATUS.CLOUD_FAILED)
      setCompletedCloudError(error.message)
      return
    }

    const cloudPatch = {
      syncStatus: SYNC_STATUS.CLOUD,
      cloudId: cloudRecord?.cloudId ?? null,
    }
    patchSavedPreStartRecord(record.id, cloudPatch)
    setCompletedSyncStatus(SYNC_STATUS.CLOUD)
    setCompletedCloudError('')

    if (cloudRecord) {
      setCloudPreStarts((prev) => {
        const withoutDup = prev.filter(
          (item) => item.cloudId !== cloudRecord.cloudId && item.id !== record.id,
        )
        return [cloudRecord, ...withoutDup]
      })
    }
  }

  function handleReset() {
    setDraft(createEmptyDraft('pre-start'))
    setCompletedRecord(null)
    setFieldErrors({})
    setCompletedSyncStatus(null)
  }

  function handleClearPreStartRecords() {
    if (preStartRecords.length === 0) return
    const confirmed = window.confirm(
      'Delete all saved pre-start records? Other saved records will be kept.',
    )
    if (!confirmed) return
    setSavedRecords((prev) => {
      const next = prev.filter((record) => record.formType !== 'pre-start')
      return persistSavedRecords(next) ? next : prev
    })
    if (completedRecord) setCompletedRecord(null)
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <FormPageHeader
        title={formConfig.title}
        subtitle="Check machine condition before operating"
        progress={`${completed} of ${total} completed`}
      />

      <form className="job-form no-print" onSubmit={handleSubmit} noValidate>
        <FormSection title="People and Equipment" id="prestart-details">
          <FormGrid>
            <DateField value={fields.date} onChange={updateField} />
            <FormField label="Operator name" fieldId="operatorName" required error={fieldErrors.operatorName}>
              <ComboField label="" field="operatorName" value={fields.operatorName} onChange={updateField} placeholder="Your name" options={comboOptions.operators} listId="pre-start-operators" />
            </FormField>
            <FormField label="Machine name / ID" fieldId="machineNameId" required error={fieldErrors.machineNameId}>
              {preStartEquipment.length > 0 && (
                <div className="prestart-equipment-select">
                  <EquipmentSelector
                    equipment={equipment}
                    value={selectedEquipmentId}
                    onChange={handleEquipmentSelect}
                    preStartOnly
                    includeManual={false}
                    placeholder="Select from register"
                    id="prestart-equipment"
                  />
                </div>
              )}
              <ComboField label="" field="machineNameId" value={fields.machineNameId} onChange={(_, value) => handleManualMachineChange(value)} placeholder="e.g. EX-01 or 5T excavator" options={[...comboOptions.machines, ...preStartEquipment.map(getEquipmentReadableName)]} listId="pre-start-machines" />
            </FormField>
            <TextField label="Machine hours" field="machineHours" value={fields.machineHours} onChange={updateField} placeholder="Current hour meter reading" />
            <ComboField label="Site / job location" field="siteLocation" value={fields.siteLocation} onChange={updateField} placeholder="Site or yard" options={comboOptions.sites} listId="pre-start-sites" />
            <FormGridFull>
              <NotesField value={fields.notes} onChange={updateField} />
            </FormGridFull>
          </FormGrid>
        </FormSection>

        <FormSection title="Pre-Start Checklist" id="prestart-checklist">
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

        <FormSection
          title="Defect Reporting"
          id="defect-reporting"
          variant={showDefectWarning ? 'defect-fail' : undefined}
          description="Report any defects found during the pre-start inspection."
        >
          <SegmentedChoice
            label="Any defects found?"
            name="defectsFound"
            fieldId="defectsFound"
            value={defectsFound}
            onChange={(value) => {
              setFieldErrors((prev) => ({
                ...prev,
                defectDescription: undefined,
                defectSeverity: undefined,
                machineOperableSafely: undefined,
              }))
              if (value === 'none') {
                updateDraft({
                  defectsFound: value,
                  defectDescription: '',
                  defectSeverity: '',
                  machineOperableSafely: '',
                  actionRequired: '',
                  reportedTo: '',
                  defectPhotos: [],
                })
              } else {
                updateDraft({ defectsFound: value })
              }
            }}
            options={[
              { value: 'none', label: 'No defects' },
              { value: 'found', label: 'Defects found' },
            ]}
          />

          {defectsSelected && (
            <div className="defect-section__details">
              <FormField
                label="Defect description"
                fieldId="defectDescription"
                required
                error={fieldErrors.defectDescription}
              >
                <textarea
                  className="field__input field__textarea"
                  value={defectDescription}
                  onChange={(e) => {
                    setFieldErrors((prev) => ({ ...prev, defectDescription: undefined }))
                    updateDraft({ defectDescription: e.target.value })
                  }}
                  placeholder="Describe the defect..."
                  rows={4}
                />
              </FormField>

              <FormField label="Severity" fieldId="defectSeverity" required error={fieldErrors.defectSeverity}>
                <SelectField
                  label=""
                  field="defectSeverity"
                  value={defectSeverity}
                  onChange={(_, value) => {
                    setFieldErrors((prev) => ({ ...prev, defectSeverity: undefined }))
                    updateDraft({ defectSeverity: value })
                  }}
                  options={[
                    { value: '', label: 'Select severity...' },
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'critical', label: 'Critical' },
                  ]}
                />
              </FormField>

              <SegmentedChoice
                label="Can the machine still be operated safely?"
                name="machineOperableSafely"
                fieldId="machineOperableSafely"
                required
                value={machineOperableSafely}
                error={fieldErrors.machineOperableSafely}
                onChange={(value) => {
                  setFieldErrors((prev) => ({ ...prev, machineOperableSafely: undefined }))
                  updateDraft({ machineOperableSafely: value })
                }}
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                ]}
              />

              <TextField
                label="Action required"
                field="actionRequired"
                value={actionRequired}
                onChange={(_, value) => updateDraft({ actionRequired: value })}
                placeholder="What action is needed?"
              />
              <TextField
                label="Reported to"
                field="reportedTo"
                value={reportedTo}
                onChange={(_, value) => updateDraft({ reportedTo: value })}
                placeholder="Supervisor or manager name"
              />

              <PhotoUpload
                label={`Defect photos (max ${MAX_PHOTOS})`}
                photos={defectPhotos}
                onChange={(value) => updateDraft({ defectPhotos: value })}
              />

              {showDefectWarning && <DefectWarning />}
            </div>
          )}
        </FormSection>

        <FormSection title="Confirmation & Photos" id="prestart-confirmation">
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

        {allComplete && !showDefectWarning && (
          <p className="complete-message" role="status">
            Pre-start complete. Machine safe to operate.
          </p>
        )}

        {preSubmitWarnings.length > 0 && (
          <div className="equipment-prestart-warning" role="alert">
            <p><strong>Equipment warning — review before submitting:</strong></p>
            <ul>
              {preSubmitWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setPreSubmitAcknowledged(true)}
            >
              I understand — continue to submit
            </button>
          </div>
        )}

        <FormActions>
          {hasValidationErrors(fieldErrors) && (
            <ValidationMessage variant="summary" messages={getValidationSummary(fieldErrors)} />
          )}
          <p className="form-hint">
            Enter operator and machine details, complete the checklist, report any defects, then submit.
          </p>
          <button type="submit" className="submit-btn" disabled={cloudSaving}>
            {cloudSaving ? 'Saving…' : 'Submit Record'}
          </button>
        </FormActions>
      </form>

      {completedRecord && (
        <section ref={recordRef} className="record no-print" aria-labelledby="prestart-record-heading" role="region">
          <div className="record__header">
            <div>
              <span className="type-badge">{completedRecord.formTypeLabel}</span>
              <h2 id="prestart-record-heading" className="record__title">
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
          {completedRecord.defectsFound === 'found' && onNavigate && (
            <div className="prestart-defect-action">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => handleCreateEquipmentDefect(completedRecord)}
              >
                Create Equipment Defect
              </button>
            </div>
          )}
          <RecordActions record={completedRecord} onPrint={setPrintRecord} />
          <div className="record__actions record__actions--saved no-print">
            <AdminArchiveAction
              recordType={ARCHIVE_RECORD_TYPES.PRE_START}
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

      <section className="saved-records no-print" aria-labelledby="prestart-saved-heading">
        {archiveMessage && (
          <p className="form-hint" role="status">
            {archiveMessage}
          </p>
        )}
        <div className="saved-records__header">
          <div>
            <h2 id="prestart-saved-heading" className="saved-records__title">
              Saved pre-start records
            </h2>
            <p className="saved-records__count">
              {preStartRecords.length} record{preStartRecords.length === 1 ? '' : 's'}
              {user?.id && cloudPreStartCount > 0
                ? isAdmin
                  ? ` (${cloudPreStartCount} from cloud — all users)`
                  : ` (${cloudPreStartCount} synced from cloud)`
                : ' on this device'}
            </p>
          </div>
          {preStartRecords.length > 0 && (
            <button type="button" className="saved-records__clear" onClick={handleClearPreStartRecords}>
              Clear all
            </button>
          )}
        </div>

        {recordFocus === 'defects' && (
          <p className="form-hint safety-alerts-focus-hint" role="status">
            Showing machine pre-starts — scroll to the highlighted defect record if listed below.
          </p>
        )}

        {cloudLoadWarning && (
          <p className="backup-warning" role="alert">
            {cloudLoadWarning}
          </p>
        )}

        {isAdmin && user?.id && (
          <p className="form-hint">
            Admin view: device records on this device plus all users&apos; cloud pre-start records.
          </p>
        )}

        {preStartRecords.length === 0 ? (
          <p className="saved-records__empty">
            No saved pre-start records yet. Submit a completed checklist to save one here.
          </p>
        ) : (
          <ul className="saved-records__list">
            {preStartRecords.map((record) => {
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
                        {record.fields?.operatorName?.trim() || 'Other user'}
                      </span>
                    )}
                  </div>
                  <p className="saved-record__title">{getRecordTitle(record)}</p>
                </div>
                <dl className="saved-record__details">
                  <SummaryRow label="Operator" value={record.fields.operatorName ?? record.fields.operator} />
                  <SummaryRow label="Machine" value={record.fields.machineNameId ?? record.fields.machine} />
                  <SummaryRow label="Site" value={record.fields.siteLocation} />
                  <SummaryRow label="Hours" value={record.fields.machineHours ?? record.fields.hourMeter} />
                  <SummaryRow label="Date" value={record.fields.date} />
                  <SummaryRow
                    label="Checklist"
                    value={`${record.completedCount} of ${record.totalCount} completed`}
                  />
                  <SummaryRow label="Notes" value={record.fields.notes} />
                  {record.defectsFound && (
                    <>
                      <SummaryRow label="Defects" value={formatDefectsFound(record.defectsFound)} />
                      {record.defectsFound === 'found' && (
                        <>
                          <SummaryRow label="Severity" value={formatDefectSeverity(record.defectSeverity)} />
                          <SummaryRow
                            label="Operable safely"
                            value={formatMachineOperable(record.machineOperableSafely)}
                          />
                          <SummaryRow label="Action required" value={record.actionRequired} />
                          <SummaryRow label="Reported to" value={record.reportedTo} />
                        </>
                      )}
                    </>
                  )}
                </dl>

                {record.defectsFound === 'found' && record.defectDescription && (
                  <p className="saved-record__defect-description">{record.defectDescription}</p>
                )}

                {isSeriousDefect(record) && <DefectWarning />}

                <SavedRecordSignature record={record} />

                {record.defectPhotos?.length > 0 && (
                  <ul className="photos__thumbs photos__thumbs--compact">
                    {record.defectPhotos.map((photo) => (
                      <li key={photo.id} className="photos__thumb">
                        <img src={photo.dataUrl} alt={photo.name} />
                      </li>
                    ))}
                  </ul>
                )}

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
                <div className="record__actions record__actions--saved no-print">
                  <AdminArchiveAction
                    recordType={ARCHIVE_RECORD_TYPES.PRE_START}
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
    </>
  )
}
