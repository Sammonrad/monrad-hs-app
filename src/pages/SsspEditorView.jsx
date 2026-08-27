import { useEffect, useMemo, useRef, useState } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import { CloudSyncBadge } from '../components/CloudSyncBadge.jsx'
import { PrintableSSSP } from '../components/PrintableSSSP.jsx'
import { ConfirmModal } from '../components/common/ConfirmModal.jsx'
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
  syncIndexedFieldsFromRecordData,
  appendChangeLog,
} from '../utils/storage/ssspStorage.js'
import {
  loadDraft,
  saveDraft,
  clearDraft,
  SSSP_DRAFT_AUTOSAVE_MS,
} from '../utils/storage/ssspDraft.js'
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

function createBlankNewSssp({ ssspNumber, preparedByName, userId }) {
  return createEmptySsspRecord({
    ssspNumber,
    preparedBy: preparedByName,
    preparedByUserId: userId,
    recordData: {
      ...createEmptySsspRecord().recordData,
      declaration: {
        preparedByName,
        preparedDate: new Date().toISOString().slice(0, 10),
      },
    },
  })
}

export function SsspEditorView({
  onBack,
  onNavigate,
  user,
  profile,
  ssspRecords,
  setSsspRecords,
  equipment = [],
  initialCloudId = null,
  initialMode = 'view',
  initialDraftSiteId = null,
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
  const [draftStatus, setDraftStatus] = useState(null)
  const [hasLocalDraft, setHasLocalDraft] = useState(false)
  const [discardDraftOpen, setDiscardDraftOpen] = useState(false)

  const autosaveReadyRef = useRef(false)
  const skipNextAutosaveRef = useRef(false)
  const autosaveTimerRef = useRef(null)
  const ssspRecordsRef = useRef(ssspRecords)
  ssspRecordsRef.current = ssspRecords

  const mode = initialMode
  const isNewSssp = mode === 'create' && !initialCloudId
  const draftSiteOrJobId = initialDraftSiteId || null
  const readOnly = !isAdmin || mode === 'view' || !isSsspEditable(record.status, isAdmin)

  const preparedByName =
    profile?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    ''

  useEffect(() => {
    let isMounted = true

    async function init() {
      autosaveReadyRef.current = false

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
          const numbers = ssspRecordsRef.current.map((r) => r.ssspNumber).filter(Boolean)
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
          // Edit/view of an existing submitted or cloud record — never load New SSSP draft.
          setRecord(normalizeSsspRecord(cloudRecord))
        }
        setLoading(false)
        return
      }

      if (mode === 'create') {
        if (!user?.id) {
          const numbers = ssspRecordsRef.current.map((r) => r.ssspNumber).filter(Boolean)
          const newNumber = await suggestNextSsspNumber(numbers)
          if (!isMounted) return
          setRecord(createBlankNewSssp({ ssspNumber: newNumber, preparedByName, userId: null }))
          return
        }

        const draft = loadDraft(user.id, draftSiteOrJobId)
        if (draft?.record && draft.userId === user.id) {
          if (!isMounted) return
          setRecord(normalizeSsspRecord(draft.record))
          if (draft.sectionId) setActiveSection(draft.sectionId)
          setDraftStatus('restored')
          setHasLocalDraft(true)
          skipNextAutosaveRef.current = true
          autosaveReadyRef.current = true
          return
        }

        const numbers = ssspRecordsRef.current.map((r) => r.ssspNumber).filter(Boolean)
        const newNumber = await suggestNextSsspNumber(numbers)
        if (!isMounted) return
        setRecord(createBlankNewSssp({ ssspNumber: newNumber, preparedByName, userId: user.id }))
        skipNextAutosaveRef.current = true
        autosaveReadyRef.current = true
      }
    }

    init()
    return () => {
      isMounted = false
    }
  }, [initialCloudId, mode, user?.id, preparedByName, draftSiteOrJobId])

  // Debounced local autosave — New SSSP only. Never writes to Supabase.
  useEffect(() => {
    if (!isNewSssp || !user?.id || readOnly || !autosaveReadyRef.current) return undefined

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false
      return undefined
    }

    setDraftStatus('saving')

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      const ok = saveDraft(user.id, { record, sectionId: activeSection }, draftSiteOrJobId)
      if (ok) {
        setHasLocalDraft(true)
        setDraftStatus('saved')
      }
    }, SSSP_DRAFT_AUTOSAVE_MS)

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [record, activeSection, isNewSssp, user?.id, readOnly, draftSiteOrJobId])

  const validationForReady = useMemo(() => validateSsspRecord(record, 'ready'), [record])
  const validationForApproval = useMemo(() => validateSsspRecord(record, 'approval'), [record])
  const validationForSubmitted = useMemo(() => validateSsspRecord(record, 'submitted'), [record])
  const activeSectionIndex = SSSP_SECTIONS.findIndex((section) => section.id === activeSection)
  const completedSectionCount = useMemo(
    () =>
      SSSP_SECTIONS.filter((section) => {
        if (section.isRiskRegister) return (record.hazards ?? []).some((hazard) => !hazard.archived)
        const data = record.recordData?.[section.id]
        if (section.repeatable) return Array.isArray(data) && data.length > 0
        return section.fields?.some((field) => field.required && data?.[field.key]?.trim?.())
      }).length,
    [record.hazards, record.recordData],
  )
  const progressPercent = Math.round((completedSectionCount / SSSP_SECTIONS.length) * 100)

  const draftStatusLabel =
    draftStatus === 'saving'
      ? 'Saving draft…'
      : draftStatus === 'saved'
        ? 'Draft saved'
        : draftStatus === 'restored'
          ? 'Draft restored'
          : null

  function selectAdjacentSection(direction) {
    const nextSection = SSSP_SECTIONS[activeSectionIndex + direction]
    if (!nextSection) return
    setActiveSection(nextSection.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  function clearLocalDraftAfterCloudSuccess() {
    if (!user?.id) return
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    clearDraft(user.id, draftSiteOrJobId)
    setHasLocalDraft(false)
    setDraftStatus(null)
    // Avoid immediately rewriting the draft from the post-save setRecord.
    skipNextAutosaveRef.current = true
  }

  async function resetToBlankNewSssp() {
    const numbers = ssspRecordsRef.current.map((r) => r.ssspNumber).filter(Boolean)
    const newNumber = await suggestNextSsspNumber(numbers)
    skipNextAutosaveRef.current = true
    setActiveSection('documentControl')
    setRecord(createBlankNewSssp({ ssspNumber: newNumber, preparedByName, userId: user?.id }))
    setErrors([])
    setDraftStatus(null)
  }

  async function handleDiscardDraft() {
    if (!user?.id) {
      setDiscardDraftOpen(false)
      return
    }
    clearDraft(user.id, draftSiteOrJobId)
    setHasLocalDraft(false)
    setDiscardDraftOpen(false)
    await resetToBlankNewSssp()
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
      setErrors([
        `${error.message} Your local draft has been kept — you can retry when connection is available.`,
      ])
      setSyncStatus(SYNC_STATUS.CLOUD_FAILED)
      return
    }

    setRecord(saved)
    setSyncStatus(SYNC_STATUS.CLOUD)
    clearLocalDraftAfterCloudSuccess()
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
      setErrors([
        `${error.message} Final save failed — your local draft has been kept.`,
      ])
      return
    }

    setRecord(saved)
    setSyncStatus(SYNC_STATUS.CLOUD)
    clearLocalDraftAfterCloudSuccess()
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

      {isNewSssp && (draftStatusLabel || hasLocalDraft) && (
        <p className="sssp-editor__draft-status" aria-live="polite">
          {draftStatusLabel && <span>{draftStatusLabel}</span>}
          {hasLocalDraft && !readOnly && (
            <button
              type="button"
              className="btn btn--link sssp-editor__discard-draft"
              onClick={() => setDiscardDraftOpen(true)}
            >
              Discard draft
            </button>
          )}
        </p>
      )}

      <section className="sssp-editor__overview" aria-label="SSSP completion">
        <div className="sssp-editor__overview-copy">
          <div>
            <span className="sssp-editor__eyebrow">Document progress</span>
            <strong>{completedSectionCount} of {SSSP_SECTIONS.length} sections started</strong>
          </div>
          <span className={`sssp-status-badge sssp-status-badge--${record.status.replaceAll('_', '-')}`}>
            {getSsspStatusLabel(record.status)}
          </span>
        </div>
        <div
          className="sssp-editor__progress-track"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={progressPercent}
        >
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      </section>

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
          <strong>Complete the following before continuing:</strong>
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

      <div className="sssp-editor sssp-editor--layout">
        <aside className="sssp-editor__nav-panel">
          <p className="sssp-editor__nav-title">Plan sections</p>
          <SsspSectionNav
          sections={SSSP_SECTIONS}
          activeSectionId={activeSection}
          onSelect={setActiveSection}
          recordData={record.recordData}
          hazards={record.hazards}
          />
        </aside>

        <div className="sssp-editor__content">
          <header className="sssp-editor__section-header">
            <span>Section {activeSectionIndex + 1} of {SSSP_SECTIONS.length}</span>
            <h2>{SSSP_SECTIONS[activeSectionIndex]?.title}</h2>
          </header>
          <SsspSectionForm
            sectionId={activeSection}
            recordData={record.recordData}
            hazards={record.hazards}
            onSectionChange={updateSection}
            onHazardsChange={updateHazards}
            readOnly={readOnly}
            equipment={equipment}
            isAdmin={isAdminProfile(profile)}
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

          <nav className="sssp-editor__section-actions" aria-label="Move between SSSP sections">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={activeSectionIndex <= 0}
              onClick={() => selectAdjacentSection(-1)}
            >
              Previous section
            </button>
            <span>{activeSectionIndex + 1} / {SSSP_SECTIONS.length}</span>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={activeSectionIndex >= SSSP_SECTIONS.length - 1}
              onClick={() => selectAdjacentSection(1)}
            >
              Next section
            </button>
          </nav>
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

      <ConfirmModal
        open={discardDraftOpen}
        title="Discard draft?"
        message="This permanently deletes your local New SSSP draft from this device. This cannot be undone."
        confirmLabel="Discard draft"
        cancelLabel="Keep draft"
        variant="danger"
        onConfirm={handleDiscardDraft}
        onCancel={() => setDiscardDraftOpen(false)}
      />
    </>
  )
}
