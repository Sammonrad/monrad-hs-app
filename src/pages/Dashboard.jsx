import { useMemo } from 'react'
import { DASHBOARD_GROUPS, DASHBOARD_CARDS } from '../constants/index.js'
import { getSafetyAlerts } from '../utils/safetyAlerts.js'
import { MonradLogo } from '../components/MonradLogo.jsx'

function getDashboardCardClass(cardId) {
  switch (cardId) {
    case 'action-register':
      return 'dashboard-card dashboard-card--register'
    case 'records-dashboard':
      return 'dashboard-card dashboard-card--records'
    case 'settings':
      return 'dashboard-card dashboard-card--settings'
    case 'backup-restore':
      return 'dashboard-card dashboard-card--backup'
    case 'weekly-timesheet-summary':
      return 'dashboard-card dashboard-card--weekly'
    default:
      return 'dashboard-card'
  }
}

export function Dashboard({ onNavigate, recordCount, openActionCount, savedRecords, actions }) {
  const alerts = getSafetyAlerts(savedRecords ?? [], actions ?? [])
  const cardsById = useMemo(
    () => Object.fromEntries(DASHBOARD_CARDS.map((card) => [card.id, card])),
    [],
  )

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <MonradLogo variant="header" />
        <p className="dashboard__tagline">Health &amp; Safety App</p>
      </header>

      <section className="safety-alerts" aria-labelledby="dashboard-safety-heading">
        <div className="safety-alerts__header">
          <h2 id="dashboard-safety-heading" className="safety-alerts__title">
            Safety alerts
          </h2>
          <button
            type="button"
            className="safety-alerts__link"
            onClick={() => onNavigate('action-register')}
          >
            View action register
          </button>
        </div>
        <dl className="safety-alerts__grid">
          <div className="safety-alerts__item">
            <dt>Open actions</dt>
            <dd>{alerts.openActions}</dd>
          </div>
          <div
            className={`safety-alerts__item${
              alerts.overdueActions > 0 ? ' safety-alerts__item--alert' : ''
            }`}
          >
            <dt>Overdue actions</dt>
            <dd>{alerts.overdueActions}</dd>
          </div>
          <div
            className={`safety-alerts__item${
              alerts.criticalActions > 0 ? ' safety-alerts__item--alert' : ''
            }`}
          >
            <dt>Critical actions</dt>
            <dd>{alerts.criticalActions}</dd>
          </div>
          <div
            className={`safety-alerts__item${
              alerts.unresolvedMachineDefects > 0 ? ' safety-alerts__item--alert' : ''
            }`}
          >
            <dt>Unresolved machine defects</dt>
            <dd>{alerts.unresolvedMachineDefects}</dd>
          </div>
          <div
            className={`safety-alerts__item${
              alerts.unresolvedIncidentActions > 0 ? ' safety-alerts__item--alert' : ''
            }`}
          >
            <dt>Unresolved incident actions</dt>
            <dd>{alerts.unresolvedIncidentActions}</dd>
          </div>
        </dl>
      </section>

      <nav className="dashboard__nav" aria-label="Form types">
        {DASHBOARD_GROUPS.map((group) => (
          <section key={group.id} className="dashboard-group" aria-labelledby={`group-${group.id}`}>
            <h2 id={`group-${group.id}`} className="dashboard-group__title">
              {group.title}
            </h2>
            <div className="dashboard-group__grid">
              {group.cardIds.map((cardId) => {
                const card = cardsById[cardId]
                if (!card) return null

                return (
                  <button
                    key={card.id}
                    type="button"
                    className={getDashboardCardClass(card.id)}
                    onClick={() => onNavigate(card.id)}
                  >
                    <span className="dashboard-card__title">{card.title}</span>
                    {!card.available && (
                      <span className="dashboard-card__badge">Coming soon</span>
                    )}
                    {card.id === 'action-register' && openActionCount > 0 && (
                      <span className="dashboard-card__count">{openActionCount} open</span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </nav>

      {recordCount > 0 && (
        <p className="dashboard__records-hint">
          {recordCount} saved record{recordCount === 1 ? '' : 's'} on this device
        </p>
      )}

      {openActionCount > 0 && (
        <p className="dashboard__actions-hint">
          {openActionCount} open action{openActionCount === 1 ? '' : 's'} in the register
        </p>
      )}

      <p className="coming-soon dashboard__footer">
        Cloud sync &amp; login — coming soon (local storage only for now).
      </p>
    </div>
  )
}
