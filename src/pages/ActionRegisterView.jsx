import { useEffect, useMemo, useState } from 'react'
import { TODAY, DEFAULT_ACTION_PRIORITY, ACTION_REGISTER_FILTERS } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { ActionCard } from '../components/ActionCard.jsx'
import { PrintableAction } from '../components/PrintableAction.jsx'
import { DateField, TextField, SelectField } from '../components/FormFields.jsx'
import { FormSection } from '../components/forms/FormSection.jsx'
import { FormField } from '../components/forms/FormField.jsx'
import { FormActions } from '../components/forms/FormActions.jsx'
import { ValidationMessage } from '../components/forms/ValidationMessage.jsx'
import { createRecordId } from '../utils/ids.js'
import {
  persistActions,
  normalizeAction,
  createEmptyManualAction,
  isOverdue,
  patchAction,
} from '../utils/storage/actionsStorage.js'
import {
  fetchActionRecords,
  getMergedActions,
  saveActionRecord,
  updateActionRecord,
  SYNC_STATUS,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
} from '../utils/storage/actionCloudStorage.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import { matchesArchiveTarget } from '../utils/storage/archiveActions.js'
import { ARCHIVE_RECORD_TYPES, withPreservedArchived } from '../utils/storage/archiveFilter.js'
import {
  filterActionsByRegisterFilter,
  sortActiveActions,
} from '../utils/safetyAlerts.js'
import { useHighlightAction } from '../hooks/useHighlightAction.js'
import { scrollToFirstInvalid } from '../utils/formValidation.js'

export function ActionRegisterView({
  onBack,
  actions,
  setActions,
  user,
  profile,
  cloudActions,
  setCloudActions,
  highlightActionId,
  onClearActionHighlight,
  initialActionFilter,
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [manualDraft, setManualDraft] = useState(createEmptyManualAction)
  const [fieldErrors, setFieldErrors] = useState({})
  const [statusFilter, setStatusFilter] = useState(() => {
    const allowed = ACTION_REGISTER_FILTERS.some((filter) => filter.id === initialActionFilter)
    return allowed ? initialActionFilter : 'all'
  })
  const [printAction, setPrintAction] = useState(null)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [cloudError, setCloudError] = useState('')
  const [archiveMessage, setArchiveMessage] = useState('')

  const isAdmin = isAdminProfile(profile)

  function handleActionArchived(archived, { localOnly } = {}) {
    setActions((prev) => {
      const next = prev.map((item) =>
        matchesArchiveTarget(item, archived) ? { ...item, archived: true } : item,
      )
      persistActions(next)
      return next
    })
    setCloudActions((prev) =>
      prev.map((item) =>
        matchesArchiveTarget(item, archived) ? { ...item, archived: true } : item,
      ),
    )
    setArchiveMessage(
      localOnly
        ? 'Action archived on this device (Local). Find it under Archived Records.'
        : 'Action archived. Find it under Archived Records.',
    )
  }

  useEffect(() => {
    if (!initialActionFilter) return
    const allowed = ACTION_REGISTER_FILTERS.some((filter) => filter.id === initialActionFilter)
    if (allowed) setStatusFilter(initialActionFilter)
  }, [initialActionFilter])

  useHighlightAction(highlightActionId, onClearActionHighlight, [statusFilter, actions, cloudActions])

  useEffect(() => {
    if (!user?.id) {
      setCloudError('')
      return undefined
    }

    let isMounted = true
    setCloudLoading(true)
    setCloudError('')

    fetchActionRecords(user.id, { isAdmin }).then(({ records, error }) => {
      if (!isMounted) return
      setCloudLoading(false)
      if (error) {
        setCloudError(error.message || 'Could not load cloud actions.')
        return
      }

      setCloudActions(records)
      setActions((prev) => {
        const activeMerged = getMergedActions(prev, records)
        const merged = withPreservedArchived(prev, activeMerged, ARCHIVE_RECORD_TYPES.ACTION)
        const changed =
          merged.length !== prev.length ||
          merged.some(
            (action, index) =>
              action.cloudId !== prev[index]?.cloudId ||
              action.id !== prev[index]?.id ||
              action.archived !== prev[index]?.archived,
          )
        if (changed) {
          persistActions(merged)
          return merged
        }
        return prev
      })
    })

    return () => {
      isMounted = false
    }
  }, [user?.id, isAdmin, setActions, setCloudActions])

  const displayActions = useMemo(() => {
    if (!user?.id || !cloudActions?.length) return actions
    return getMergedActions(actions, cloudActions)
  }, [actions, cloudActions, user?.id])

  const activeActions = useMemo(
    () => sortActiveActions(displayActions.filter((action) => action.status !== 'completed')),
    [displayActions],
  )
  const completedActions = useMemo(
    () => displayActions.filter((action) => action.status === 'completed'),
    [displayActions],
  )

  const filteredActive = useMemo(() => {
    if (statusFilter === 'completed') return []
    if (statusFilter === 'all') return activeActions
    return sortActiveActions(filterActionsByRegisterFilter(activeActions, statusFilter))
  }, [activeActions, statusFilter])

  const filteredCompleted = useMemo(() => {
    if (statusFilter === 'completed') return completedActions
    if (statusFilter === 'all') return completedActions
    return filterActionsByRegisterFilter(completedActions, statusFilter)
  }, [completedActions, statusFilter])

  const overdueCount = activeActions.filter(isOverdue).length

  function updateActions(next) {
    if (!persistActions(next)) return false
    setActions(next)
    return true
  }

  async function syncActionToCloud(action, isNew = false) {
    if (isCloudSaveUnavailable(user)) {
      const syncStatus = getUnavailableSyncStatus(user)
      setActions((prev) => {
        const next = patchAction(prev, action.id, { syncStatus })
        persistActions(next)
        return next
      })
      return
    }

    const { record: cloudRecord, error } = isNew || !action.cloudId
      ? await saveActionRecord(user, action)
      : await updateActionRecord(user, action)

    if (error) {
      setActions((prev) => {
        const next = patchAction(prev, action.id, { syncStatus: SYNC_STATUS.CLOUD_FAILED })
        persistActions(next)
        return next
      })
      return
    }

    if (cloudRecord) {
      const cloudPatch = {
        syncStatus: SYNC_STATUS.CLOUD,
        cloudId: cloudRecord.cloudId,
        cloudUserId: cloudRecord.cloudUserId,
        storageSource: 'both',
        completedAt: cloudRecord.completedAt,
      }
      setActions((prev) => {
        const next = patchAction(prev, action.id, cloudPatch)
        persistActions(next)
        return next
      })
      setCloudActions((prev) => {
        const withoutDup = prev.filter(
          (item) => item.cloudId !== cloudRecord.cloudId && item.id !== action.id,
        )
        return [cloudRecord, ...withoutDup]
      })
    }
  }

  function handleUpdateAction(actionId, updates) {
    const existing = actions.find((action) => action.id === actionId)
    if (!existing) return

    const withCompleted =
      updates.status === 'completed'
        ? { ...updates, completedAt: new Date().toISOString() }
        : updates

    const updated = normalizeAction({ ...existing, ...withCompleted })
    const next = actions.map((action) => (action.id === actionId ? updated : action))
    if (!updateActions(next)) return
    syncActionToCloud(updated)
  }

  function handleCompleteAction(actionId) {
    handleUpdateAction(actionId, { status: 'completed' })
  }

  function handleAddManualAction(event) {
    event.preventDefault()
    if (!manualDraft.description.trim()) {
      setFieldErrors({ description: 'Description is required for a new action.' })
      scrollToFirstInvalid({ description: 'required' })
      return
    }

    const newAction = normalizeAction({
      id: createRecordId(),
      sourceType: 'manual',
      sourceRecordId: null,
      date: manualDraft.date || TODAY(),
      site: manualDraft.site.trim(),
      description: manualDraft.description.trim(),
      personResponsible: manualDraft.personResponsible.trim(),
      dueDate: manualDraft.dueDate,
      priority: manualDraft.priority || DEFAULT_ACTION_PRIORITY,
      status: 'open',
      notes: manualDraft.notes.trim(),
      createdAt: new Date().toISOString(),
      autoCreated: false,
      serious: false,
      storageSource: 'local',
    })

    if (!updateActions([newAction, ...actions])) return
    setManualDraft(createEmptyManualAction())
    setShowAddForm(false)
    setFieldErrors({})
    syncActionToCloud(newAction, true)
  }

  useEffect(() => {
    if (!printAction) return undefined

    const timer = window.setTimeout(() => {
      window.print()
    }, 350)

    function handleAfterPrint() {
      setPrintAction(null)
    }

    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [printAction])

  const showCompletedSection =
    statusFilter === 'all' || statusFilter === 'completed' ? filteredCompleted.length > 0 : false

  return (
    <>
      {printAction && (
        <div className="print-area" aria-hidden="true">
          <PrintableAction action={printAction} />
        </div>
      )}

      <BackButton onClick={onBack} />

      <header className="header no-print">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">Action Register</h1>
        <p className="progress" aria-live="polite">
          {activeActions.length} open · {completedActions.length} completed
          {overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
          {cloudLoading && ' · Loading cloud actions…'}
        </p>
        {cloudError && (
          <p className="validation-message" role="alert">
            {cloudError} Showing local actions only.
          </p>
        )}
        {archiveMessage && (
          <p className="form-hint" role="status">
            {archiveMessage}
          </p>
        )}
      </header>

      <section className="actions-register no-print" aria-labelledby="actions-open-heading">
        <div className="actions-register__toolbar">
          <h2 id="actions-open-heading" className="actions-register__title">
            {statusFilter === 'completed' ? 'Completed actions' : 'Open actions'}
          </h2>
          <button
            type="button"
            className="action-btn action-btn--primary"
            onClick={() => {
              setShowAddForm((prev) => !prev)
              setFieldErrors({})
            }}
          >
            {showAddForm ? 'Cancel' : 'Add action'}
          </button>
        </div>

        <div className="action-filters" role="tablist" aria-label="Filter actions">
          {ACTION_REGISTER_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={
                statusFilter === filter.id ? 'filter-btn filter-btn--active' : 'filter-btn'
              }
              onClick={() => setStatusFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {showAddForm && (
          <form className="action-form" onSubmit={handleAddManualAction} noValidate>
            <FormSection title="New Manual Action" id="manual-action">
              <DateField
                label="Date"
                field="date"
                value={manualDraft.date}
                onChange={(_, value) => setManualDraft((prev) => ({ ...prev, date: value }))}
              />
              <TextField
                label="Site / job location"
                field="site"
                value={manualDraft.site}
                onChange={(_, value) => setManualDraft((prev) => ({ ...prev, site: value }))}
                placeholder="Site or job name"
              />
              <FormField label="Description" fieldId="description" required error={fieldErrors.description}>
                <textarea
                  className="field__input field__textarea"
                  value={manualDraft.description}
                  onChange={(e) => {
                    setFieldErrors({})
                    setManualDraft((prev) => ({ ...prev, description: e.target.value }))
                  }}
                  placeholder="Describe the action required..."
                  rows={3}
                />
              </FormField>
              <TextField
                label="Person responsible"
                field="personResponsible"
                value={manualDraft.personResponsible}
                onChange={(_, value) =>
                  setManualDraft((prev) => ({ ...prev, personResponsible: value }))
                }
                placeholder="Who is responsible?"
              />
              <DateField
                label="Due date"
                field="dueDate"
                value={manualDraft.dueDate}
                onChange={(_, value) => setManualDraft((prev) => ({ ...prev, dueDate: value }))}
              />
              <SelectField
                label="Priority"
                field="priority"
                value={manualDraft.priority}
                onChange={(_, value) => setManualDraft((prev) => ({ ...prev, priority: value }))}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'critical', label: 'Critical' },
                ]}
              />
              <label className="field">
                <span className="field__label">Notes</span>
                <textarea
                  className="field__input field__textarea"
                  value={manualDraft.notes}
                  onChange={(e) => setManualDraft((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes..."
                  rows={2}
                />
              </label>
            </FormSection>

            <FormActions>
              {fieldErrors.description && (
                <ValidationMessage variant="summary" messages={[fieldErrors.description]} />
              )}
              <button type="submit" className="submit-btn">
                Save action
              </button>
            </FormActions>
          </form>
        )}

        {statusFilter !== 'completed' && filteredActive.length === 0 ? (
          <p className="actions-register__empty">
            {activeActions.length === 0
              ? 'No open actions. Actions are created automatically from pre-start defects, incident corrective actions, and toolbox controls — or add one manually.'
              : 'No actions match this filter.'}
          </p>
        ) : (
          statusFilter !== 'completed' && (
            <ul className="actions-register__list">
              {filteredActive.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  onUpdate={handleUpdateAction}
                  onComplete={handleCompleteAction}
                  onPrint={setPrintAction}
                  user={user}
                  profile={profile}
                  onArchived={handleActionArchived}
                />
              ))}
            </ul>
          )
        )}
      </section>

      {showCompletedSection && (
        <details className="actions-completed no-print" open={statusFilter === 'completed'}>
          <summary className="actions-completed__summary">
            Completed actions ({filteredCompleted.length})
          </summary>
          <ul className="actions-register__list">
            {filteredCompleted.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onUpdate={handleUpdateAction}
                onComplete={handleCompleteAction}
                onPrint={setPrintAction}
                user={user}
                profile={profile}
                onArchived={handleActionArchived}
              />
            ))}
          </ul>
        </details>
      )}
    </>
  )
}
