import { useEffect, useState } from 'react'
import './App.css'
import { Dashboard } from './pages/Dashboard.jsx'
import { AuthView } from './pages/AuthView.jsx'
import { ActionRegisterView } from './pages/ActionRegisterView.jsx'
import { RecordsDashboardView } from './pages/RecordsDashboardView.jsx'
import { SettingsView } from './pages/SettingsView.jsx'
import { BackupRestoreView } from './pages/BackupRestoreView.jsx'
import { AccessBlockedView } from './pages/AccessBlockedView.jsx'
import { StaffManagementView } from './pages/StaffManagementView.jsx'
import { AdminReportsView } from './pages/AdminReportsView.jsx'
import { HelpAppSetupView } from './pages/HelpAppSetupView.jsx'
import { SafetyAlertsView } from './pages/SafetyAlertsView.jsx'
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
import {
  getRoleLabel,
  getStatusLabel,
  getProfileStatus,
  isAdminProfile,
  isProfileAccessAllowed,
  loadOrCreateProfile,
  STATUS,
} from './utils/storage/userProfileStorage.js'

function App() {
  const [currentView, setCurrentView] = useState('dashboard')
  const [savedRecords, setSavedRecords] = useState(() => loadSavedRecords())
  const [actions, setActions] = useState(() => loadActions())
  const [settings, setSettings] = useState(() => loadSettings())
  const [printRecord, setPrintRecord] = useState(null)
  const [highlightRecordId, setHighlightRecordId] = useState(null)
  const [highlightActionId, setHighlightActionId] = useState(null)
  const [actionFilter, setActionFilter] = useState(null)
  const [recordFocus, setRecordFocus] = useState(null)
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
  const [profileLoading, setProfileLoading] = useState(false)

  const openActionCount = actions.filter((action) => action.status !== 'completed').length

  function clearNavFocus() {
    setHighlightRecordId(null)
    setHighlightActionId(null)
    setActionFilter(null)
    setRecordFocus(null)
  }

  function goToDashboard() {
    clearNavFocus()
    setCurrentView('dashboard')
  }

  function handleNavigate(viewId, options = {}) {
    setHighlightRecordId(options.highlightRecordId ?? null)
    setHighlightActionId(options.highlightActionId ?? null)
    setActionFilter(options.actionFilter ?? null)
    setRecordFocus(options.recordFocus ?? null)
    setCurrentView(viewId)
  }

  function handleViewRecord(record) {
    setHighlightActionId(null)
    setActionFilter(null)
    setRecordFocus(null)
    setHighlightRecordId(record.id)
    setCurrentView(record.formType)
  }

  function handleClearHighlight() {
    setHighlightRecordId(null)
  }

  function handleClearActionHighlight() {
    setHighlightActionId(null)
  }

  function handleClearRecordFocus() {
    setRecordFocus(null)
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
      setProfileLoading(false)
      setCloudTimesheets([])
      setCloudJobStarts([])
      setCloudPreStarts([])
      setCloudToolboxRecords([])
      setCloudIncidents([])
      setCloudActions([])
      return undefined
    }

    let isMounted = true
    setProfileLoading(true)

    async function loadProfile() {
      const { profile: nextProfile } = await loadOrCreateProfile(session.user)
      if (isMounted) {
        setProfile(nextProfile)
        setProfileLoading(false)
      }
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
  const statusLabel = profile ? getStatusLabel(profile) : ''
  const profileStatus = profile ? getProfileStatus(profile) : null
  const hasAppAccess = profile ? isProfileAccessAllowed(profile) : false
  const showAuthView = authReady && (!isSupabaseConfigured || !session)
  const showProfileLoading = authReady && session && profileLoading
  const showPendingView =
    authReady && session && !profileLoading && profile && !hasAppAccess && profileStatus === STATUS.PENDING
  const showDisabledView =
    authReady && session && !profileLoading && profile && !hasAppAccess && profileStatus === STATUS.DISABLED
  const showMainApp = authReady && session && !profileLoading && hasAppAccess

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

      {showProfileLoading && (
        <section className="auth-card" aria-live="polite">
          <p className="progress">Loading your profile…</p>
        </section>
      )}

      {showPendingView && (
        <AccessBlockedView
          title="Account pending approval"
          message="Your account is pending approval. Please contact Sam Monrad."
          onSignOut={signOut}
          isLoading={authLoading}
        />
      )}

      {showDisabledView && (
        <AccessBlockedView
          title="Account disabled"
          message="Your account has been disabled. Please contact Sam Monrad."
          onSignOut={signOut}
          isLoading={authLoading}
        />
      )}

      {showMainApp && (
        <>
      {printRecord && (
        <div className="print-area" aria-hidden="true">
          <PrintableRecord record={printRecord} />
        </div>
      )}

      {currentView === 'dashboard' && (
        <Dashboard
          onNavigate={handleNavigate}
          recordCount={savedRecords.length}
          openActionCount={openActionCount}
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
          highlightActionId={highlightActionId}
          onClearActionHighlight={handleClearActionHighlight}
          initialActionFilter={actionFilter}
        />
      )}

      {currentView === 'safety-alerts' && (
        <SafetyAlertsView
          onBack={goToDashboard}
          onNavigate={handleNavigate}
          savedRecords={savedRecords}
          actions={actions}
        />
      )}

      {currentView === 'records-dashboard' && (
        <RecordsDashboardView
          onBack={goToDashboard}
          onNavigate={handleNavigate}
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

      {currentView === 'help-app-setup' && (
        <HelpAppSetupView onBack={goToDashboard} profile={profile} />
      )}

      {currentView === 'staff-management' && (
        <StaffManagementView
          onBack={goToDashboard}
          profile={profile}
          onProfileUpdated={setProfile}
        />
      )}

      {currentView === 'admin-reports' && (
        <AdminReportsView
          onBack={goToDashboard}
          user={session?.user ?? null}
          profile={profile}
        />
      )}

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
          recordFocus={recordFocus}
          onClearRecordFocus={handleClearRecordFocus}
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
          recordFocus={recordFocus}
          onClearRecordFocus={handleClearRecordFocus}
          settings={settings}
          user={session?.user ?? null}
          profile={profile}
          cloudIncidents={cloudIncidents}
          setCloudIncidents={setCloudIncidents}
        />
      )}

      <footer className="app-footer no-print" aria-label="Account">
        <div className="app-footer__account">
          {userEmail && (
            <p className="app-footer__line">
              <span className="app-footer__label">Signed in as</span>{' '}
              <span className="app-footer__value">{userEmail}</span>
            </p>
          )}
          {roleLabel && (
            <p className="app-footer__line">
              <span className="app-footer__label">Role</span>{' '}
              <span
                className={`type-badge type-badge--small type-badge--role-${profile?.role ?? 'staff'}`}
              >
                {roleLabel}
              </span>
            </p>
          )}
          {statusLabel && (
            <p className="app-footer__line">
              <span className="app-footer__label">Status</span>{' '}
              <span
                className={`profile-status profile-status--${profileStatus} profile-status--small`}
              >
                {statusLabel}
              </span>
            </p>
          )}
          <button
            type="button"
            className="app-footer__sign-out"
            onClick={signOut}
            disabled={authLoading}
          >
            {authLoading ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
        <p className="app-version">Monrad Earthworx H&amp;S v{APP_VERSION}</p>
      </footer>
        </>
      )}
    </div>
  )
}

export default App
