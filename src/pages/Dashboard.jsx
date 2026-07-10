import { useMemo, useState } from 'react'
import { DASHBOARD_GROUPS, DASHBOARD_CARDS } from '../constants/index.js'
import { MonradLogo } from '../components/MonradLogo.jsx'
import { SideMenu } from '../components/SideMenu.jsx'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'

function getDashboardCardClass(cardId) {
  switch (cardId) {
    case 'safety-alerts':
      return 'dashboard-card dashboard-card--alerts'
    case 'help-app-setup':
      return 'dashboard-card dashboard-card--help'
    default:
      return 'dashboard-card'
  }
}

export function Dashboard({ onNavigate, recordCount, openActionCount, profile }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isAdmin = isAdminProfile(profile)
  const cardsById = useMemo(
    () =>
      Object.fromEntries(
        DASHBOARD_CARDS.filter((card) => card.placement === 'mainDashboard')
          .filter((card) => !card.adminOnly || isAdmin)
          .map((card) => [card.id, card]),
      ),
    [isAdmin],
  )

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div className="dashboard__header-bar">
          <button
            type="button"
            className="dashboard__menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="app-side-menu"
          >
            <span className="dashboard__menu-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>

          <div className="dashboard__header-brand">
            <MonradLogo variant="header" />
            <p className="dashboard__tagline">Health &amp; Safety App</p>
          </div>

          <div className="dashboard__header-spacer" aria-hidden="true" />
        </div>
      </header>

      <SideMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={onNavigate}
        profile={profile}
        openActionCount={openActionCount}
      />

      <nav className="dashboard__nav" aria-label="Form types">
        {DASHBOARD_GROUPS.map((group) => {
          const visibleCards = group.cardIds.map((cardId) => cardsById[cardId]).filter(Boolean)

          if (visibleCards.length === 0) return null

          return (
            <div key={group.id} className="dashboard-group-block">
              <section className="dashboard-group" aria-labelledby={`group-${group.id}`}>
                <h2 id={`group-${group.id}`} className="dashboard-group__title">
                  {group.title}
                </h2>
                <div className="dashboard-group__grid">
                  {visibleCards.map((card) => (
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
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )
        })}
      </nav>

      {recordCount > 0 && (
        <p className="dashboard__records-hint">
          {recordCount} saved record{recordCount === 1 ? '' : 's'} on this device
        </p>
      )}

      {openActionCount > 0 && (
        <p className="dashboard__actions-hint">
          {openActionCount} open action{openActionCount === 1 ? '' : 's'} — see Action Register in menu
        </p>
      )}

      <p className="dashboard__cloud-note">Cloud records are linked to the signed-in user.</p>
    </div>
  )
}
