import {
  ACTION_STATUS_LABELS,
  ACTION_PRIORITY_LABELS,
  SOURCE_TYPE_LABELS,
  ACTION_PRIORITIES,
} from '../constants/index.js'
import { isOverdue } from '../utils/storage/actionsStorage.js'
import { isCriticalAction } from '../utils/safetyAlerts.js'
import { SummaryRow } from './FormFields.jsx'
import { CloudSyncBadge } from './CloudSyncBadge.jsx'
import { exportActionJson, exportActionText } from '../utils/export.js'

export function ActionCard({ action, onUpdate, onComplete, onPrint }) {
  const overdue = isOverdue(action)
  const critical = isCriticalAction(action)
  const serious = action.serious && action.status !== 'completed'
  const cardClass = [
    'action-card',
    action.status === 'completed' ? 'action-card--completed' : '',
    overdue ? 'action-card--overdue' : '',
    critical ? 'action-card--critical' : '',
    serious && !overdue && !critical ? 'action-card--serious' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li className={cardClass} data-action-id={action.id}>
      <div className="action-card__header">
        <span className="type-badge type-badge--small">
          {SOURCE_TYPE_LABELS[action.sourceType] ?? action.sourceType}
        </span>
        <CloudSyncBadge record={action} size="small" />
        <span
          className={`action-priority action-priority--${action.priority}${
            critical ? ' action-priority--critical-open' : ''
          }`}
        >
          {ACTION_PRIORITY_LABELS[action.priority] ?? action.priority}
        </span>
        {action.status !== 'completed' && overdue && (
          <span className="action-card__warning">Overdue</span>
        )}
        {action.status !== 'completed' && !overdue && serious && (
          <span className="action-card__warning">Serious</span>
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
        <SummaryRow label="Due date" value={action.dueDate} />
        <SummaryRow
          label="Priority"
          value={ACTION_PRIORITY_LABELS[action.priority] ?? action.priority}
        />
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

          <label className="field action-card__status-field">
            <span className="field__label">Priority</span>
            <select
              className="field__input"
              value={action.priority}
              onChange={(e) => onUpdate(action.id, { priority: e.target.value })}
            >
              {ACTION_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {ACTION_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </label>

          <label className="field action-card__status-field">
            <span className="field__label">Due date</span>
            <input
              type="date"
              className="field__input"
              value={action.dueDate}
              onChange={(e) => onUpdate(action.id, { dueDate: e.target.value })}
            />
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

      <div className="action-card__actions no-print">
        {onPrint && (
          <button type="button" className="print-record-btn" onClick={() => onPrint(action)}>
            Print action
          </button>
        )}
        <button type="button" className="action-btn" onClick={() => exportActionJson(action)}>
          Export JSON
        </button>
        <button type="button" className="action-btn" onClick={() => exportActionText(action)}>
          Export text
        </button>
      </div>

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
