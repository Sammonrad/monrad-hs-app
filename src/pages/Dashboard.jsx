import { useMemo } from 'react'
import { DASHBOARD_GROUPS, DASHBOARD_CARDS, APP_VERSION } from '../constants/index.js'
import { MonradLogo } from '../components/MonradLogo.jsx'
import { getRoleLabel, getStatusLabel, getProfileStatus, isAdminProfile } from '../utils/storage/userProfileStorage.js'

function getDashboardCardClass(cardId) {
  switch (cardId) {
    case 'action-register':
      return 'dashboard-card dashboard-card--register'
    case 'safety-alerts':
      return 'dashboard-card dashboard-card--alerts'
    case 'records-dashboard':
      return 'dashboard-card dashboard-card--records'
    case 'settings':
      return 'dashboard-card dashboard-card--settings'
    case 'backup-restore':
      return 'dashboard-card dashboard-card--backup'
    case 'staff-management':
      return 'dashboard-card dashboard-card--staff'
    case 'help-app-setup':
      return 'dashboard-card dashboard-card--help'
    case 'weekly-timesheet-summary':
      return 'dashboard-card dashboard-card--weekly'
    default:
      return 'dashboard-card'
  }
}

export function Dashboard({ onNavigate, recordCount, openActionCount, userEmail, profile }) {
  const roleLabel = profile ? getRoleLabel(profile) : ''
  const statusLabel = profile ? getStatusLabel(profile) : ''
  const profileStatus = profile ? getProfileStatus(profile) : null
  const isAdmin = isAdminProfile(profile)
  const cardsById = useMemo(
    () =>
      Object.fromEntries(
        DASHBOARD_CARDS.filter((card) => !card.adminOnly || isAdmin).map((card) => [card.id, card]),
      ),
    [isAdmin],
  )

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <MonradLogo variant="header" />
        <p className="dashboard__tagline">Health &amp; Safety App</p>
      </header>

      <nav className="dashboard__nav" aria-label="Form types">
        {DASHBOARD_GROUPS.map((group) => (
          <div key={group.id} className="dashboard-group-block">
            <section className="dashboard-group" aria-labelledby={`group-${group.id}`}>
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
          </div>
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

      <footer className="dashboard__footer">
        {userEmail && (
          <p className="app-version app-version--secondary">
            Signed in as {userEmail}
            {roleLabel ? ` · ${roleLabel}` : ''}
            {statusLabel ? ` · ${statusLabel}` : ''}
          </p>
        )}
        {profile && (
          <div className="dashboard__profile-badges">
            {roleLabel && <span className="app-auth-meta__role">{roleLabel}</span>}
            {statusLabel && (
              <span className={`profile-status profile-status--${profileStatus} profile-status--small`}>
                {statusLabel}
              </span>
            )}
          </div>
        )}
        <p className="dashboard__cloud-note">Cloud records are linked to the signed-in user.</p>
        <p className="app-version">Monrad Earthworx H&amp;S v{APP_VERSION}</p>
      </footer>
    </div>
  )
}
