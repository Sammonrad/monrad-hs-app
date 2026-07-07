import { useState } from 'react'
import { TODAY } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { ActionCard } from '../components/ActionCard.jsx'
import { DateField, TextField } from '../components/FormFields.jsx'
import { createRecordId } from '../utils/ids.js'
import {
  persistActions,
  normalizeAction,
  createEmptyManualAction,
} from '../utils/storage/actionsStorage.js'

export function ActionRegisterView({ onBack, actions, setActions }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [manualDraft, setManualDraft] = useState(createEmptyManualAction)
  const [validationError, setValidationError] = useState(null)

  const openActions = actions.filter((action) => action.status !== 'completed')
  const completedActions = actions.filter((action) => action.status === 'completed')

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

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">Action Register</h1>
        <p className="progress" aria-live="polite">
          {openActions.length} open · {completedActions.length} completed
        </p>
      </header>

      <section className="actions-register" aria-labelledby="actions-open-heading">
        <div className="actions-register__toolbar">
          <h2 id="actions-open-heading" className="actions-register__title">
            Open actions
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
                label="Due / follow-up date"
                field="dueDate"
                value={manualDraft.dueDate}
                onChange={(_, value) => setManualDraft((prev) => ({ ...prev, dueDate: value }))}
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

        {openActions.length === 0 ? (
          <p className="actions-register__empty">
            No open actions. Actions are created automatically from pre-start defects, incident
            corrective actions, and toolbox controls — or add one manually.
          </p>
        ) : (
          <ul className="actions-register__list">
            {openActions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onUpdate={handleUpdateAction}
                onComplete={handleCompleteAction}
              />
            ))}
          </ul>
        )}
      </section>

      {completedActions.length > 0 && (
        <details className="actions-completed">
          <summary className="actions-completed__summary">
            Completed actions ({completedActions.length})
          </summary>
          <ul className="actions-register__list">
            {completedActions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onUpdate={handleUpdateAction}
                onComplete={handleCompleteAction}
              />
            ))}
          </ul>
        </details>
      )}
    </>
  )
}
