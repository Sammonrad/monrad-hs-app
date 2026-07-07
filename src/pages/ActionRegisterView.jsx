import { useEffect, useMemo, useState } from 'react'
import { TODAY, DEFAULT_ACTION_PRIORITY, ACTION_REGISTER_FILTERS } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { ActionCard } from '../components/ActionCard.jsx'
import { PrintableAction } from '../components/PrintableAction.jsx'
import { DateField, TextField, SelectField } from '../components/FormFields.jsx'
import { createRecordId } from '../utils/ids.js'
import {
  persistActions,
  normalizeAction,
  createEmptyManualAction,
  isOverdue,
} from '../utils/storage/actionsStorage.js'
import {
  filterActionsByRegisterFilter,
  sortActiveActions,
} from '../utils/safetyAlerts.js'

export function ActionRegisterView({ onBack, actions, setActions }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [manualDraft, setManualDraft] = useState(createEmptyManualAction)
  const [validationError, setValidationError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [printAction, setPrintAction] = useState(null)

  const activeActions = useMemo(
    () => sortActiveActions(actions.filter((action) => action.status !== 'completed')),
    [actions],
  )
  const completedActions = useMemo(
    () => actions.filter((action) => action.status === 'completed'),
    [actions],
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

  function handleUpdateAction(actionId, updates) {
    const next = actions.map((action) =>
      action.id === actionId ? normalizeAction({ ...action, ...updates }) : action,
    )
    updateActions(next)
  }

  function handleCompleteAction(actionId) {
    handleUpdateAction(actionId, { status: 'completed' })
  }

  function handleAddManualAction(event) {
    event.preventDefault()
    if (!manualDraft.description.trim()) {
      setValidationError('Description is required for a new action.')
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
    })

    if (!updateActions([newAction, ...actions])) return
    setManualDraft(createEmptyManualAction())
    setShowAddForm(false)
    setValidationError(null)
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
        </p>
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
              setValidationError(null)
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
            <fieldset className="job-form__fieldset">
              <legend className="job-form__legend">New manual action</legend>
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
              <label className="field">
                <span className="field__label">Description</span>
                <textarea
                  className="field__input field__textarea"
                  value={manualDraft.description}
                  onChange={(e) =>
                    setManualDraft((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe the action required..."
                  rows={3}
                  required
                />
              </label>
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
            </fieldset>

            {validationError && (
              <p className="validation-message" role="alert">
                {validationError}
              </p>
            )}

            <button type="submit" className="submit-btn">
              Save action
            </button>
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
              />
            ))}
          </ul>
        </details>
      )}
    </>
  )
}
