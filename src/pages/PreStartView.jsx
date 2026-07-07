import { useEffect, useMemo, useRef, useState } from 'react'
import { FORM_TYPES, MAX_PHOTOS } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { SignatureConfirmationField } from '../components/SignatureConfirmationField.jsx'
import { PhotoUpload } from '../components/PhotoUpload.jsx'
import { RadioFieldGroup } from '../components/RadioFieldGroup.jsx'
import { DefectWarning } from '../components/DefectWarning.jsx'
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

export function PreStartView({
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
  cloudPreStarts,
  setCloudPreStarts,
}) {
  const formConfig = FORM_TYPES['pre-start']
  const [draft, setDraft] = useState(() => createEmptyDraft('pre-start'))
  const [completedRecord, setCompletedRecord] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [completedSyncStatus, setCompletedSyncStatus] = useState(null)
  const [cloudLoadWarning, setCloudLoadWarning] = useState(null)
  const [cloudSaving, setCloudSaving] = useState(false)
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

  const cloudPreStartCount = preStartRecords.filter(
    (record) => resolveRecordSyncStatus(record) === SYNC_STATUS.CLOUD,
  ).length

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

    if (!fields.operatorName.trim() || !fields.machineNameId.trim()) {
      setValidationError('Operator name and machine name / ID are required before saving.')
      return
    }

    if (!signatureConfirmation.trim()) {
      setValidationError('Signature / Name Confirmation is required before saving.')
      return
    }

    if (defectsSelected) {
      if (!defectDescription.trim()) {
        setValidationError('Defect description is required when defects are found.')
        return
      }
      if (!defectSeverity) {
        setValidationError('Defect severity is required when defects are found.')
        return
      }
      if (!machineOperableSafely) {
        setValidationError(
          'Please indicate whether the machine can still be operated safely.',
        )
        return
      }
    }

    setValidationError(null)
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
      return
    }

    const cloudPatch = {
      syncStatus: SYNC_STATUS.CLOUD,
      cloudId: cloudRecord?.cloudId ?? null,
    }
    patchSavedPreStartRecord(record.id, cloudPatch)
    setCompletedSyncStatus(SYNC_STATUS.CLOUD)

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
    setValidationError(null)
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

      <header className="header no-print">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">{formConfig.title}</h1>
        <p className="progress" aria-live="polite">
          {completed} of {total} completed
        </p>
      </header>

      <form className="job-form no-print" onSubmit={handleSubmit} noValidate>
        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">1. Pre-start details</legend>
          <DateField value={fields.date} onChange={updateField} />
          <ComboField label="Operator name" field="operatorName" value={fields.operatorName} onChange={updateField} placeholder="Your name" options={comboOptions.operators} listId="pre-start-operators" />
          <ComboField label="Machine name / ID" field="machineNameId" value={fields.machineNameId} onChange={updateField} placeholder="e.g. EX-01 or 5T excavator" options={comboOptions.machines} listId="pre-start-machines" />
          <TextField label="Machine hours" field="machineHours" value={fields.machineHours} onChange={updateField} placeholder="Current hour meter reading" />
          <ComboField label="Site / job location" field="siteLocation" value={fields.siteLocation} onChange={updateField} placeholder="Site or yard" options={comboOptions.sites} listId="pre-start-sites" />
          <NotesField value={fields.notes} onChange={updateField} />
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">2. Pre-start checklist</legend>
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

        <fieldset className="job-form__fieldset defect-section">
          <legend className="job-form__legend">3. Defect reporting</legend>
          <RadioFieldGroup
            label="Any defects found?"
            name="defectsFound"
            value={defectsFound}
            onChange={(value) => {
              setValidationError(null)
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
              <label className="field">
                <span className="field__label">Defect description</span>
                <textarea
                  className="field__input field__textarea"
                  value={defectDescription}
                  onChange={(e) => {
                    setValidationError(null)
                    updateDraft({ defectDescription: e.target.value })
                  }}
                  placeholder="Describe the defect..."
                  rows={4}
                />
              </label>

              <SelectField
                label="Severity"
                field="defectSeverity"
                value={defectSeverity}
                onChange={(_, value) => {
                  setValidationError(null)
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

              <RadioFieldGroup
                label="Can the machine still be operated safely?"
                name="machineOperableSafely"
                value={machineOperableSafely}
                onChange={(value) => {
                  setValidationError(null)
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
        </fieldset>

        <fieldset className="job-form__fieldset">
          <legend className="job-form__legend">4. Name confirmation &amp; photos</legend>
          <SignatureConfirmationField
            value={signatureConfirmation}
            onChange={(value) => {
              setValidationError(null)
              updateDraft({ signatureConfirmation: value })
            }}
          />
          <PhotoUpload photos={photos} onChange={(value) => updateDraft({ photos: value })} />
        </fieldset>

        {allComplete && !showDefectWarning && (
          <p className="complete-message" role="status">
            Pre-start complete. Machine safe to operate.
          </p>
        )}

        {validationError && (
          <p className="validation-message" role="alert">
            {validationError}
          </p>
        )}

        <p className="form-hint">
          Enter operator and machine details, complete the checklist, report any defects, then save
          your pre-start record.
        </p>

        <button type="submit" className="submit-btn">
          Save completed record
        </button>
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

      <section className="saved-records no-print" aria-labelledby="prestart-saved-heading">
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
              </li>
            )})}
          </ul>
        )}
      </section>
    </>
  )
}
