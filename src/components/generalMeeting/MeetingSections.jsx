import { ACTION_PRIORITIES, ACTION_PRIORITY_LABELS, ACTION_STATUS_LABELS } from '../../constants/index.js'
import { createEmptyMeetingAction, createEmptyPreviousAction } from '../../utils/storage/generalMeetingStorage.js'
import { formatNzDate } from '../../utils/formatting.js'

function ActionRowList({ items, onChange, readOnly = false, type = 'new' }) {
  const list = Array.isArray(items) ? items : []

  function updateItem(index, key, value) {
    onChange(list.map((item, i) => (i === index ? { ...item, [key]: value } : item)))
  }

  function addItem() {
    const empty = type === 'previous' ? createEmptyPreviousAction() : createEmptyMeetingAction()
    onChange([...list, empty])
  }

  function removeItem(index) {
    onChange(list.filter((_, i) => i !== index))
  }

  if (readOnly) {
    return (
      <div className="gm-action-rows">
        {list.length === 0 && <p className="gm-action-rows__empty">None recorded.</p>}
        {list.map((item, index) => (
          <div key={item.id ?? index} className="gm-action-rows__item gm-action-rows__item--readonly">
            {type === 'previous' ? (
              <p><strong>{item.description || '—'}</strong>{item.progress ? ` — ${item.progress}` : ''}</p>
            ) : (
              <p>
                {item.description || '—'} · {item.personResponsible || 'Unassigned'} · {item.dueDate ? formatNzDate(item.dueDate) : 'No due date'}
              </p>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="gm-action-rows">
      {list.map((item, index) => (
        <div key={item.id ?? index} className="gm-action-rows__item">
          <div className="gm-action-rows__header">
            <span>Item {index + 1}</span>
            <button type="button" className="btn btn--secondary btn--small" onClick={() => removeItem(index)}>
              Remove
            </button>
          </div>
          {type === 'previous' ? (
            <>
              <label className="field">
                <span className="field__label">Action / item</span>
                <input className="field__input" value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">Progress</span>
                <textarea className="field__input field__textarea" rows={2} value={item.progress} onChange={(e) => updateItem(index, 'progress', e.target.value)} />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                <span className="field__label">Description</span>
                <textarea className="field__input field__textarea" rows={2} value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} />
              </label>
              <div className="gm-action-rows__grid">
                <label className="field">
                  <span className="field__label">Responsible person</span>
                  <input className="field__input" value={item.personResponsible} onChange={(e) => updateItem(index, 'personResponsible', e.target.value)} />
                </label>
                <label className="field">
                  <span className="field__label">Priority</span>
                  <select className="field__input" value={item.priority} onChange={(e) => updateItem(index, 'priority', e.target.value)}>
                    {ACTION_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>{ACTION_PRIORITY_LABELS[priority]}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Due date</span>
                  <input type="date" className="field__input" value={item.dueDate} onChange={(e) => updateItem(index, 'dueDate', e.target.value)} />
                </label>
                <label className="field">
                  <span className="field__label">Status</span>
                  <select className="field__input" value={item.status} onChange={(e) => updateItem(index, 'status', e.target.value)}>
                    {Object.entries(ACTION_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}
        </div>
      ))}
      <button type="button" className="btn btn--secondary" onClick={addItem}>
        {type === 'previous' ? 'Add previous action' : 'Add new action'}
      </button>
    </div>
  )
}

export function MeetingPreviousActionRows(props) {
  return <ActionRowList {...props} type="previous" />
}

export function MeetingNewActionRows(props) {
  return <ActionRowList {...props} type="new" />
}

export function MeetingDetailSections({ meeting, readOnly = true }) {
  return (
    <div className="gm-detail-sections">
      <section className="gm-detail-section">
        <h3>Previous actions and progress</h3>
        <MeetingPreviousActionRows items={meeting.previousActions} readOnly={readOnly} onChange={() => {}} />
      </section>
      <section className="gm-detail-section">
        <h3>Incidents and near misses since previous meeting</h3>
        <p>{meeting.incidentsSinceLast || '—'}</p>
      </section>
      <section className="gm-detail-section">
        <h3>New hazards and critical risks</h3>
        <p>{meeting.newHazardsAndRisks || '—'}</p>
      </section>
      <section className="gm-detail-section">
        <h3>Machine defects and maintenance concerns</h3>
        <p>{meeting.machineDefectsMaintenance || '—'}</p>
      </section>
      <section className="gm-detail-section">
        <h3>Training, licence and competency updates</h3>
        <p>{meeting.trainingCompetency || '—'}</p>
      </section>
      <section className="gm-detail-section">
        <h3>Worker concerns and suggestions</h3>
        <p>{meeting.workerConcerns || '—'}</p>
      </section>
      <section className="gm-detail-section">
        <h3>Policies or procedures reviewed</h3>
        <p>{meeting.policiesReviewed || '—'}</p>
      </section>
      <section className="gm-detail-section">
        <h3>Upcoming work and safety considerations</h3>
        <p>{meeting.upcomingWork || '—'}</p>
      </section>
      <section className="gm-detail-section">
        <h3>General discussion and notes</h3>
        <p>{meeting.generalDiscussion || '—'}</p>
      </section>
      <section className="gm-detail-section">
        <h3>New actions</h3>
        <MeetingNewActionRows items={meeting.newActions} readOnly={readOnly} onChange={() => {}} />
      </section>
      <section className="gm-detail-section">
        <h3>Next meeting and sign-off</h3>
        <p><strong>Next meeting:</strong> {formatNzDate(meeting.nextMeetingDate)}</p>
        <p><strong>Attendee acknowledgement:</strong> {meeting.attendeeSignOff || '—'}</p>
      </section>
    </div>
  )
}
