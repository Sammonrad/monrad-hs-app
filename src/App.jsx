import { useEffect, useMemo, useRef, useState } from 'react'
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
import { CriticalRisksView } from './pages/CriticalRisksView.jsx'
import { VisitorSignInView } from './pages/VisitorSignInView.jsx'
import { SsspDashboardView } from './pages/SsspDashboardView.jsx'
import { SsspEditorView } from './pages/SsspEditorView.jsx'
import { SsspAcknowledgementView } from './pages/SsspAcknowledgementView.jsx'
import { EquipmentView } from './pages/EquipmentView.jsx'
import { EquipmentProfileView } from './pages/EquipmentProfileView.jsx'
import { GeneralMeetingView } from './pages/GeneralMeetingView.jsx'
import { PrintableRecord } from './components/PrintableRecord.jsx'
import { loadSavedRecords } from './utils/storage/recordsStorage.js'
import { loadActions, persistActions, syncActionsFromRecord, syncActionsFromGeneralMeeting, patchAction } from './utils/storage/actionsStorage.js'
import { loadMeetings } from './utils/storage/generalMeetingStorage.js'
import { loadSettings } from './utils/storage/settingsStorage.js'
import { loadVisitorRecords, persistVisitorRecords } from './utils/storage/visitorSignInStorage.js'
import { AppShell } from './components/layout/AppShell.jsx'
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
  fetchVisitorSignInRecords,
  getMergedVisitorRecords,
} from './utils/storage/visitorSignInCloudStorage.js'
import { fetchSsspRecords } from './utils/storage/ssspCloudStorage.js'
import { fetchEquipmentRecords, loadLocalEquipmentRecords, getMergedEquipmentRecords } from './utils/storage/equipmentCloudStorage.js'
import { fetchServiceRecords, loadLocalServiceRecords, getMergedServiceRecords } from './utils/storage/equipmentServiceCloudStorage.js'
import { fetchDocumentRecords, loadLocalDocumentRecords, getMergedDocumentRecords } from './utils/storage/equipmentDocumentCloudStorage.js'
import {
  fetchDefectRecords,
  loadLocalDefectRecords,
} from './utils/storage/equipmentDefectStorage.js'
import { fetchGeneralMeetingRecords } from './utils/storage/generalMeetingCloudStorage.js'
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
  const [returnView, setReturnView] = useState(null)
  const [savedRecords, setSavedRecords] = useState(() => loadSavedRecords())
  const [actions, setActions] = useState(() => loadActions())
  const [visitorRecords, setVisitorRecords] = useState(() => loadVisitorRecords())
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
  const [cloudVisitorRecords, setCloudVisitorRecords] = useState([])
  const [cloudSsspRecords, setCloudSsspRecords] = useState([])
  const [ssspLoadError, setSsspLoadError] = useState(null)
  const [ssspLoading, setSsspLoading] = useState(false)
  const [ssspNavOptions, setSsspNavOptions] = useState({})
  const [equipmentNavOptions, setEquipmentNavOptions] = useState({})
  const [cloudEquipment, setCloudEquipment] = useState([])
  const [localEquipment, setLocalEquipment] = useState(() => loadLocalEquipmentRecords())
  const [cloudServiceRecords, setCloudServiceRecords] = useState([])
  const [localServiceRecords, setLocalServiceRecords] = useState(() => loadLocalServiceRecords())
  const [cloudDocumentRecords, setCloudDocumentRecords] = useState([])
  const [localDocumentRecords, setLocalDocumentRecords] = useState(() => loadLocalDocumentRecords())
  const [cloudDefectRecords, setCloudDefectRecords] = useState([])
  const [localDefectRecords, setLocalDefectRecords] = useState(() => loadLocalDefectRecords())
  const [generalMeetings, setGeneralMeetings] = useState(() => loadMeetings())
  const [cloudGeneralMeetings, setCloudGeneralMeetings] = useState([])
  const [generalMeetingNavOptions, setGeneralMeetingNavOptions] = useState({})
  const [printContent, setPrintContent] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const prevShowMainAppRef = useRef(false)

  const mergedEquipment = useMemo(
    () => getMergedEquipmentRecords(localEquipment, cloudEquipment, { includeArchived: true }),
    [localEquipment, cloudEquipment],
  )
  const mergedServiceRecords = useMemo(
    () => getMergedServiceRecords(localServiceRecords, cloudServiceRecords),
    [localServiceRecords, cloudServiceRecords],
  )
  const mergedDocumentRecords = useMemo(
    () => getMergedDocumentRecords(localDocumentRecords, cloudDocumentRecords),
    [localDocumentRecords, cloudDocumentRecords],
  )

  const openActionCount = actions.filter((action) => action.status !== 'completed').length

  function clearNavFocus() {
    setHighlightRecordId(null)
    setHighlightActionId(null)
    setActionFilter(null)
    setRecordFocus(null)
  }

  function resetAppNavigationState() {
    clearNavFocus()
    setReturnView(null)
    setCurrentView('dashboard')
    setSsspNavOptions({})
    setEquipmentNavOptions({})
    setGeneralMeetingNavOptions({})
    setPrintRecord(null)
    setPrintContent(null)
  }

  function goToDashboard() {
    clearNavFocus()
    setReturnView(null)
    setCurrentView('dashboard')
  }

  function handleNavigate(viewId, options = {}) {
    setHighlightRecordId(options.highlightRecordId ?? null)
    setHighlightActionId(options.highlightActionId ?? null)
    setActionFilter(options.actionFilter ?? null)
    setRecordFocus(options.recordFocus ?? null)
    setSsspNavOptions({
      ssspCloudId: options.ssspCloudId ?? null,
      ssspMode: options.ssspMode ?? null,
    })
    setEquipmentNavOptions({
      equipmentTab: options.equipmentTab ?? null,
      equipmentId: options.equipmentId ?? null,
      defectPrefill: options.defectPrefill ?? null,
    })
    setGeneralMeetingNavOptions({
      meetingId: options.meetingId ?? null,
    })
    setReturnView(options.returnView ?? null)
    setCurrentView(viewId)
  }

  function handleSsspBack() {
    setSsspNavOptions({})
    if (returnView === 'sssp-editor') {
      setCurrentView('sssp')
      setReturnView(null)
      return
    }
    if (returnView) {
      setCurrentView(returnView)
      setReturnView(null)
      return
    }
    goToDashboard()
  }

  function handleSsspDashboardBack() {
    setSsspNavOptions({})
    goToDashboard()
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

  function handleGeneralMeetingCompleted(meeting) {
    setActions((prev) => {
      const next = syncActionsFromGeneralMeeting(meeting, prev)
      if (next.length === prev.length) return prev
      if (!persistActions(next)) return prev

      const newActions = next.filter(
        (action) =>
          !prev.some((existing) => existing.id === action.id) &&
          action.autoCreated &&
          action.sourceType === 'general-meeting' &&
          action.sourceRecordId === meeting.id,
      )

      newActions.forEach((action) => pushActionToCloud(action))
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
    if (!printRecord && !printContent) return undefined

    const timer = window.setTimeout(() => {
      window.print()
    }, 350)

    function handleAfterPrint() {
      setPrintRecord(null)
      setPrintContent(null)
    }

    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [printRecord, printContent])

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
      setProfileError('')
      setProfileLoading(false)
      setCloudTimesheets([])
      setCloudJobStarts([])
      setCloudPreStarts([])
      setCloudToolboxRecords([])
      setCloudIncidents([])
      setCloudActions([])
      setCloudVisitorRecords([])
      setCloudSsspRecords([])
      setCloudEquipment([])
      setCloudServiceRecords([])
      setCloudDocumentRecords([])
      setCloudDefectRecords([])
      setCloudGeneralMeetings([])
      setSsspLoadError(null)
      // Same SPA instance keeps currentView across sign-out; clear so next login
      // does not flash or land on the previous page.
      resetAppNavigationState()
      return undefined
    }

    let isMounted = true
    setProfileLoading(true)
    setProfileError('')

    async function loadProfile() {
      const { profile: nextProfile, error } = await loadOrCreateProfile(session.user)
      if (!isMounted) return
      if (error) {
        setProfile(null)
        setProfileError(error.message || 'Could not load your user profile.')
        setProfileLoading(false)
        return
      }
      if (!nextProfile) {
        setProfile(null)
        setProfileError('No user profile was found for this account.')
        setProfileLoading(false)
        return
      }
      setProfile(nextProfile)
      setProfileLoading(false)
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
      setCloudVisitorRecords([])
      setCloudSsspRecords([])
      setCloudEquipment([])
      setCloudServiceRecords([])
      setCloudDocumentRecords([])
      setCloudDefectRecords([])
      setCloudGeneralMeetings([])
      setSsspLoadError(null)
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

    async function loadCloudVisitorRecords() {
      const { records } = await fetchVisitorSignInRecords(session.user.id)
      if (isMounted) setCloudVisitorRecords(records)
    }

    async function loadCloudSsspRecords() {
      setSsspLoading(true)
      // Admins need archived SSSPs for the existing SSSP Archived tab.
      const { records, error } = await fetchSsspRecords(session.user.id, {
        isAdmin,
        includeArchived: isAdmin,
      })
      if (isMounted) {
        setCloudSsspRecords(records)
        setSsspLoadError(error?.message ?? null)
        setSsspLoading(false)
      }
    }

    async function loadCloudEquipment() {
      // Include archived so EquipmentView's existing Archived filter keeps working.
      const { records } = await fetchEquipmentRecords(session.user.id, {
        includeArchived: true,
      })
      if (isMounted) setCloudEquipment(records)
    }

    async function loadCloudServiceRecords() {
      const { records } = await fetchServiceRecords(session.user.id)
      if (isMounted) setCloudServiceRecords(records)
    }

    async function loadCloudDocumentRecords() {
      const { records } = await fetchDocumentRecords(session.user.id)
      if (isMounted) setCloudDocumentRecords(records)
    }

    async function loadCloudDefectRecords() {
      const { records } = await fetchDefectRecords(session.user.id)
      if (isMounted) setCloudDefectRecords(records)
    }

    async function loadCloudGeneralMeetings() {
      const { records } = await fetchGeneralMeetingRecords(session.user.id, { isAdmin })
      if (isMounted) setCloudGeneralMeetings(records)
    }

    loadCloudTimesheets()
    loadCloudJobStarts()
    loadCloudPreStarts()
    loadCloudToolboxRecords()
    loadCloudIncidents()
    loadCloudActionRecords()
    loadCloudVisitorRecords()
    loadCloudSsspRecords()
    loadCloudEquipment()
    loadCloudServiceRecords()
    loadCloudDocumentRecords()
    loadCloudDefectRecords()
    loadCloudGeneralMeetings()

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

  useEffect(() => {
    if (!session?.user?.id) return undefined

    setVisitorRecords((prev) => {
      const merged = getMergedVisitorRecords(prev, cloudVisitorRecords)
      const changed =
        merged.length !== prev.length ||
        merged.some(
          (record, index) =>
            record.cloudId !== prev[index]?.cloudId || record.id !== prev[index]?.id,
        )
      if (changed) {
        persistVisitorRecords(merged)
        return merged
      }
      return prev
    })
  }, [cloudVisitorRecords, session?.user?.id])

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
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setAuthError(error.message)
    } else if (data.session) {
      setAuthError('')
    } else {
      setAuthError(
        'Account created. If email confirmation is enabled in Supabase, confirm your email before signing in. New accounts start as pending staff until an admin activates them.',
      )
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
  const showProfileError =
    authReady && session && !profileLoading && !profile && Boolean(profileError)
  const showPendingView =
    authReady && session && !profileLoading && profile && !hasAppAccess && profileStatus === STATUS.PENDING
  const showDisabledView =
    authReady && session && !profileLoading && profile && !hasAppAccess && profileStatus === STATUS.DISABLED
  const showMainApp = authReady && session && !profileLoading && hasAppAccess

  // After fresh sign-in (AuthView / blocked → main app), always land on Dashboard.
  // Mid-session navigation keeps showMainApp true, so currentView is left alone.
  // Pending/disabled users never set showMainApp, so they stay on AccessBlockedView.
  useEffect(() => {
    if (showMainApp && !prevShowMainAppRef.current) {
      resetAppNavigationState()
    }
    prevShowMainAppRef.current = showMainApp
  }, [showMainApp])

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

      {showProfileError && (
        <AccessBlockedView
          title="Profile unavailable"
          message={`Signed in, but your user profile could not be loaded: ${profileError}. Confirm Email auth is enabled, that a user_profiles row exists for this account, and that RLS allows reading your own profile.`}
          onSignOut={signOut}
          isLoading={authLoading}
        />
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
        <AppShell
          currentView={currentView}
          onNavigate={handleNavigate}
          profile={profile}
          userEmail={userEmail}
          roleLabel={roleLabel}
          statusLabel={statusLabel}
          profileStatus={profileStatus}
          onSignOut={signOut}
          authLoading={authLoading}
          openActionCount={openActionCount}
        >
      {printRecord && (
        <div className="print-area" aria-hidden="true">
          <PrintableRecord record={printRecord} />
        </div>
      )}

      {printContent && (
        <div className="print-area" aria-hidden="true">
          {printContent}
        </div>
      )}

      {currentView === 'dashboard' && (
        <Dashboard
          onNavigate={handleNavigate}
          recordCount={savedRecords.length}
          openActionCount={openActionCount}
          profile={profile}
          userEmail={userEmail}
          actions={actions}
          savedRecords={savedRecords}
          cloudJobStarts={cloudJobStarts}
          cloudPreStarts={cloudPreStarts}
          cloudTimesheets={cloudTimesheets}
          visitorRecords={visitorRecords}
          cloudVisitorRecords={cloudVisitorRecords}
          cloudSsspRecords={cloudSsspRecords}
          ssspLoading={ssspLoading}
          equipment={mergedEquipment}
          defectRecords={cloudDefectRecords}
          localDefectRecords={localDefectRecords}
          documentRecords={mergedDocumentRecords}
          generalMeetings={generalMeetings}
          cloudGeneralMeetings={cloudGeneralMeetings}
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
          onNavigate={handleNavigate}
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
          equipment={mergedEquipment}
          defectRecords={cloudDefectRecords}
          localDefectRecords={localDefectRecords}
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

      {currentView === 'critical-risks' && (
        <CriticalRisksView onBack={handleSsspBack} />
      )}

      {currentView === 'visitor-sign-in' && (
        <VisitorSignInView
          onBack={goToDashboard}
          onNavigate={handleNavigate}
          visitorRecords={visitorRecords}
          setVisitorRecords={setVisitorRecords}
          settings={settings}
          user={session?.user ?? null}
          cloudVisitorRecords={cloudVisitorRecords}
          setCloudVisitorRecords={setCloudVisitorRecords}
        />
      )}

      {currentView === 'sssp' && (
        <SsspDashboardView
          onBack={handleSsspDashboardBack}
          onNavigate={handleNavigate}
          profile={profile}
          user={session?.user ?? null}
          ssspRecords={cloudSsspRecords}
          setSsspRecords={setCloudSsspRecords}
          isLoading={ssspLoading}
          loadError={ssspLoadError}
        />
      )}

      {currentView === 'sssp-editor' && (
        <SsspEditorView
          onBack={() => {
            setSsspNavOptions({})
            setCurrentView('sssp')
          }}
          onNavigate={handleNavigate}
          user={session?.user ?? null}
          profile={profile}
          ssspRecords={cloudSsspRecords}
          setSsspRecords={setCloudSsspRecords}
          equipment={mergedEquipment}
          initialCloudId={ssspNavOptions.ssspCloudId}
          initialMode={ssspNavOptions.ssspMode ?? 'view'}
        />
      )}

      {currentView === 'sssp-acknowledge' && (
        <SsspAcknowledgementView
          onBack={() => {
            setSsspNavOptions({})
            setCurrentView('sssp')
          }}
          user={session?.user ?? null}
          profile={profile}
          ssspCloudId={ssspNavOptions.ssspCloudId}
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

      {currentView === 'machines-equipment' && (
        <EquipmentView
          onBack={goToDashboard}
          onNavigate={handleNavigate}
          initialTab={equipmentNavOptions.equipmentTab ?? 'register'}
          initialDefectPrefill={equipmentNavOptions.defectPrefill}
          user={session?.user ?? null}
          profile={profile}
          settings={settings}
          cloudEquipment={cloudEquipment}
          setCloudEquipment={setCloudEquipment}
          localEquipment={localEquipment}
          setLocalEquipment={setLocalEquipment}
          cloudServiceRecords={cloudServiceRecords}
          setCloudServiceRecords={setCloudServiceRecords}
          localServiceRecords={localServiceRecords}
          setLocalServiceRecords={setLocalServiceRecords}
          cloudDocumentRecords={cloudDocumentRecords}
          setCloudDocumentRecords={setCloudDocumentRecords}
          localDocumentRecords={localDocumentRecords}
          setLocalDocumentRecords={setLocalDocumentRecords}
          defectRecords={cloudDefectRecords}
          setDefectRecords={setCloudDefectRecords}
          localDefectRecords={localDefectRecords}
          setLocalDefectRecords={setLocalDefectRecords}
        />
      )}

      {currentView === 'equipment-profile' && (
        <EquipmentProfileView
          onBack={() => setCurrentView('machines-equipment')}
          onNavigate={handleNavigate}
          equipmentId={equipmentNavOptions.equipmentId}
          user={session?.user ?? null}
          profile={profile}
          settings={settings}
          equipment={mergedEquipment}
          setCloudEquipment={setCloudEquipment}
          localEquipment={localEquipment}
          setLocalEquipment={setLocalEquipment}
          serviceRecords={mergedServiceRecords}
          setCloudServiceRecords={setCloudServiceRecords}
          localServiceRecords={localServiceRecords}
          setLocalServiceRecords={setLocalServiceRecords}
          documentRecords={mergedDocumentRecords}
          setCloudDocumentRecords={setCloudDocumentRecords}
          localDocumentRecords={localDocumentRecords}
          setLocalDocumentRecords={setLocalDocumentRecords}
          defectRecords={cloudDefectRecords}
          setDefectRecords={setCloudDefectRecords}
          localDefectRecords={localDefectRecords}
          setLocalDefectRecords={setLocalDefectRecords}
          savedRecords={savedRecords}
          cloudPreStarts={cloudPreStarts}
          setPrintContent={setPrintContent}
        />
      )}

      {currentView === 'general-meeting' && (
        <GeneralMeetingView
          onBack={goToDashboard}
          meetings={generalMeetings}
          setMeetings={setGeneralMeetings}
          cloudMeetings={cloudGeneralMeetings}
          setCloudMeetings={setCloudGeneralMeetings}
          onMeetingCompleted={handleGeneralMeetingCompleted}
          settings={settings}
          user={session?.user ?? null}
          profile={profile}
          initialMeetingId={generalMeetingNavOptions.meetingId}
        />
      )}

        </AppShell>
      )}
    </div>
  )
}

export default App
