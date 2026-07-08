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
import { loadActions, persistActions, syncActionsFromRecord, patchAction } from './utils/storage/actionsStorage.js'
import { loadSettings } from './utils/storage/settingsStorage.js'
import { APP_VERSION } from './constants/index.js'
import { isSupabaseConfigured, supabase } from './utils/supabaseClient.js'
import { fetchTimesheetRecords } from './utils/storage/timesheetCloudStorage.js'
import { fetchJobStartRecords } from './utils/storage/jobStartCloudStorage.js'
import { fetchPreStartRecords } from './utils/storage/preStartCloudStorage.js'
import { fetchToolboxRecords } from './utils/storage/toolboxCloudStorage.js'
import { fetchIncidentRecords } from './utils/storage/incidentCloudStorage.js'
import {
  fetchActionRecords,
  saveActionRecord,
  getMergedActions,
  SYNC_STATUS,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
} from './utils/storage/actionCloudStorage.js'
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
  const [cloudJobStarts, setCloudJobStarts] = useState([])
  const [cloudPreStarts, setCloudPreStarts] = useState([])
  const [cloudToolboxRecords, setCloudToolboxRecords] = useState([])
  const [cloudIncidents, setCloudIncidents] = useState([])
  const [cloudActions, setCloudActions] = useState([])
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
      if (!persistActions(next)) return prev

      const newAction = next.find(
        (action) =>
          !prev.some((existing) => existing.id === action.id) &&
          action.autoCreated &&
          action.sourceRecordId === record.id &&
          action.sourceType === record.formType,
      )

      if (newAction) {
        pushActionToCloud(newAction)
      }

      return next
    })
  }

  async function pushActionToCloud(action) {
    if (isCloudSaveUnavailable(session?.user)) {
      setActions((prev) => {
        const syncStatus = getUnavailableSyncStatus(session?.user)
        const next = patchAction(prev, action.id, { syncStatus })
        persistActions(next)
        return next
      })
      return
    }

    const { record: cloudRecord, error } = await saveActionRecord(session.user, action)

    if (error) {
      setActions((prev) => {
        const next = patchAction(prev, action.id, { syncStatus: SYNC_STATUS.CLOUD_FAILED })
        persistActions(next)
        return next
      })
      return
    }

    if (cloudRecord) {
      setActions((prev) => {
        const next = patchAction(prev, action.id, {
          syncStatus: SYNC_STATUS.CLOUD,
          cloudId: cloudRecord.cloudId,
          cloudUserId: cloudRecord.cloudUserId,
          storageSource: 'both',
        })
        persistActions(next)
        return next
      })
      setCloudActions((prev) => {
        const withoutDup = prev.filter(
          (item) => item.cloudId !== cloudRecord.cloudId && item.id !== action.id,
        )
        return [cloudRecord, ...withoutDup]
      })
    }
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
      setCloudJobStarts([])
      setCloudPreStarts([])
      setCloudToolboxRecords([])
      setCloudIncidents([])
      setCloudActions([])
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
      setCloudJobStarts([])
      setCloudPreStarts([])
      setCloudToolboxRecords([])
      setCloudIncidents([])
      setCloudActions([])
      return undefined
    }

    let isMounted = true
    const isAdmin = isAdminProfile(profile)

    async function loadCloudTimesheets() {
      const { records } = await fetchTimesheetRecords(session.user.id, { isAdmin })
      if (isMounted) setCloudTimesheets(records)
    }

    async function loadCloudJobStarts() {
      const { records } = await fetchJobStartRecords(session.user.id, { isAdmin })
      if (isMounted) setCloudJobStarts(records)
    }

    async function loadCloudPreStarts() {
      const { records } = await fetchPreStartRecords(session.user.id, { isAdmin })
      if (isMounted) setCloudPreStarts(records)
    }

    async function loadCloudToolboxRecords() {
      const { records } = await fetchToolboxRecords(session.user.id, { isAdmin })
      if (isMounted) setCloudToolboxRecords(records)
    }

    async function loadCloudIncidents() {
      const { records } = await fetchIncidentRecords(session.user.id, { isAdmin })
      if (isMounted) setCloudIncidents(records)
    }

    async function loadCloudActionRecords() {
      const { records } = await fetchActionRecords(session.user.id, { isAdmin })
      if (isMounted) setCloudActions(records)
    }

    loadCloudTimesheets()
    loadCloudJobStarts()
    loadCloudPreStarts()
    loadCloudToolboxRecords()
    loadCloudIncidents()
    loadCloudActionRecords()

    return () => {
      isMounted = false
    }
  }, [session?.user?.id, profile?.role])

  useEffect(() => {
    if (!session?.user?.id) return undefined

    setActions((prev) => {
      const merged = getMergedActions(prev, cloudActions)
      const changed =
        merged.length !== prev.length ||
        merged.some(
          (action, index) =>
            action.cloudId !== prev[index]?.cloudId || action.id !== prev[index]?.id,
        )
      if (changed) {
        persistActions(merged)
        return merged
      }
      return prev
    })
  }, [cloudActions, session?.user?.id])

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
          user={session?.user ?? null}
          profile={profile}
          cloudActions={cloudActions}
          setCloudActions={setCloudActions}
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
          user={session?.user ?? null}
          profile={profile}
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
          user={session?.user ?? null}
          profile={profile}
          cloudJobStarts={cloudJobStarts}
          setCloudJobStarts={setCloudJobStarts}
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
          user={session?.user ?? null}
          profile={profile}
          cloudPreStarts={cloudPreStarts}
          setCloudPreStarts={setCloudPreStarts}
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
          user={session?.user ?? null}
          profile={profile}
          cloudToolboxRecords={cloudToolboxRecords}
          setCloudToolboxRecords={setCloudToolboxRecords}
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
          user={session?.user ?? null}
          profile={profile}
          cloudIncidents={cloudIncidents}
          setCloudIncidents={setCloudIncidents}
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
