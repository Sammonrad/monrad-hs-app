import {
  ACTION_STATUS_LABELS,
  ACTION_PRIORITY_LABELS,
  SOURCE_TYPE_LABELS,
} from '../constants/index.js'
import { isOverdue } from '../utils/storage/actionsStorage.js'
import { formatNzDate, formatSubmittedAt } from '../utils/formatting.js'
import { PrintHeader } from './common/PrintHeader.jsx'

export function PrintableAction({ action }) {
  const overdue = isOverdue(action)

  return (
    <article className="print-record print-action">
      <PrintHeader
        title="Action Register Item"
        meta={SOURCE_TYPE_LABELS[action.sourceType] ?? action.sourceType}
      />

      <section className="print-record__section">
        <h2 className="print-record__section-title">Action details</h2>
        <dl className="print-record__details">
          <div className="print-record__row">
            <dt>Status</dt>
            <dd>
              {ACTION_STATUS_LABELS[action.status] ?? action.status}
              {overdue ? ' — Overdue' : ''}
            </dd>
          </div>
          <div className="print-record__row">
            <dt>Priority</dt>
            <dd>{ACTION_PRIORITY_LABELS[action.priority] ?? action.priority}</dd>
          </div>
          <div className="print-record__row">
            <dt>Date</dt>
            <dd>{formatNzDate(action.date)}</dd>
          </div>
          <div className="print-record__row">
            <dt>Due date</dt>
            <dd>{formatNzDate(action.dueDate)}</dd>
          </div>
          <div className="print-record__row">
            <dt>Site / location</dt>
            <dd>{action.site || '—'}</dd>
          </div>
          <div className="print-record__row">
            <dt>Description</dt>
            <dd>{action.description || '—'}</dd>
          </div>
          <div className="print-record__row">
            <dt>Person responsible</dt>
            <dd>{action.personResponsible || '—'}</dd>
          </div>
          <div className="print-record__row">
            <dt>Notes</dt>
            <dd>{action.notes || '—'}</dd>
          </div>
        </dl>
      </section>

      <footer className="print-record__footer">
        Monrad Earthworx — Action Register — printed{' '}
        {formatSubmittedAt(new Date())}
      </footer>
    </article>
  )
}
