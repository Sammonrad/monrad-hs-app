import { useEffect, useState } from 'react'
import './App.css'
import { Dashboard } from './pages/Dashboard.jsx'
import { AuthView } from './pages/AuthView.jsx'
import { ActionRegisterView } from './pages/ActionRegisterView.jsx'
import { RecordsDashboardView } from './pages/RecordsDashboardView.jsx'
import { SettingsView } from './pages/SettingsView.jsx'
import { BackupRestoreView } from './pages/BackupRestoreView.jsx'
import { JobStartView } from './pages/JobStartView.jsx'
import { PreStartView } from './pages/PreStartView.jsx'
import { ToolboxView } from './pages/ToolboxView.jsx'
import { TimesheetView } from './pages/TimesheetView.jsx'
import { WeeklyTimesheetSummaryView } from './pages/WeeklyTimesheetSummaryView.jsx'
import { IncidentView } from './pages/IncidentView.jsx'
import { PrintableRecord } from './components/PrintableRecord.jsx'
import { loadSavedRecords } from './utils/storage/recordsStorage.js'
import { loadActions, persistActions, syncActionsFromRecord } from './utils/storage/actionsStorage.js'
import { loadSettings } from './utils/storage/settingsStorage.js'
import { APP_VERSION } from './constants/index.js'
import { isSupabaseConfigured, supabase } from './utils/supabaseClient.js'
import { fetchTimesheetRecords } from './utils/storage/timesheetCloudStorage.js'
import { getRoleLabel, isAdminProfile, loadOrCreateProfile } from './utils/storage/userProfileStorage.js'

function App() {
  const [currentView, setCurrentView] = useState('dashboard')
  const [savedRecords, setSavedRecords] = useState(() => loadSavedRecords())
  const [actions, setActions] = useState(() => loadActions())
  const [settings, setSettings] = useState(() => loadSettings())
  const [printRecord, setPrintRecord] = useState(null)
  const [highlightRecordId, setHighlightRecordId] = useState(null)
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [cloudTimesheets, setCloudTimesheets] = useState([])
  const [profile, setProfile] = useState(null)

  const openActionCount = actions.filter((action) => action.status !== 'completed').length

  function goToDashboard() {
    setHighlightRecordId(null)
    setCurrentView('dashboard')
  }

  function handleViewRecord(record) {
    setHighlightRecordId(record.id)
    setCurrentView(record.formType)
  }

  function handleClearHighlight() {
    setHighlightRecordId(null)
  }

  function handleRecordSaved(record) {
    setActions((prev) => {
      const next = syncActionsFromRecord(record, prev)
      if (next.length === prev.length) return prev
      return persistActions(next) ? next : prev
    })
  }

  useEffect(() => {
    if (!printRecord) return undefined

    const timer = window.setTimeout(() => {
      window.print()
    }, 350)

    function handleAfterPrint() {
      setPrintRecord(null)
    }

    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [printRecord])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthReady(true)
      return undefined
    }

    let isMounted = true

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!isMounted) return
      if (error) {
        setAuthError(error.message)
      } else {
        setSession(data.session ?? null)
      }
      setAuthReady(true)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthError('')
      setAuthReady(true)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null)
      setCloudTimesheets([])
      return undefined
    }

    let isMounted = true

    async function loadProfile() {
      const { profile: nextProfile } = await loadOrCreateProfile(session.user)
      if (isMounted) setProfile(nextProfile)
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [session?.user?.id, session?.user?.email])

  useEffect(() => {
    if (!session?.user?.id) {
      setCloudTimesheets([])
      return undefined
    }

    let isMounted = true
    const isAdmin = isAdminProfile(profile)

    async function loadCloudTimesheets() {
      const { records } = await fetchTimesheetRecords(session.user.id, { isAdmin })
      if (isMounted) setCloudTimesheets(records)
    }

    loadCloudTimesheets()

    return () => {
      isMounted = false
    }
  }, [session?.user?.id, profile?.role])

  async function signIn(email, password) {
    if (!supabase) return
    setAuthLoading(true)
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
    setAuthLoading(false)
  }

  async function signUp(email, password) {
    if (!supabase) return
    setAuthLoading(true)
    setAuthError('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setAuthError(error.message)
    } else {
      setAuthError('Check your email to confirm your account if confirmation is enabled.')
    }
    setAuthLoading(false)
  }

  async function signOut() {
    if (!supabase) return
    setAuthLoading(true)
    setAuthError('')
    const { error } = await supabase.auth.signOut()
    if (error) setAuthError(error.message)
    setAuthLoading(false)
  }

  const userEmail = session?.user?.email ?? ''
  const roleLabel = profile ? getRoleLabel(profile) : ''
  const showAuthView = authReady && (!isSupabaseConfigured || !session)

  return (
    <div className="app">
      {!authReady && (
        <section className="auth-card" aria-live="polite">
          <p className="progress">Checking authentication...</p>
        </section>
      )}

      {showAuthView && (
        <AuthView
          onSignIn={signIn}
          onSignUp={signUp}
          isLoading={authLoading}
          errorMessage={authError}
          isConfigMissing={!isSupabaseConfigured}
        />
      )}

      {authReady && session && (
        <>
          <div className="app-auth-meta no-print">
            <div className="app-auth-meta__identity">
              <p className="app-auth-meta__email">{userEmail}</p>
              {roleLabel && <span className="app-auth-meta__role">{roleLabel}</span>}
            </div>
            <button type="button" className="action-btn" onClick={signOut} disabled={authLoading}>
              Sign out
            </button>
          </div>

      {printRecord && (
        <div className="print-area" aria-hidden="true">
          <PrintableRecord record={printRecord} />
        </div>
      )}

      {currentView === 'dashboard' && (
        <Dashboard
          onNavigate={setCurrentView}
          recordCount={savedRecords.length}
          openActionCount={openActionCount}
          savedRecords={savedRecords}
          actions={actions}
          userEmail={userEmail}
          profile={profile}
        />
      )}

      {currentView === 'action-register' && (
        <ActionRegisterView
          onBack={goToDashboard}
          actions={actions}
          setActions={setActions}
        />
      )}

      {currentView === 'records-dashboard' && (
        <RecordsDashboardView
          onBack={goToDashboard}
          onNavigate={setCurrentView}
          savedRecords={savedRecords}
          actions={actions}
          setPrintRecord={setPrintRecord}
          onViewRecord={handleViewRecord}
        />
      )}

      {currentView === 'settings' && (
        <SettingsView onBack={goToDashboard} settings={settings} setSettings={setSettings} />
      )}

      {currentView === 'backup-restore' && <BackupRestoreView onBack={goToDashboard} />}

      {currentView === 'job-start' && (
        <JobStartView
          onBack={goToDashboard}
          savedRecords={savedRecords}
          setSavedRecords={setSavedRecords}
          setPrintRecord={setPrintRecord}
          highlightRecordId={highlightRecordId}
          onClearHighlight={handleClearHighlight}
          settings={settings}
        />
      )}

      {currentView === 'pre-start' && (
        <PreStartView
          onBack={goToDashboard}
          savedRecords={savedRecords}
          setSavedRecords={setSavedRecords}
          setPrintRecord={setPrintRecord}
          onRecordSaved={handleRecordSaved}
          highlightRecordId={highlightRecordId}
          onClearHighlight={handleClearHighlight}
          settings={settings}
        />
      )}

      {currentView === 'toolbox' && (
        <ToolboxView
          onBack={goToDashboard}
          savedRecords={savedRecords}
          setSavedRecords={setSavedRecords}
          setPrintRecord={setPrintRecord}
          onRecordSaved={handleRecordSaved}
          highlightRecordId={highlightRecordId}
          onClearHighlight={handleClearHighlight}
          settings={settings}
        />
      )}

      {currentView === 'timesheet' && (
        <TimesheetView
          onBack={goToDashboard}
          savedRecords={savedRecords}
          setSavedRecords={setSavedRecords}
          setPrintRecord={setPrintRecord}
          highlightRecordId={highlightRecordId}
          onClearHighlight={handleClearHighlight}
          settings={settings}
          user={session?.user ?? null}
          profile={profile}
          cloudTimesheets={cloudTimesheets}
          setCloudTimesheets={setCloudTimesheets}
        />
      )}

      {currentView === 'weekly-timesheet-summary' && (
        <WeeklyTimesheetSummaryView
          onBack={goToDashboard}
          savedRecords={savedRecords}
          cloudTimesheets={cloudTimesheets}
          profile={profile}
          user={session?.user ?? null}
        />
      )}

      {currentView === 'incident' && (
        <IncidentView
          onBack={goToDashboard}
          savedRecords={savedRecords}
          setSavedRecords={setSavedRecords}
          setPrintRecord={setPrintRecord}
          onRecordSaved={handleRecordSaved}
          highlightRecordId={highlightRecordId}
          onClearHighlight={handleClearHighlight}
          settings={settings}
        />
      )}

      {currentView !== 'dashboard' && (
        <footer className="app-footer no-print">
          <p className="app-version app-version--secondary">
            Signed in as {userEmail}
            {roleLabel ? ` · ${roleLabel}` : ''}
          </p>
          <p className="app-version">Monrad Earthworx H&amp;S v{APP_VERSION}</p>
        </footer>
      )}
        </>
      )}
    </div>
  )
}

export default App
