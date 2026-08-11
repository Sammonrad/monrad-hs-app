import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { BackButton } from '../components/BackButton.jsx'
import { EmptyState } from '../components/common/EmptyState.jsx'
import { FilterDisclosure } from '../components/common/FilterDisclosure.jsx'
import { StatusBadge } from '../components/common/StatusBadge.jsx'
import { FormPageHeader } from '../components/forms/FormPageHeader.jsx'
import { FormSection } from '../components/forms/FormSection.jsx'
import { FormField } from '../components/forms/FormField.jsx'
import { FormActions } from '../components/forms/FormActions.jsx'
import { FormGrid, FormGridFull } from '../components/layout/FormGrid.jsx'
import { TextField, DateField, TimeField, SelectField, NotesField } from '../components/FormFields.jsx'
import { formatTime12Hour } from '../utils/time12Hour.js'
import { CloudSyncBadge } from '../components/CloudSyncBadge.jsx'
import { PrintableGeneralMeeting } from '../components/generalMeeting/PrintableGeneralMeeting.jsx'
import {
  MeetingPreviousActionRows,
  MeetingNewActionRows,
  MeetingDetailSections,
} from '../components/generalMeeting/MeetingSections.jsx'
import {
  MEETING_TYPES,
  MEETING_TYPE_LABELS,
  MEETING_FREQUENCIES,
  MEETING_FREQUENCY_LABELS,
  MEETING_FILTER_TABS,
  MEETING_STATUS_LABELS,
  getMeetingDisplayTitle,
} from '../constants/generalMeetingConfig.js'
import { formatSubmittedAt, formatNzDate } from '../utils/formatting.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
import {
  createEmptyMeeting,
  normalizeMeeting,
  persistMeetings,
  duplicateMeeting,
  filterMeetings,
  calculateNextMeetingDate,
} from '../utils/storage/generalMeetingStorage.js'
import {
  getMergedMeetings,
  fetchGeneralMeetingRecords,
  saveGeneralMeetingRecord,
  updateGeneralMeetingRecord,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
  formatCloudSaveError,
  SYNC_STATUS,
} from '../utils/storage/generalMeetingCloudStorage.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import { ARCHIVE_RECORD_TYPES } from '../utils/storage/archiveFilter.js'
import { matchesArchiveTarget } from '../utils/storage/archiveActions.js'
import { AdminArchiveAction } from '../components/AdminArchiveAction.jsx'
import { downloadFile } from '../utils/export.js'

export function GeneralMeetingView({
  onBack,
  meetings,
  setMeetings,
  cloudMeetings,
  setCloudMeetings,
  onMeetingCompleted,
  settings,
  user,
  profile,
  initialMeetingId = null,
}) {
  const isAdmin = isAdminProfile(profile)
  const operatorOptions = getSettingsOptions(settings).operators
  const [mode, setMode] = useState('list')
  const [draft, setDraft] = useState(() => createEmptyMeeting())
  const [selectedId, setSelectedId] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [cloudLoadWarning, setCloudLoadWarning] = useState(null)
  const [printMeeting, setPrintMeeting] = useState(null)
  const [nextMeetingManual, setNextMeetingManual] = useState(false)
  const [archiveMessage, setArchiveMessage] = useState('')

  const mergedMeetings = useMemo(
    () => getMergedMeetings(meetings, cloudMeetings),
    [meetings, cloudMeetings],
  )

  const filteredMeetings = useMemo(
    () => filterMeetings(mergedMeetings, { status: activeTab, search, meetingType: typeFilter }),
    [mergedMeetings, activeTab, search, typeFilter],
  )

  const selectedMeeting = useMemo(
    () => mergedMeetings.find((item) => item.id === selectedId) ?? null,
    [mergedMeetings, selectedId],
  )

  useEffect(() => {
    if (!initialMeetingId) return
    const match = mergedMeetings.find((item) => item.id === initialMeetingId || item.cloudId === initialMeetingId)
    if (match) {
      setSelectedId(match.id)
      setMode('detail')
    }
  }, [initialMeetingId, mergedMeetings])

  useEffect(() => {
    if (!user?.id) {
      setCloudLoadWarning(null)
      return undefined
    }

    let isMounted = true
    async function loadCloud() {
      const { records, error } = await fetchGeneralMeetingRecords(user.id, { isAdmin })
      if (!isMounted) return
      if (error) {
        setCloudLoadWarning(`Could not load cloud meeting records: ${formatCloudSaveError(error)}. Showing device records only.`)
        return
      }
      setCloudLoadWarning(null)
      setCloudMeetings(records)
    }
    loadCloud()
    return () => {
      isMounted = false
    }
  }, [user?.id, isAdmin, setCloudMeetings])

  useEffect(() => {
    if (!printMeeting) return undefined
    const timer = window.setTimeout(() => window.print(), 350)
    const handleAfterPrint = () => setPrintMeeting(null)
    window.addEventListener('afterprint', handleAfterPrint)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [printMeeting])

  function patchLocalMeeting(record) {
    setMeetings((prev) => {
      const without = prev.filter((item) => item.id !== record.id)
      const next = [record, ...without]
      persistMeetings(next)
      return next
    })
  }

  function handleMeetingArchived(archived, { localOnly } = {}) {
    setMeetings((prev) => {
      const next = prev.map((item) =>
        matchesArchiveTarget(item, archived) ? { ...item, archived: true } : item,
      )
      persistMeetings(next)
      return next
    })
    setCloudMeetings((prev) =>
      prev.map((item) =>
        matchesArchiveTarget(item, archived) ? { ...item, archived: true } : item,
      ),
    )
    if (selectedId === archived.id || (archived.cloudId && selectedMeeting?.cloudId === archived.cloudId)) {
      setSelectedId(null)
      setMode('list')
    }
    setArchiveMessage(
      localOnly
        ? 'Meeting archived on this device (Local). Find it under Archived Records.'
        : 'Meeting archived. Find it under Archived Records.',
    )
  }

  function updateDraftField(field, value) {
    setDraft((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'meetingDate' || field === 'scheduleFrequency') {
        if (!nextMeetingManual) {
          next.nextMeetingDate = calculateNextMeetingDate(
            field === 'meetingDate' ? value : next.meetingDate,
            field === 'scheduleFrequency' ? value : next.scheduleFrequency,
          )
        }
      }
      return next
    })
  }

  function startNew() {
    setDraft(createEmptyMeeting())
    setNextMeetingManual(false)
    setSaveError('')
    setMode('edit')
    setSelectedId(null)
  }

  function startEdit(record) {
    setDraft(normalizeMeeting(record))
    setNextMeetingManual(Boolean(record.nextMeetingDate))
    setSaveError('')
    setMode('edit')
    setSelectedId(record.id)
  }

  function openDetail(record) {
    setSelectedId(record.id)
    setMode('detail')
  }

  async function persistMeeting(record, { complete = false } = {}) {
    setSaving(true)
    setSaveError('')

    let payload = normalizeMeeting({
      ...record,
      updatedAt: new Date().toISOString(),
      status: complete ? 'completed' : record.status || 'draft',
      submittedAt: complete ? new Date().toISOString() : record.submittedAt,
    })

    if (complete && !payload.nextMeetingDate) {
      payload.nextMeetingDate = calculateNextMeetingDate(
        payload.meetingDate,
        payload.scheduleFrequency,
      )
    }

    patchLocalMeeting(payload)

    if (isCloudSaveUnavailable(user)) {
      const syncStatus = getUnavailableSyncStatus(user)
      payload = { ...payload, syncStatus, storageSource: 'local' }
      patchLocalMeeting(payload)
      setSaving(false)
      if (complete) onMeetingCompleted?.(payload)
      setMode('detail')
      setSelectedId(payload.id)
      return payload
    }

    const saveFn = payload.cloudId ? updateGeneralMeetingRecord : saveGeneralMeetingRecord
    const { record: cloudRecord, error } = await saveFn(user, payload)
    setSaving(false)

    if (error) {
      payload = { ...payload, syncStatus: SYNC_STATUS.CLOUD_FAILED, storageSource: 'local' }
      patchLocalMeeting(payload)
      setSaveError(`Cloud save failed — saved on this device. ${formatCloudSaveError(error)}`)
    } else if (cloudRecord) {
      payload = cloudRecord
      patchLocalMeeting(payload)
      setCloudMeetings((prev) => {
        const without = prev.filter((item) => item.cloudId !== cloudRecord.cloudId && item.id !== payload.id)
        return [cloudRecord, ...without]
      })
    }

    if (complete) onMeetingCompleted?.(payload)
    setSelectedId(payload.id)
    setMode('detail')
    return payload
  }

  async function handleSaveDraft() {
    if (!draft.meetingDate?.trim()) {
      setSaveError('Meeting date is required.')
      return
    }
    await persistMeeting({ ...draft, status: 'draft' })
  }

  async function handleComplete() {
    if (!draft.meetingDate?.trim()) {
      setSaveError('Meeting date is required.')
      return
    }
    if (!draft.chairperson?.trim()) {
      setSaveError('Chairperson is required to complete a meeting record.')
      return
    }
    await persistMeeting({ ...draft, status: 'completed' }, { complete: true })
  }

  function handleDuplicate(record) {
    const copy = duplicateMeeting(record)
    patchLocalMeeting(copy)
    startEdit(copy)
  }

  function exportMeetingJson(record) {
    downloadFile(
      JSON.stringify(record, null, 2),
      `monrad-general-meeting-${record.meetingDate || record.id}.json`,
      'application/json',
    )
  }

  if (mode === 'edit') {
    return (
      <>
        <BackButton onClick={() => setMode(selectedId ? 'detail' : 'list')} />
        <FormPageHeader
          title="H&S General Meeting"
          subtitle={draft.status === 'completed' ? 'Edit completed meeting' : 'Create or edit meeting record'}
        />
        {saveError && <p className="validation-message validation-message--error" role="alert">{saveError}</p>}

        <form className="job-form no-print" onSubmit={(e) => e.preventDefault()} noValidate>
          <FormSection title="Meeting details" id="gm-details">
            <FormGrid>
              <DateField label="Meeting date" field="meetingDate" value={draft.meetingDate} onChange={updateDraftField} />
              <TimeField label="Meeting time" field="meetingTime" value={draft.meetingTime} onChange={updateDraftField} />
              <TextField label="Location" field="location" value={draft.location} onChange={updateDraftField} />
              <SelectField
                label="Meeting type"
                field="meetingType"
                value={draft.meetingType}
                onChange={updateDraftField}
                options={MEETING_TYPES.map((value) => ({ value, label: MEETING_TYPE_LABELS[value] }))}
              />
              <SelectField
                label="Meeting frequency (for next due date)"
                field="scheduleFrequency"
                value={draft.scheduleFrequency}
                onChange={updateDraftField}
                options={MEETING_FREQUENCIES.map((value) => ({ value, label: MEETING_FREQUENCY_LABELS[value] }))}
              />
              <FormField label="Chairperson">
                <input list="gm-chair-options" className="field__input" value={draft.chairperson} onChange={(e) => updateDraftField('chairperson', e.target.value)} />
                <datalist id="gm-chair-options">
                  {operatorOptions.map((name) => <option key={name} value={name} />)}
                </datalist>
              </FormField>
              <FormGridFull>
                <label className="field">
                  <span className="field__label">Attendees</span>
                  <textarea className="field__input field__textarea" rows={2} value={draft.attendees} onChange={(e) => updateDraftField('attendees', e.target.value)} />
                </label>
              </FormGridFull>
              <FormGridFull>
                <label className="field">
                  <span className="field__label">Absentees</span>
                  <textarea className="field__input field__textarea" rows={2} value={draft.absentees} onChange={(e) => updateDraftField('absentees', e.target.value)} />
                </label>
              </FormGridFull>
            </FormGrid>
          </FormSection>

          <FormSection title="Previous actions and progress" id="gm-previous-actions">
            <MeetingPreviousActionRows
              items={draft.previousActions}
              onChange={(next) => updateDraftField('previousActions', next)}
            />
          </FormSection>

          <FormSection title="Incidents and near misses since previous meeting" id="gm-incidents">
            <NotesField value={draft.incidentsSinceLast} onChange={(_, v) => updateDraftField('incidentsSinceLast', v)} />
          </FormSection>

          <FormSection title="New hazards and critical risks" id="gm-hazards">
            <NotesField value={draft.newHazardsAndRisks} onChange={(_, v) => updateDraftField('newHazardsAndRisks', v)} />
          </FormSection>

          <FormSection title="Machine defects and maintenance concerns" id="gm-machines">
            <NotesField value={draft.machineDefectsMaintenance} onChange={(_, v) => updateDraftField('machineDefectsMaintenance', v)} />
          </FormSection>

          <FormSection title="Training, licence and competency updates" id="gm-training">
            <NotesField value={draft.trainingCompetency} onChange={(_, v) => updateDraftField('trainingCompetency', v)} />
          </FormSection>

          <FormSection title="Worker concerns and suggestions" id="gm-concerns">
            <NotesField value={draft.workerConcerns} onChange={(_, v) => updateDraftField('workerConcerns', v)} />
          </FormSection>

          <FormSection title="Policies or procedures reviewed" id="gm-policies">
            <NotesField value={draft.policiesReviewed} onChange={(_, v) => updateDraftField('policiesReviewed', v)} />
          </FormSection>

          <FormSection title="Upcoming work and safety considerations" id="gm-upcoming">
            <NotesField value={draft.upcomingWork} onChange={(_, v) => updateDraftField('upcomingWork', v)} />
          </FormSection>

          <FormSection title="General discussion and notes" id="gm-discussion">
            <NotesField value={draft.generalDiscussion} onChange={(_, v) => updateDraftField('generalDiscussion', v)} />
          </FormSection>

          <FormSection title="New actions" id="gm-new-actions">
            <MeetingNewActionRows items={draft.newActions} onChange={(next) => updateDraftField('newActions', next)} />
          </FormSection>

          <FormSection title="Next meeting and sign-off" id="gm-signoff">
            <FormGrid>
              <DateField
                label="Next meeting date"
                field="nextMeetingDate"
                value={draft.nextMeetingDate}
                onChange={(field, value) => {
                  setNextMeetingManual(true)
                  updateDraftField(field, value)
                }}
              />
              <FormGridFull>
                <label className="field">
                  <span className="field__label">Attendee acknowledgement / sign-off</span>
                  <textarea
                    className="field__input field__textarea"
                    rows={3}
                    value={draft.attendeeSignOff}
                    onChange={(e) => updateDraftField('attendeeSignOff', e.target.value)}
                    placeholder="Names and confirmation that minutes were read and understood"
                  />
                </label>
              </FormGridFull>
            </FormGrid>
            {!nextMeetingManual && (
              <p className="field__hint">
                Next meeting date is calculated automatically from the meeting date and frequency. Change the date above to override.
              </p>
            )}
          </FormSection>

          <FormActions>
            <button type="button" className="btn btn--secondary" onClick={handleSaveDraft} disabled={saving}>
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <button type="button" className="btn btn--primary" onClick={handleComplete} disabled={saving}>
              {saving ? 'Saving…' : 'Mark completed'}
            </button>
          </FormActions>
        </form>
      </>
    )
  }

  if (mode === 'detail' && selectedMeeting) {
    return (
      <>
        {printMeeting && (
          <div className="print-area" aria-hidden="true">
            <PrintableGeneralMeeting meeting={printMeeting} />
          </div>
        )}

        <BackButton onClick={() => setMode('list')} />
        <header className="gm-detail-header">
          <div>
            <h1 className="page-title">{getMeetingDisplayTitle(selectedMeeting)}</h1>
            <p className="page-description">
              {MEETING_STATUS_LABELS[selectedMeeting.status]} · Saved {formatSubmittedAt(selectedMeeting.submittedAt || selectedMeeting.updatedAt || selectedMeeting.createdAt)}
            </p>
            <CloudSyncBadge syncStatus={selectedMeeting.syncStatus} className="cloud-sync-status--block" />
          </div>
        </header>

        <div className="gm-detail-actions no-print">
          <button type="button" className="btn btn--secondary" onClick={() => startEdit(selectedMeeting)}>Edit</button>
          <button type="button" className="btn btn--secondary" onClick={() => handleDuplicate(selectedMeeting)}>Duplicate</button>
          <button type="button" className="btn btn--secondary" onClick={() => setPrintMeeting(selectedMeeting)}>Print / Save PDF</button>
          <button type="button" className="btn btn--secondary" onClick={() => exportMeetingJson(selectedMeeting)}>Export JSON</button>
          <AdminArchiveAction
            recordType={ARCHIVE_RECORD_TYPES.GENERAL_MEETING}
            record={selectedMeeting}
            user={user}
            profile={profile}
            onArchived={handleMeetingArchived}
            buttonClassName="btn btn--secondary archive-record-action"
          />
        </div>

        <section className="gm-detail-summary">
          <dl className="gm-detail-summary__dl">
            <div><dt>Date / time</dt><dd>{formatNzDate(selectedMeeting.meetingDate)} {formatTime12Hour(selectedMeeting.meetingTime) || '—'}</dd></div>
            <div><dt>Location</dt><dd>{selectedMeeting.location || '—'}</dd></div>
            <div><dt>Chairperson</dt><dd>{selectedMeeting.chairperson || '—'}</dd></div>
            <div><dt>Attendees</dt><dd>{selectedMeeting.attendees || '—'}</dd></div>
            <div><dt>Absentees</dt><dd>{selectedMeeting.absentees || '—'}</dd></div>
          </dl>
        </section>

        <MeetingDetailSections meeting={selectedMeeting} />
      </>
    )
  }

  return (
    <>
      <BackButton onClick={onBack} />
      <FormPageHeader
        title="H&S General Meeting"
        subtitle="Formal health and safety meeting records — separate from daily toolbox meetings"
      />

      {cloudLoadWarning && (
        <p className="validation-message validation-message--warning" role="alert">{cloudLoadWarning}</p>
      )}
      {archiveMessage && (
        <p className="form-hint" role="status">
          {archiveMessage}
        </p>
      )}

      <div className="gm-dashboard">
        <div className="gm-dashboard__toolbar">
          <button type="button" className="btn btn--primary" onClick={startNew}>
            <Plus size={16} aria-hidden="true" />
            New meeting
          </button>
        </div>

        <div className="gm-dashboard__filters">
          <div className="gm-dashboard__tabs">
            {MEETING_FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`gm-dashboard__tab${activeTab === tab.id ? ' gm-dashboard__tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="gm-dashboard__search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search date, location, chairperson, attendees…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search meetings"
            />
          </div>
          <FilterDisclosure
            activeCount={typeFilter ? 1 : 0}
            onReset={() => setTypeFilter('')}
          >
            <select className="form-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by meeting type">
              <option value="">All types</option>
              {MEETING_TYPES.map((type) => (
                <option key={type} value={type}>{MEETING_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </FilterDisclosure>
        </div>

        <section className="gm-history" aria-label="Meeting history">
          <h2 className="gm-history__title">Meeting history</h2>

          <div className="responsive-data-list">
            <div className="responsive-data-list__desktop">
              <table className="equipment-table gm-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Chairperson</th>
                    <th>Status</th>
                    <th>Next meeting</th>
                    <th>Sync</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMeetings.length === 0 && (
                    <tr><td colSpan={8}>No meeting records found.</td></tr>
                  )}
                  {filteredMeetings.map((record) => (
                    <tr key={record.id}>
                      <td>{formatNzDate(record.meetingDate)}</td>
                      <td>{MEETING_TYPE_LABELS[record.meetingType] || record.meetingType}</td>
                      <td>{record.location || '—'}</td>
                      <td>{record.chairperson || '—'}</td>
                      <td>{MEETING_STATUS_LABELS[record.status] || record.status}</td>
                      <td>{formatNzDate(record.nextMeetingDate)}</td>
                      <td><CloudSyncBadge syncStatus={record.syncStatus} size="small" /></td>
                      <td>
                        <button type="button" className="btn btn--secondary btn--small" onClick={() => openDetail(record)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="responsive-data-list__mobile">
              {filteredMeetings.length === 0 ? (
                <EmptyState
                  title="No meeting records found"
                  description="Create a new meeting or adjust filters to see history."
                  primaryAction={{ label: 'New meeting', onClick: startNew }}
                />
              ) : null}
              {filteredMeetings.map((record) => (
                <article key={record.id} className="gm-history-card">
                  <header className="gm-history-card__header">
                    <div>
                      <h3>{getMeetingDisplayTitle(record)}</h3>
                      <p>{record.chairperson || 'No chairperson'}</p>
                    </div>
                    <StatusBadge
                      status={record.status}
                      label={MEETING_STATUS_LABELS[record.status] || record.status}
                    />
                  </header>
                  <p>Next meeting: {formatNzDate(record.nextMeetingDate)}</p>
                  <CloudSyncBadge syncStatus={record.syncStatus} size="small" />
                  <button type="button" className="btn btn--secondary" onClick={() => openDetail(record)}>
                    Open
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
