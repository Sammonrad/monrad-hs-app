import { useMemo } from 'react'
import { DASHBOARD_GROUPS, DASHBOARD_CARDS } from '../constants/index.js'
import { getSafetyAlerts } from '../utils/safetyAlerts.js'
import { MonradLogo } from '../components/MonradLogo.jsx'

function DashboardCardIcon({ cardId }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  switch (cardId) {
    case 'job-start':
      return (
        <svg {...common}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h6" />
        </svg>
      )
    case 'pre-start':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
        </svg>
      )
    case 'toolbox':
      return (
        <svg {...common}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'incident':
      return (
        <svg {...common}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      )
    case 'timesheet':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )
    case 'weekly-timesheet-summary':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
        </svg>
      )
    case 'action-register':
      return (
        <svg {...common}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      )
    case 'records-dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    case 'backup-restore':
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      )
  }
}

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
                    <span className="dashboard-card__icon" aria-hidden="true">
                      <DashboardCardIcon cardId={card.id} />
                    </span>
                    <span className="dashboard-card__body">
                      <span className="dashboard-card__title">{card.title}</span>
                      <span className="dashboard-card__description">{card.description}</span>
                      {!card.available && (
                        <span className="dashboard-card__badge">Coming soon</span>
                      )}
                      {card.id === 'action-register' && openActionCount > 0 && (
                        <span className="dashboard-card__count">{openActionCount} open</span>
                      )}
                    </span>
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
