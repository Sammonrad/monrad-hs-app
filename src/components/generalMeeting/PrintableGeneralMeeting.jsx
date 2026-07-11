import { MonradLogo } from '../MonradLogo.jsx'
import {
  MEETING_TYPE_LABELS,
  MEETING_STATUS_LABELS,
  getMeetingDisplayTitle,
} from '../../constants/generalMeetingConfig.js'
import { ACTION_PRIORITY_LABELS, ACTION_STATUS_LABELS } from '../../constants/index.js'

function Section({ title, children }) {
  if (!children) return null
  return (
    <section className="print-general-meeting__section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function TextBlock({ value }) {
  if (!value?.trim()) return <p>—</p>
  return <p className="print-general-meeting__text">{value}</p>
}

export function PrintableGeneralMeeting({ meeting }) {
  const generated = new Date().toLocaleString('en-NZ')

  return (
    <article className="print-general-meeting">
      <header className="print-general-meeting__header">
        <MonradLogo variant="print" />
        <h1 className="print-general-meeting__title">H&amp;S General Meeting</h1>
        <p className="print-general-meeting__subtitle">{getMeetingDisplayTitle(meeting)}</p>
        <p className="print-general-meeting__meta">Generated: {generated}</p>
      </header>

      <Section title="Meeting details">
        <dl className="print-general-meeting__dl">
          <div><dt>Date</dt><dd>{meeting.meetingDate || '—'}</dd></div>
          <div><dt>Time</dt><dd>{meeting.meetingTime || '—'}</dd></div>
          <div><dt>Location</dt><dd>{meeting.location || '—'}</dd></div>
          <div><dt>Type</dt><dd>{MEETING_TYPE_LABELS[meeting.meetingType] || meeting.meetingType || '—'}</dd></div>
          <div><dt>Status</dt><dd>{MEETING_STATUS_LABELS[meeting.status] || meeting.status || '—'}</dd></div>
          <div><dt>Chairperson</dt><dd>{meeting.chairperson || '—'}</dd></div>
          <div><dt>Attendees</dt><dd>{meeting.attendees || '—'}</dd></div>
          <div><dt>Absentees</dt><dd>{meeting.absentees || '—'}</dd></div>
        </dl>
      </Section>

      <Section title="Previous actions and progress">
        {(meeting.previousActions ?? []).length === 0 ? (
          <TextBlock value="" />
        ) : (
          <ul>
            {meeting.previousActions.map((item) => (
              <li key={item.id}>
                <strong>{item.description || 'Action'}</strong>
                {item.progress ? ` — ${item.progress}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Incidents and near misses since previous meeting">
        <TextBlock value={meeting.incidentsSinceLast} />
      </Section>

      <Section title="New hazards and critical risks">
        <TextBlock value={meeting.newHazardsAndRisks} />
      </Section>

      <Section title="Machine defects and maintenance concerns">
        <TextBlock value={meeting.machineDefectsMaintenance} />
      </Section>

      <Section title="Training, licence and competency updates">
        <TextBlock value={meeting.trainingCompetency} />
      </Section>

      <Section title="Worker concerns and suggestions">
        <TextBlock value={meeting.workerConcerns} />
      </Section>

      <Section title="Policies or procedures reviewed">
        <TextBlock value={meeting.policiesReviewed} />
      </Section>

      <Section title="Upcoming work and safety considerations">
        <TextBlock value={meeting.upcomingWork} />
      </Section>

      <Section title="General discussion and notes">
        <TextBlock value={meeting.generalDiscussion} />
      </Section>

      <Section title="New actions">
        {(meeting.newActions ?? []).length === 0 ? (
          <TextBlock value="" />
        ) : (
          <table className="print-general-meeting__table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Responsible</th>
                <th>Priority</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {meeting.newActions.map((action) => (
                <tr key={action.id}>
                  <td>{action.description || '—'}</td>
                  <td>{action.personResponsible || '—'}</td>
                  <td>{ACTION_PRIORITY_LABELS[action.priority] || action.priority}</td>
                  <td>{action.dueDate || '—'}</td>
                  <td>{ACTION_STATUS_LABELS[action.status] || action.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Next meeting and sign-off">
        <dl className="print-general-meeting__dl">
          <div><dt>Next meeting date</dt><dd>{meeting.nextMeetingDate || '—'}</dd></div>
          <div><dt>Attendee acknowledgement / sign-off</dt><dd>{meeting.attendeeSignOff || '—'}</dd></div>
        </dl>
      </Section>
    </article>
  )
}
