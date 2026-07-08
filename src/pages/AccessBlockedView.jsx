import { MonradLogo } from '../components/MonradLogo.jsx'

export function AccessBlockedView({ title, message, onSignOut, isLoading }) {
  return (
    <div className="access-blocked-view">
      <header className="dashboard__header">
        <MonradLogo variant="header" />
        <p className="dashboard__tagline">Health &amp; Safety App</p>
      </header>

      <section className="access-blocked-card" aria-labelledby="access-blocked-title">
        <h1 id="access-blocked-title" className="access-blocked-card__title">
          {title}
        </h1>
        <p className="access-blocked-card__message">{message}</p>
        <button
          type="button"
          className="submit-btn access-blocked-card__sign-out"
          onClick={onSignOut}
          disabled={isLoading}
        >
          {isLoading ? 'Signing out…' : 'Sign out'}
        </button>
      </section>
    </div>
  )
}
