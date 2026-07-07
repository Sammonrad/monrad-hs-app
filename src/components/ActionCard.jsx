import { ACTION_STATUS_LABELS, SOURCE_TYPE_LABELS } from '../constants/index.js'
import { isOverdue } from '../utils/storage/actionsStorage.js'
import { SummaryRow } from './FormFields.jsx'

export function ActionCard({ action, onUpdate, onComplete }) {
  const overdue = isOverdue(action)
  const serious = action.serious && action.status !== 'completed'
  const cardClass = [
    'action-card',
    action.status === 'completed' ? 'action-card--completed' : '',
    overdue ? 'action-card--overdue' : '',
    serious && !overdue ? 'action-card--serious' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li className={cardClass}>
      <div className="action-card__header">
        <span className="type-badge type-badge--small">
          {SOURCE_TYPE_LABELS[action.sourceType] ?? action.sourceType}
        </span>
        {action.status !== 'completed' && (overdue || serious) && (
          <span className="action-card__warning">{overdue ? 'Overdue' : 'Serious'}</span>
        )}
        <span className={`action-status action-status--${action.status}`}>
          {ACTION_STATUS_LABELS[action.status] ?? action.status}
        </span>
      </div>

      <dl className="action-card__details">
        <SummaryRow label="Date" value={action.date} />
        <SummaryRow label="Site / location" value={action.site} />
        <SummaryRow label="Description" value={action.description} />
        <SummaryRow label="Person responsible" value={action.personResponsible} />
        <SummaryRow label="Due / follow-up" value={action.dueDate} />
      </dl>

      {action.status !== 'completed' && (
        <>
          <label className="field action-card__status-field">
            <span className="field__label">Update status</span>
            <select
              className="field__input"
              value={action.status}
              onChange={(e) => onUpdate(action.id, { status: e.target.value })}
            >
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          <button
            type="button"
            className="action-card__complete-btn"
            onClick={() => onComplete(action.id)}
          >
            Mark as completed
          </button>
        </>
      )}

      <label className="field">
        <span className="field__label">Notes</span>
        <textarea
          className="field__input field__textarea"
          defaultValue={action.notes}
          onBlur={(e) => {
            if (e.target.value !== action.notes) {
              onUpdate(action.id, { notes: e.target.value })
            }
          }}
          rows={2}
          placeholder="Add notes..."
        />
      </label>
    </li>
  )
}
