import { BackButton } from '../components/BackButton.jsx'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'

export function HelpAppSetupView({ onBack, profile }) {
  const isAdmin = isAdminProfile(profile)

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">Help / App Setup</h1>
        <p className="progress">Install the app, get started, and learn how it works</p>
      </header>

      <section className="help-section" aria-labelledby="help-iphone-heading">
        <h2 id="help-iphone-heading" className="help-section__title">
          How to install on iPhone
        </h2>
        <ol className="help-steps">
          <li>Open this app in <strong>Safari</strong> (not another browser).</li>
          <li>Tap the <strong>Share</strong> button at the bottom of the screen.</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          <li>
            Name the app <strong>Monrad H&amp;S</strong>, then tap <strong>Add</strong>.
          </li>
        </ol>
      </section>

      <section className="help-section" aria-labelledby="help-android-heading">
        <h2 id="help-android-heading" className="help-section__title">
          How to install on Android
        </h2>
        <ol className="help-steps">
          <li>Open this app in <strong>Chrome</strong>.</li>
          <li>Tap the <strong>three dots</strong> menu (top right).</li>
          <li>
            Tap <strong>Add to Home Screen</strong> or <strong>Install App</strong>.
          </li>
          <li>Confirm when prompted — the app icon will appear on your home screen.</li>
        </ol>
      </section>

      <section className="help-section" aria-labelledby="help-usage-heading">
        <h2 id="help-usage-heading" className="help-section__title">
          How to use the app
        </h2>
        <div className="help-section__text">
          <p>
            <strong>Sign in</strong> with your email and password. Once your account is approved,
            you will see the dashboard with all available forms.
          </p>
          <p>Complete forms on site as required:</p>
          <ul className="help-list">
            <li>
              <strong>Job Start</strong> — at the start of each job or site visit; confirms hazards,
              PPE, and site readiness.
            </li>
            <li>
              <strong>Pre-Start</strong> — before operating a machine each day; checks fluids, tyres,
              leaks, and safety items.
            </li>
            <li>
              <strong>Toolbox</strong> — at the start of the day or before new work; briefs the team on
              hazards and controls.
            </li>
            <li>
              <strong>Incident / Near Miss</strong> — whenever something happens or nearly happens;
              record details and actions taken.
            </li>
            <li>
              <strong>Timesheet</strong> — at the end of each day; records hours, work completed, and
              any delays or safety issues.
            </li>
          </ul>
        </div>
      </section>

      <section className="help-section" aria-labelledby="help-approval-heading">
        <h2 id="help-approval-heading" className="help-section__title">
          Account approval
        </h2>
        <div className="help-section__text">
          <p>
            New accounts are <strong>pending approval</strong> until an admin activates them. If you
            see a pending message after signing in, please contact <strong>Sam Monrad</strong> to
            request access.
          </p>
          <p>
            If your account has been <strong>disabled</strong>, you will not be able to use the app.
            Contact Sam Monrad if you believe this is an error.
          </p>
        </div>
      </section>

      <section className="help-section" aria-labelledby="help-data-heading">
        <h2 id="help-data-heading" className="help-section__title">
          Data note
        </h2>
        <div className="help-section__text">
          <p>
            Cloud records are linked to your signed-in user account. Some data is also stored on this
            device in your browser.
          </p>
          <p>
            Use <strong>Backup / Restore</strong> on the dashboard to download a copy of your local
            data. Tell <strong>Sam</strong> before clearing browser data or changing devices so nothing
            important is lost.
          </p>
        </div>
      </section>

      {isAdmin && (
        <section className="help-section help-section--admin" aria-labelledby="help-admin-heading">
          <h2 id="help-admin-heading" className="help-section__title">
            Admin tasks
          </h2>
          <ul className="help-list">
            <li>
              <strong>Approve users</strong> in Staff Management — set new accounts to Active when
              ready.
            </li>
            <li>
              <strong>Keep backups</strong> — download regular backups from Backup / Restore.
            </li>
            <li>
              <strong>Check Records Dashboard</strong> — review submitted forms across the team.
            </li>
            <li>
              <strong>Review Action Register</strong> — follow up on open, overdue, and critical
              actions.
            </li>
          </ul>
        </section>
      )}
    </>
  )
}
