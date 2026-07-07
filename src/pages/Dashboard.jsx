import { DASHBOARD_CARDS } from '../constants/index.js'

export function Dashboard({ onNavigate, recordCount, openActionCount }) {
  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <p className="dashboard__company">Monrad Earthworx</p>
        <h1 className="dashboard__title">Monrad Earthworx H&amp;S App</h1>
        <p className="dashboard__subtitle">Health &amp; safety forms for the field</p>
      </header>

      <nav className="dashboard__nav" aria-label="Form types">
        {DASHBOARD_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            className={
              card.id === 'action-register'
                ? 'dashboard-card dashboard-card--register'
                : card.id === 'records-dashboard'
                  ? 'dashboard-card dashboard-card--records'
                : card.id === 'settings'
                  ? 'dashboard-card dashboard-card--settings'
                  : card.id === 'backup-restore'
                    ? 'dashboard-card dashboard-card--backup'
                    : card.id === 'weekly-timesheet-summary'
                      ? 'dashboard-card dashboard-card--weekly'
                      : 'dashboard-card'
            }
            onClick={() => onNavigate(card.id)}
          >
            <span className="dashboard-card__title">{card.title}</span>
            <span className="dashboard-card__description">{card.description}</span>
            {!card.available && <span className="dashboard-card__badge">Coming soon</span>}
            {card.id === 'action-register' && openActionCount > 0 && (
              <span className="dashboard-card__count">{openActionCount} open</span>
            )}
          </button>
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
