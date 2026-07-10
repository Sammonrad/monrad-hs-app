import { useEffect, useMemo } from 'react'
import { SIDEBAR_GROUPS, DASHBOARD_CARDS } from '../constants/index.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'

export function SideMenu({ isOpen, onClose, onNavigate, profile, openActionCount = 0 }) {
  const isAdmin = isAdminProfile(profile)
  const cardsById = useMemo(
    () =>
      Object.fromEntries(
        DASHBOARD_CARDS.filter((card) => card.placement === 'sidebar')
          .filter((card) => !card.adminOnly || isAdmin)
          .map((card) => [card.id, card]),
      ),
    [isAdmin],
  )

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  function handleNavigate(viewId) {
    onNavigate(viewId)
    onClose()
  }

  return (
    <>
      <div
        className={`side-menu__overlay${isOpen ? ' side-menu__overlay--visible' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
        tabIndex={-1}
      />

      <aside
        id="app-side-menu"
        className={`side-menu${isOpen ? ' side-menu--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!isOpen}
      >
        <div className="side-menu__header">
          <h2 className="side-menu__title">Menu</h2>
          <button
            type="button"
            className="side-menu__close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <nav className="side-menu__nav" aria-label="More navigation">
          {SIDEBAR_GROUPS.map((group) => {
            const visibleCards = group.cardIds
              .map((cardId) => cardsById[cardId])
              .filter(Boolean)

            if (visibleCards.length === 0) return null

            return (
              <section key={group.id} className="side-menu__group" aria-labelledby={`side-menu-${group.id}`}>
                <h3 id={`side-menu-${group.id}`} className="side-menu__group-title">
                  {group.title}
                </h3>
                <ul className="side-menu__list">
                  {visibleCards.map((card) => (
                    <li key={card.id}>
                      <button
                        type="button"
                        className="side-menu__item"
                        onClick={() => handleNavigate(card.id)}
                      >
                        <span className="side-menu__item-label">{card.title}</span>
                        {card.id === 'action-register' && openActionCount > 0 && (
                          <span className="side-menu__badge">{openActionCount} open</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
