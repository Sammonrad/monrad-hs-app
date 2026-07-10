import { MonradLogo } from '../MonradLogo.jsx'

export function MobileHeader({ onMenuOpen, menuOpen, pageTitle }) {
  return (
    <header className="mobile-header">
      <div className="mobile-header__bar">
        <button
          type="button"
          className="mobile-header__menu-btn"
          onClick={onMenuOpen}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="app-side-menu"
        >
          <span className="mobile-header__menu-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <div className="mobile-header__brand">
          <MonradLogo variant="header" />
          {pageTitle ? (
            <p className="mobile-header__page-title">{pageTitle}</p>
          ) : (
            <p className="mobile-header__tagline">Health &amp; Safety App</p>
          )}
        </div>

        <div className="mobile-header__spacer" aria-hidden="true" />
      </div>
    </header>
  )
}
