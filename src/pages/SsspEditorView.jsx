import { useEffect, useMemo, useState } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import { CloudSyncBadge } from '../components/CloudSyncBadge.jsx'
import { PrintableSSSP } from '../components/PrintableSSSP.jsx'
import { SsspInput, SsspTextarea } from '../components/sssp/SsspFields.jsx'
import { FormPageHeader } from '../components/forms/FormPageHeader.jsx'
import { FormField } from '../components/forms/FormField.jsx'
import { FormActions } from '../components/forms/FormActions.jsx'
import { ValidationMessage } from '../components/forms/ValidationMessage.jsx'
import { SSSP_SECTIONS } from '../constants/ssspSections.js'
import { SSSP_STATUS, getSsspStatusLabel, isSsspEditable } from '../constants/ssspStatuses.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import {
  createEmptySsspRecord,
  normalizeSsspRecord,
  persistEditorDraft,
  loadEditorDraft,
  clearEditorDraft,
  syncIndexedFieldsFromRecordData,
  appendChangeLog,
} from '../utils/storage/ssspStorage.js'
import {
  fetchSsspById,
  saveSsspRecord,
  updateSsspRecord,
  duplicateSsspRecord,
  createSsspRevision,
  SYNC_STATUS,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
} from '../utils/storage/ssspCloudStorage.js'
import {
  validateSsspRecord,
  getValidationGateForStatus,
  canTransitionStatus,
} from '../utils/storage/ssspValidation.js'
import {
  suggestNextSsspNumber,
  checkSsspNumberUnique,
  validateSsspNumberFormat,
} from '../utils/storage/ssspNumbering.js'
import { SsspSectionForm, SsspSectionNav } from '../components/sssp/SsspSectionForm.jsx'

export function SsspEditorView({
  onBack,
  onNavigate,
  user,
  profile,
  ssspRecords,
  setSsspRecords,
  initialCloudId = null,
  initialMode = 'view',
  returnView = 'sssp',
}) {
  const isAdmin = isAdminProfile(profile)
  const [record, setRecord] = useState(() => createEmptySsspRecord())
  const [activeSection, setActiveSection] = useState('documentControl')
  const [loading, setLoading] = useState(Boolean(initialCloudId))
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState([])
  const [syncStatus, setSyncStatus] = useState(null)
  const [printRecord, setPrintRecord] = useState(null)
  const [revisionNote, setRevisionNote] = useState('')
  const [draftNotice, setDraftNotice] = useState(null)

  const mode = initialMode
  const readOnly = !isAdmin || mode === 'view' || !isSsspEditable(record.status, isAdmin)

  const preparedByName =
    profile?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    ''

  useEffect(() => {
    let isMounted = true

    async function init() {
      if (initialCloudId) {
        setLoading(true)
        const { record: cloudRecord, error } = await fetchSsspById(initialCloudId)
        if (!isMounted) return
        if (error || !cloudRecord) {
          setErrors([error?.message ?? 'Could not load SSSP.'])
          setLoading(false)
          return
        }

        if (mode === 'duplicate') {
          const numbers = ssspRecords.map((r) => r.ssspNumber).filter(Boolean)
          const newNumber = await suggestNextSsspNumber(numbers)
          const dup = duplicateSsspRecord(cloudRecord, {
            newNumber,
            preparedBy: preparedByName,
            userId: user?.id,
          })
          setRecord(dup)
        } else if (mode === 'revision') {
          setRecord(
            createSsspRevision(cloudRecord, {
              preparedBy: preparedByName,
              userId: user?.id,
              changeDetail: '',
            }),
          )
        } else {
          setRecord(normalizeSsspRecord(cloudRecord))
        }
        setLoading(false)
        return
      }

      if (mode === 'create') {
        const draft = loadEditorDraft()
        if (draft?.record) {
          setDraftNotice(`Restored local draft from ${draft.savedAt ? new Date(draft.savedAt).toLocaleString() : 'earlier'}.`)
          setRecord(normalizeSsspRecord(draft.record))
          if (draft.sectionId) setActiveSection(draft.sectionId)
        } else {
          const numbers = ssspRecords.map((r) => r.ssspNumber).filter(Boolean)
          const newNumber = await suggestNextSsspNumber(numbers)
          setRecord(
            createEmptySsspRecord({
              ssspNumber: newNumber,
              preparedBy: preparedByName,
              preparedByUserId: user?.id,
              recordData: {
                ...createEmptySsspRecord().recordData,
                declaration: {
                  preparedByName,
                  preparedDate: new Date().toISOString().slice(0, 10),
                },
              },
            }),
          )
        }
      }
    }

    init()
    return () => {
      isMounted = false
    }
  }, [initialCloudId, mode, user?.id, preparedByName, ssspRecords])

  useEffect(() => {
    if (mode === 'create' || (mode === 'edit' && record.status === SSSP_STATUS.DRAFT)) {
      persistEditorDraft(record, activeSection)
    }
  }, [record, activeSection, mode])

  const validationForReady = useMemo(() => validateSsspRecord(record, 'ready'), [record])
  const validationForApproval = useMemo(() => validateSsspRecord(record, 'approval'), [record])
  const validationForSubmitted = useMemo(() => validateSsspRecord(record, 'submitted'), [record])

  function updateRecord(patch) {
    setRecord((prev) => syncIndexedFieldsFromRecordData({ ...prev, ...patch }))
  }

  function updateSection(sectionId, data) {
    setRecord((prev) =>
      syncIndexedFieldsFromRecordData({
        ...prev,
        recordData: { ...prev.recordData, [sectionId]: data },
      }),
    )
  }

  function updateHazards(hazards) {
    const next = typeof hazards === 'function' ? hazards(record.hazards) : hazards
    setRecord((prev) =>
      syncIndexedFieldsFromRecordData({
        ...prev,
        hazards: next,
        recordData: { ...prev.recordData, hazards: next },
      }),
    )
  }

  async function persistToCloud(nextRecord) {
    if (isCloudSaveUnavailable(user)) {
      setSyncStatus(getUnavailableSyncStatus(user))
      return { record: nextRecord, error: new Error('Cloud save unavailable.') }
    }

    const payload = syncIndexedFieldsFromRecordData({
      ...nextRecord,
      updatedAt: new Date().toISOString(),
    })

    const { unique, error: numberError } = await checkSsspNumberUnique(
      payload.ssspNumber,
      payload.cloudId,
    )
    if (numberError) return { record: null, error: new Error(numberError) }
    if (!unique) return { record: null, error: new Error('SSSP number already in use.') }

    if (payload.cloudId) {
      return updateSsspRecord(user, payload)
    }
    return saveSsspRecord(user, payload)
  }

  async function handleSaveDraft() {
    setSaving(true)
    setErrors([])
    const numberErr = validateSsspNumberFormat(record.ssspNumber)
    if (numberErr) {
      setErrors([numberErr])
      setSaving(false)
      return
    }

    const next = syncIndexedFieldsFromRecordData({
      ...record,
      status: SSSP_STATUS.DRAFT,
      updatedAt: new Date().toISOString(),
    })

    const { record: saved, error } = await persistToCloud(next)
    setSaving(false)

    if (error) {
      setErrors([error.message])
      setSyncStatus(SYNC_STATUS.CLOUD_FAILED)
      return
    }

    setRecord(saved)
    setSyncStatus(SYNC_STATUS.CLOUD)
    clearEditorDraft()
    setSsspRecords((prev) => {
      const without = prev.filter((r) => r.cloudId !== saved.cloudId)
      return [saved, ...without]
    })
  }

  async function handleStatusTransition(targetStatus, gate) {
    setSaving(true)
    setErrors([])

    const validation = validateSsspRecord(record, gate)
    if (!validation.valid) {
      setErrors(validation.errors)
      setSaving(false)
      return
    }

    const transition = canTransitionStatus(record.status, targetStatus, isAdmin)
    if (!transition.allowed && record.status !== targetStatus) {
      setErrors([transition.reason])
      setSaving(false)
      return
    }

    const now = new Date().toISOString()
    let next = syncIndexedFieldsFromRecordData({ ...record, status: targetStatus, updatedAt: now })

    if (targetStatus === SSSP_STATUS.APPROVED) {
      next = {
        ...next,
        approvedAt: now,
        approvedBy: user?.id,
        approvedByName: preparedByName,
        recordData: {
          ...next.recordData,
          declaration: {
            ...next.recordData.declaration,
            approvedByName: preparedByName,
            approvedDate: now.slice(0, 10),
          },
        },
      }
    }
    if (targetStatus === SSSP_STATUS.SUBMITTED) {
      next = { ...next, submittedAt: now }
    }
    if (targetStatus === SSSP_STATUS.CLOSED) {
      next = { ...next, closedAt: now }
    }
    if (targetStatus === SSSP_STATUS.ARCHIVED) {
      next = appendChangeLog(
        { ...next, archivedAt: now },
        { action: 'archived', detail: 'SSSP archived', userName: preparedByName },
      )
    }
    if (targetStatus === SSSP_STATUS.DRAFT && record.status === SSSP_STATUS.ARCHIVED) {
      next = appendChangeLog(
        { ...next, archivedAt: null },
        { action: 'reactivated', detail: 'SSSP reactivated to draft', userName: preparedByName },
      )
    }
    if (mode === 'revision' && targetStatus === SSSP_STATUS.DRAFT) {
      next = appendChangeLog(next, {
        action: 'revision',
        detail: revisionNote || `Revision ${next.revision} started`,
        userName: preparedByName,
      })
    }

    const { record: saved, error } = await persistToCloud(next)
    setSaving(false)

    if (error) {
      setErrors([error.message])
      return
    }

    setRecord(saved)
    setSyncStatus(SYNC_STATUS.CLOUD)
    clearEditorDraft()
    setSsspRecords((prev) => {
      const without = prev.filter((r) => r.cloudId !== saved.cloudId)
      return [saved, ...without]
    })
  }

  if (!isAdmin && mode !== 'view') {
    return (
      <>
        <BackButton onClick={onBack} />
        <p className="validation-message" role="alert">Access denied — admin only.</p>
      </>
    )
  }

  return (
    <>
      {printRecord && (
        <div className="print-area" aria-hidden="true">
          <PrintableSSSP record={printRecord} includeAcknowledgements />
        </div>
      )}

      <BackButton onClick={onBack} />

      <FormPageHeader
        title={readOnly ? 'View SSSP' : mode === 'create' ? 'New SSSP' : 'Edit SSSP'}
        subtitle={`${record.ssspNumber || 'Draft'} · Rev ${record.revision} · ${getSsspStatusLabel(record.status)}`}
      />

      {loading && <p className="progress">Loading SSSP…</p>}
      {draftNotice && <p className="sssp-editor__draft-notice">{draftNotice}</p>}

      {!readOnly && (
        <div className="sssp-editor__meta">
          <FormField label="SSSP number" required>
            <SsspInput
              value={record.ssspNumber}
              onChange={(v) => updateRecord({ ssspNumber: v })}
            />
          </FormField>
          <FormField label="Effective date">
            <SsspInput
              type="date"
              value={record.effectiveDate ?? ''}
              onChange={(v) => updateRecord({ effectiveDate: v })}
            />
          </FormField>
          <FormField label="Review date">
            <SsspInput
              type="date"
              value={record.reviewDate ?? ''}
              onChange={(v) => updateRecord({ reviewDate: v })}
            />
          </FormField>
        </div>
      )}

      {syncStatus && <CloudSyncBadge syncStatus={syncStatus} />}

      {errors.length > 0 && (
        <div className="validation-summary" role="alert">
          {errors.map((err) => (
            <ValidationMessage key={err} message={err} />
          ))}
        </div>
      )}

      {mode === 'revision' && !readOnly && (
        <FormField label="Revision change note">
          <SsspTextarea value={revisionNote} onChange={setRevisionNote} rows={2} />
        </FormField>
      )}

      <div className="sssp-editor">
        <SsspSectionNav
          sections={SSSP_SECTIONS}
          activeSectionId={activeSection}
          onSelect={setActiveSection}
          recordData={record.recordData}
          hazards={record.hazards}
        />

        <div className="sssp-editor__content">
          <SsspSectionForm
            sectionId={activeSection}
            recordData={record.recordData}
            hazards={record.hazards}
            onSectionChange={updateSection}
            onHazardsChange={updateHazards}
            readOnly={readOnly}
            onNavigateCriticalRisks={() =>
              onNavigate('critical-risks', { returnView: 'sssp-editor' })
            }
          />

          <p className="sssp-editor__links">
            Related:{' '}
            <button type="button" className="btn btn--link" onClick={() => onNavigate('incident')}>
              Incident / Near Miss
            </button>
            {' · '}
            <button type="button" className="btn btn--link" onClick={() => onNavigate('action-register')}>
              Action Register
            </button>
          </p>
        </div>
      </div>

      <FormActions>
        <button type="button" className="btn btn--secondary" onClick={() => setPrintRecord(record)}>
          Print / Save PDF
        </button>

        {!readOnly && (
          <>
            <button type="button" className="btn btn--secondary" onClick={handleSaveDraft} disabled={saving}>
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            {record.status === SSSP_STATUS.DRAFT && (
              <button
                type="button"
                className="btn btn--primary"
                disabled={saving || !validationForReady.valid}
                onClick={() => handleStatusTransition(SSSP_STATUS.READY_FOR_REVIEW, getValidationGateForStatus(SSSP_STATUS.READY_FOR_REVIEW))}
              >
                Ready for Review
              </button>
            )}
            {record.status === SSSP_STATUS.READY_FOR_REVIEW && (
              <>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={saving}
                  onClick={() => handleStatusTransition(SSSP_STATUS.DRAFT, 'draft')}
                >
                  Return to Draft
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={saving || !validationForApproval.valid}
                  onClick={() => handleStatusTransition(SSSP_STATUS.APPROVED, getValidationGateForStatus(SSSP_STATUS.APPROVED))}
                >
                  Approve
                </button>
              </>
            )}
            {record.status === SSSP_STATUS.APPROVED && (
              <button
                type="button"
                className="btn btn--primary"
                disabled={saving || !validationForSubmitted.valid}
                onClick={() => handleStatusTransition(SSSP_STATUS.SUBMITTED, getValidationGateForStatus(SSSP_STATUS.SUBMITTED))}
              >
                Submit to Site
              </button>
            )}
            {record.status === SSSP_STATUS.SUBMITTED && (
              <button
                type="button"
                className="btn btn--primary"
                disabled={saving}
                onClick={() => handleStatusTransition(SSSP_STATUS.CLOSED, 'submitted')}
              >
                Close SSSP
              </button>
            )}
          </>
        )}
      </FormActions>
    </>
  )
}
