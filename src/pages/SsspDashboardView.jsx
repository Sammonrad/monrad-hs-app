import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { BackButton } from '../components/BackButton.jsx'
import { FormPageHeader } from '../components/forms/FormPageHeader.jsx'
import { PrintableSSSP } from '../components/PrintableSSSP.jsx'
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
import { formatSubmittedAt } from '../utils/formatting.js'
import { SSSP_STATUS } from '../constants/ssspStatuses.js'
import { updateSsspRecord } from '../utils/storage/ssspCloudStorage.js'

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
  const [actionLoadingId, setActionLoadingId] = useState(null)

  const preparedByName = profile?.full_name?.trim() || user?.email?.split('@')[0] || ''

  const visibleTabs = useMemo(
    () => SSSP_DASHBOARD_TABS.filter((tab) => !tab.adminOnly || isAdmin),
    [isAdmin],
  )

  const filteredRecords = useMemo(
    () =>
      filterSsspRecords(ssspRecords, {
        tab: activeTab,
        search,
        isAdmin,
      }),
    [ssspRecords, activeTab, search, isAdmin],
  )

  function openRecord(record, mode = 'view') {
    onNavigate('sssp-editor', { ssspCloudId: record.cloudId, ssspMode: mode })
  }

  function startNew() {
    onNavigate('sssp-editor', { ssspMode: 'create' })
  }

  function handlePrint(record) {
    setPrintRecord(record)
    window.setTimeout(() => window.print(), 350)
  }

  async function handleArchiveToggle(record) {
    if (!user?.id || !record.cloudId) return
    setActionLoadingId(record.cloudId)
    setActionError('')

    const now = new Date().toISOString()
    const archiving = record.status !== SSSP_STATUS.ARCHIVED
    let next = syncIndexedFieldsFromRecordData({
      ...record,
      status: archiving ? SSSP_STATUS.ARCHIVED : SSSP_STATUS.DRAFT,
      archivedAt: archiving ? now : null,
      updatedAt: now,
    })

    next = appendChangeLog(next, {
      action: archiving ? 'archived' : 'reactivated',
      detail: archiving ? 'SSSP archived from dashboard' : 'SSSP reactivated to draft',
      userName: preparedByName,
    })

    const { record: saved, error } = await updateSsspRecord(user, next)
    setActionLoadingId(null)

    if (error) {
      setActionError(error.message)
      return
    }

    setSsspRecords((prev) => {
      const without = prev.filter((r) => r.cloudId !== saved.cloudId)
      return [saved, ...without]
    })
  }

  return (
    <>
      {printRecord && (
        <div className="print-area" aria-hidden="true">
          <PrintableSSSP record={printRecord} includeAcknowledgements={isAdmin} />
        </div>
      )}

      <BackButton onClick={onBack} />

      <FormPageHeader
        title="Site-Specific Safety Plans"
        subtitle="Planning & documentation — SSSP register"
      />

      {actionError && (
        <p className="validation-message" role="alert">{actionError}</p>
      )}

      {loadError && (
        <p className="validation-message validation-message--warning" role="alert">
          Could not load SSSP records: {loadError}
        </p>
      )}

      {isLoading && <p className="progress">Loading SSSPs…</p>}

      <div className="sssp-dashboard">
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
          <p className="sssp-dashboard__empty">No SSSPs match this filter.</p>
        ) : (
          <ul className="sssp-dashboard__list">
            {filteredRecords.map((record) => (
              <li key={record.cloudId ?? record.id} className="sssp-card">
                <div className="sssp-card__header">
                  <div>
                    <h3 className="sssp-card__number">{record.ssspNumber || 'No number'}</h3>
                    <p className="sssp-card__project">{record.project || 'Untitled project'}</p>
                  </div>
                  <span
                    className={`sssp-status-badge sssp-status-badge--${getSsspStatusModifier(record.status)}`}
                  >
                    {getSsspStatusLabel(record.status)}
                  </span>
                </div>

                <dl className="sssp-card__meta">
                  <div><dt>Client</dt><dd>{record.client || '—'}</dd></div>
                  <div><dt>Site</dt><dd>{record.site || '—'}</dd></div>
                  <div><dt>Revision</dt><dd>{record.revision ?? 1}</dd></div>
                  <div><dt>Prepared by</dt><dd>{record.preparedBy || '—'}</dd></div>
                  <div><dt>Updated</dt><dd>{record.updatedAt ? formatSubmittedAt(record.updatedAt) : '—'}</dd></div>
                  <div><dt>Effective</dt><dd>{record.effectiveDate || '—'}</dd></div>
                </dl>

                <div className="sssp-card__actions">
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
                          className="btn btn--secondary"
                          disabled={actionLoadingId === record.cloudId}
                          onClick={() => handleArchiveToggle(record)}
                        >
                          Archive
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--secondary"
                          disabled={actionLoadingId === record.cloudId}
                          onClick={() => handleArchiveToggle(record)}
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
