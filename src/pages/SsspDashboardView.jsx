import { useMemo, useState } from 'react'
import { Archive, CheckCircle2, Clock3, FileCheck2, FileText, Plus, Search, Send } from 'lucide-react'
import { BackButton } from '../components/BackButton.jsx'
import { EmptyState } from '../components/common/EmptyState.jsx'
import { LoadingState } from '../components/common/LoadingState.jsx'
import { StatusBadge } from '../components/common/StatusBadge.jsx'
import { FormPageHeader } from '../components/forms/FormPageHeader.jsx'
import { SsspPrintPortal } from '../components/SsspPrintPortal.jsx'
import { ArchiveRecordModal } from '../components/ArchiveRecordModal.jsx'
import {
  SSSP_DASHBOARD_TABS,
  getSsspStatusLabel,
  getSsspStatusModifier,
} from '../constants/ssspStatuses.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import {
  filterSsspRecords,
  appendChangeLog,
  syncIndexedFieldsFromRecordData,
} from '../utils/storage/ssspStorage.js'
import {
  LOCAL_DRAFT_LIST_LABEL,
  draftToListRecord,
  getLocalDraftConflictNote,
  listLocalDrafts,
} from '../utils/storage/ssspDraft.js'
import { formatSubmittedAt, formatNzDate } from '../utils/formatting.js'
import { SSSP_STATUS } from '../constants/ssspStatuses.js'
import { updateSsspRecord } from '../utils/storage/ssspCloudStorage.js'
import { ARCHIVE_RECORD_TYPES } from '../utils/storage/archiveFilter.js'
import { archiveRecord } from '../utils/storage/archiveActions.js'
import { formatCloudSaveError } from '../utils/storage/cloudSyncStatus.js'

export function SsspDashboardView({
  onBack,
  onNavigate,
  profile,
  user,
  ssspRecords,
  setSsspRecords,
  isLoading,
  loadError,
}) {
  const isAdmin = isAdminProfile(profile)
  const [activeTab, setActiveTab] = useState(isAdmin ? 'drafts' : 'approved')
  const [search, setSearch] = useState('')
  const [printRecord, setPrintRecord] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [archiveModalError, setArchiveModalError] = useState('')

  const preparedByName = profile?.full_name?.trim() || user?.email?.split('@')[0] || ''

  const visibleTabs = useMemo(
    () => SSSP_DASHBOARD_TABS.filter((tab) => !tab.adminOnly || isAdmin),
    [isAdmin],
  )

  // Read-only scan of this user's localStorage drafts — never clears or mutates them.
  const localDraftRecords = useMemo(() => {
    if (!isAdmin || !user?.id) return []
    return listLocalDrafts(user.id)
      .map((entry) => draftToListRecord(entry, ssspRecords))
      .filter(Boolean)
  }, [isAdmin, user?.id, ssspRecords])

  const recordsForList = useMemo(
    () => [...localDraftRecords, ...(ssspRecords ?? [])],
    [localDraftRecords, ssspRecords],
  )

  const filteredRecords = useMemo(
    () =>
      filterSsspRecords(recordsForList, {
        tab: activeTab,
        search,
        isAdmin,
      }),
    [recordsForList, activeTab, search, isAdmin],
  )

  const statusSummary = useMemo(() => {
    const counts = {
      total: recordsForList.length,
      drafts: 0,
      review: 0,
      approved: 0,
      submitted: 0,
      archived: 0,
    }
    recordsForList.forEach((record) => {
      if (record.status === SSSP_STATUS.DRAFT || record.isLocalDraft) counts.drafts += 1
      if (record.status === SSSP_STATUS.READY_FOR_REVIEW) counts.review += 1
      if (record.status === SSSP_STATUS.APPROVED) counts.approved += 1
      if (record.status === SSSP_STATUS.SUBMITTED) counts.submitted += 1
      if (record.status === SSSP_STATUS.ARCHIVED) counts.archived += 1
    })
    return counts
  }, [recordsForList])

  const summaryCards = [
    { label: 'All plans', value: statusSummary.total, icon: FileText, tab: 'all' },
    { label: 'Drafts', value: statusSummary.drafts, icon: Clock3, tab: 'drafts' },
    { label: 'Awaiting review', value: statusSummary.review, icon: FileCheck2, tab: 'ready_for_review' },
    { label: 'Approved', value: statusSummary.approved, icon: CheckCircle2, tab: 'approved' },
    { label: 'Submitted', value: statusSummary.submitted, icon: Send, tab: 'submitted' },
    { label: 'Archived', value: statusSummary.archived, icon: Archive, tab: 'archived', adminOnly: true },
  ].filter((item) => !item.adminOnly || isAdmin)

  function openRecord(record, mode = 'view') {
    if (record?.isLocalDraft) {
      onNavigate('sssp-editor', {
        ssspMode: 'create',
        ssspDraftSiteId: record.localDraftSiteOrJobId ?? null,
      })
      return
    }
    onNavigate('sssp-editor', { ssspCloudId: record.cloudId, ssspMode: mode })
  }

  function startNew() {
    onNavigate('sssp-editor', { ssspMode: 'create' })
  }

  function handlePrint(record) {
    setPrintRecord(record)
  }

  async function handleReactivate(record) {
    if (!user?.id || !record.cloudId) return
    setActionLoadingId(record.cloudId)
    setActionError('')
    setActionSuccess('')

    const now = new Date().toISOString()
    let next = syncIndexedFieldsFromRecordData({
      ...record,
      status: SSSP_STATUS.DRAFT,
      archivedAt: null,
      updatedAt: now,
    })

    next = appendChangeLog(next, {
      action: 'reactivated',
      detail: 'SSSP reactivated to draft',
      userName: preparedByName,
    })

    const { record: saved, error } = await updateSsspRecord(user, next)
    setActionLoadingId(null)

    if (error) {
      setActionError(formatCloudSaveError(error) || error.message)
      return
    }

    setSsspRecords((prev) => {
      const without = prev.filter((r) => r.cloudId !== saved.cloudId)
      return [saved, ...without]
    })
    setActionSuccess('SSSP reactivated to draft.')
  }

  async function confirmArchiveSssp() {
    if (!archiveTarget || actionLoadingId) return
    setActionLoadingId(archiveTarget.cloudId)
    setArchiveModalError('')
    setActionError('')
    setActionSuccess('')

    const { record: saved, error } = await archiveRecord(
      ARCHIVE_RECORD_TYPES.SSSP,
      archiveTarget,
      user,
      profile,
      { preparedByName },
    )

    setActionLoadingId(null)

    if (error || !saved) {
      setArchiveModalError(error?.message || 'Archive failed.')
      return
    }

    setSsspRecords((prev) => {
      const without = prev.filter((r) => r.cloudId !== saved.cloudId)
      return [saved, ...without]
    })
    setArchiveTarget(null)
    setActionSuccess('SSSP archived. Find it under Archived Records.')
  }

  return (
    <>
      <SsspPrintPortal
        record={printRecord}
        includeAcknowledgements={isAdmin}
        onDone={() => setPrintRecord(null)}
      />

      <BackButton onClick={onBack} />

      <FormPageHeader
        title="Site-Specific Safety Plans"
        subtitle="Create, review and manage project safety plans"
      />

      {actionError && (
        <p className="validation-message" role="alert">{actionError}</p>
      )}
      {actionSuccess && (
        <p className="form-hint" role="status">
          {actionSuccess}
        </p>
      )}

      {loadError && (
        <p className="validation-message validation-message--warning" role="alert">
          Could not load SSSP records: {loadError}
        </p>
      )}

      {isLoading && <LoadingState label="Loading SSSPs…" />}

      <div className="sssp-dashboard">
        <section className="sssp-dashboard__summary" aria-label="SSSP status summary">
          {summaryCards.map(({ label, value, icon: Icon, tab }) => (
            <button key={label} type="button" className="sssp-summary-card" onClick={() => setActiveTab(tab)}>
              <Icon size={18} aria-hidden="true" />
              <span className="sssp-summary-card__value">{value}</span>
              <span className="sssp-summary-card__label">{label}</span>
            </button>
          ))}
        </section>
        <div className="sssp-dashboard__toolbar">
          {isAdmin && (
            <button type="button" className="btn btn--primary" onClick={startNew}>
              <Plus size={16} aria-hidden="true" />
              New SSSP
            </button>
          )}
          {!isAdmin && (
            <p className="sssp-dashboard__staff-note">
              You can view approved/submitted SSSPs and acknowledge the current revision.
            </p>
          )}
        </div>

        <div className="sssp-dashboard__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search number, project, client, contractor, site, contract ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search SSSPs"
          />
        </div>

        <div className="sssp-dashboard__tabs" role="tablist" aria-label="SSSP filters">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`sssp-dashboard__tab${activeTab === tab.id ? ' sssp-dashboard__tab--active' : ''}`}
              onClick={() => {
                if (tab.id === 'new') {
                  startNew()
                } else {
                  setActiveTab(tab.id)
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'new' ? null : filteredRecords.length === 0 ? (
          <EmptyState title="No SSSPs match this filter" description="Try another status tab or create a new SSSP." />
        ) : (
          <ul className="sssp-dashboard__list">
            {filteredRecords.map((record) => {
              const isLocalDraft = Boolean(record.isLocalDraft)
              const conflictNote = isLocalDraft
                ? getLocalDraftConflictNote(record.localDraftConflict)
                : null
              const listKey = isLocalDraft
                ? record.localDraftKey ?? `local-${record.id}`
                : record.cloudId ?? record.id

              return (
              <li
                key={listKey}
                className={`sssp-card${isLocalDraft ? ' sssp-card--local-draft' : ''}`}
              >
                <div className="sssp-card__header">
                  <div>
                    <h3 className="sssp-card__number">{record.ssspNumber || 'No number'}</h3>
                    <p className="sssp-card__project">{record.project || 'Untitled project'}</p>
                    {isLocalDraft && (
                      <p className="sssp-card__local-draft-label" role="status">
                        {LOCAL_DRAFT_LIST_LABEL}
                      </p>
                    )}
                    {conflictNote && (
                      <p className="sssp-card__conflict-note" role="status">
                        {conflictNote}
                      </p>
                    )}
                  </div>
                  <StatusBadge
                    status={record.status}
                    label={isLocalDraft ? LOCAL_DRAFT_LIST_LABEL : getSsspStatusLabel(record.status)}
                    className={`sssp-status-badge sssp-status-badge--${
                      isLocalDraft ? 'local-draft' : getSsspStatusModifier(record.status)
                    }`}
                  />
                </div>

                <dl className="sssp-card__meta">
                  <div><dt>Client</dt><dd>{record.client || '—'}</dd></div>
                  <div><dt>Site</dt><dd>{record.site || '—'}</dd></div>
                  <div><dt>Revision</dt><dd>{record.revision ?? 1}</dd></div>
                  <div><dt>Prepared by</dt><dd>{record.preparedBy || '—'}</dd></div>
                  <div><dt>Updated</dt><dd>{record.updatedAt ? formatSubmittedAt(record.updatedAt) : '—'}</dd></div>
                  <div><dt>Effective</dt><dd>{formatNzDate(record.effectiveDate)}</dd></div>
                </dl>

                <div className="sssp-card__actions">
                  {isLocalDraft ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => openRecord(record, 'create')}
                      >
                        Continue editing
                      </button>
                      <button type="button" className="btn btn--secondary" onClick={() => handlePrint(record)}>
                        Print
                      </button>
                    </>
                  ) : (
                    <>
                  <button type="button" className="btn btn--secondary" onClick={() => openRecord(record, 'view')}>
                    Open
                  </button>
                  {isAdmin && ['draft', 'ready_for_review'].includes(record.status) && (
                    <button type="button" className="btn btn--secondary" onClick={() => openRecord(record, 'edit')}>
                      Edit
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button type="button" className="btn btn--secondary" onClick={() => openRecord(record, 'duplicate')}>
                        Duplicate
                      </button>
                      {['approved', 'submitted', 'closed'].includes(record.status) && (
                        <button type="button" className="btn btn--secondary" onClick={() => openRecord(record, 'revision')}>
                          Create Revision
                        </button>
                      )}
                      {record.status !== 'archived' ? (
                        <button
                          type="button"
                          className="btn btn--secondary archive-record-action"
                          disabled={actionLoadingId === record.cloudId}
                          onClick={() => {
                            setArchiveModalError('')
                            setArchiveTarget(record)
                          }}
                        >
                          Archive Record
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--secondary"
                          disabled={actionLoadingId === record.cloudId}
                          onClick={() => handleReactivate(record)}
                        >
                          Reactivate
                        </button>
                      )}
                    </>
                  )}
                  <button type="button" className="btn btn--secondary" onClick={() => handlePrint(record)}>
                    Print
                  </button>
                  {!isAdmin && ['approved', 'submitted'].includes(record.status) && (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => onNavigate('sssp-acknowledge', { ssspCloudId: record.cloudId })}
                    >
                      Acknowledge
                    </button>
                  )}
                    </>
                  )}
                </div>
              </li>
              )
            })}
          </ul>
        )}
      </div>

      <ArchiveRecordModal
        open={Boolean(archiveTarget)}
        onCancel={() => {
          if (actionLoadingId) return
          setArchiveTarget(null)
          setArchiveModalError('')
        }}
        onConfirm={confirmArchiveSssp}
        archiving={Boolean(archiveTarget && actionLoadingId === archiveTarget.cloudId)}
        error={archiveModalError}
      />
    </>
  )
}
