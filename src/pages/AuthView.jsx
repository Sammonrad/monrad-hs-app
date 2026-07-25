import { useState } from 'react'
import { MonradLogo } from '../components/MonradLogo.jsx'

export function AuthView({ onSignIn, onSignUp, isLoading, errorMessage, isConfigMissing }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(action) {
    if (!email || !password || isLoading || isConfigMissing) return
    await action(email.trim(), password)
  }

  return (
    <div className="auth-view">
      <header className="dashboard__header">
        <MonradLogo variant="header" />
        <p className="dashboard__tagline">Health &amp; Safety App</p>
      </header>

      <section className="auth-card" aria-labelledby="auth-title">
        <h1 id="auth-title" className="auth-card__title">
          Sign in
        </h1>
        <p className="auth-card__subtitle">
          Sign in with your Supabase Auth email and password. Cloud sync only works while you have an
          active session. Local device saves still work offline as a fallback.
        </p>

        {isConfigMissing && (
          <p className="validation-message">
            Supabase configuration missing. Set VITE_SUPABASE_URL and
            VITE_SUPABASE_PUBLISHABLE_KEY in your environment (never use the service-role key in the app).
          </p>
        )}

        {!isConfigMissing && (
          <p className="auth-card__hint">
            If Auth has no users yet, create one here with Sign up, or in the Supabase dashboard
            (Authentication → Users). The first admin must set <code>user_profiles.role = admin</code>.
          </p>
        )}

        {errorMessage && <p className="validation-message">{errorMessage}</p>}

        <label className="field" htmlFor="auth-email">
          <span className="field__label">Email</span>
          <input
            id="auth-email"
            className="field__input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isLoading || isConfigMissing}
            required
          />
        </label>

        <label className="field" htmlFor="auth-password">
          <span className="field__label">Password</span>
          <input
            id="auth-password"
            className="field__input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isLoading || isConfigMissing}
            required
          />
        </label>

        <div className="auth-card__actions">
          <button
            type="button"
            className="submit-btn"
            onClick={() => handleSubmit(onSignIn)}
            disabled={isLoading || isConfigMissing}
          >
            {isLoading ? 'Working...' : 'Sign in'}
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={() => handleSubmit(onSignUp)}
            disabled={isLoading || isConfigMissing}
          >
            Sign up
          </button>
        </div>
      </section>
    </div>
  )
}
