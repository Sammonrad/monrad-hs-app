import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import { FormPageHeader } from '../components/forms/FormPageHeader.jsx'
import { DriverLoadForm } from '../components/timesheet/DriverLoadForm.jsx'
import { DriverDayStart } from '../components/timesheet/DriverDayStart.jsx'
import { CurrentJobPanel } from '../components/timesheet/CurrentJobPanel.jsx'
import { ChangeJobModal } from '../components/timesheet/ChangeJobModal.jsx'
import { DriverDayTimeline } from '../components/timesheet/DriverDayTimeline.jsx'
import { DriverDayReview } from '../components/timesheet/DriverDayReview.jsx'
import { DriverDailySheetsAdminPanel } from '../components/timesheet/DriverDailySheetsAdminPanel.jsx'
import { createRecordId } from '../utils/ids.js'
import { formatNzLongDate } from '../utils/formatting.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import {
  ACTIVITY_TYPES,
  createEmptySegment,
  computeDayWorkMinutes,
  getActiveSegment,
  SHEET_STATUSES,
  validateSegments,
} from '../utils/driverDaySegments.js'
import {
  applyDuplicateFlagToLoad,
  computeDailyLoadSummary,
  computeDuplicateTicketFlags,
} from '../utils/driverLoads.js'
import {
  getLastTruck,
  rememberRecentJob,
  rememberRecentQuarry,
  setLastTruck,
} from '../utils/driverLocalPrefs.js'
import {
  fetchDailySheets,
  getMergedDailySheets,
  loadLocalDailySheets,
  persistLocalDailySheets,
  saveDailySheet,
  saveSegment,
  SYNC_STATUS,
  updateDailySheet,
  updateSegment,
  isCloudSaveUnavailable,
} from '../utils/storage/driverDailySheetStorage.js'
import {
  fetchDriverLoads,
  getMergedDriverLoads,
  loadLocalDriverLoads,
  persistLocalDriverLoads,
  prepareDriverLoadForSave,
  saveDriverLoad,
} from '../utils/storage/driverLoadsCloudStorage.js'
import { uploadDriverTicketImage } from '../utils/storage/driverLoadsImageStorage.js'
import { createEmptyDriverLoad } from '../utils/driverLoads.js'

function formatTodayLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatNowIso() {
  return new Date().toISOString()
}

function currentTimeLocal() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function DailyDriverSheetView({
  onBack,
  settings,
  user,
  profile,
}) {
  const isAdmin = isAdminProfile(profile)
  const driverName = profile?.full_name?.trim() || ''
  const today = formatTodayLocal()
  const comboOptions = getSettingsOptions(settings)

  const [localSheets, setLocalSheets] = useState(() => loadLocalDailySheets())
  const [cloudSheets, setCloudSheets] = useState([])
  const [localLoads, setLocalLoads] = useState(() => loadLocalDriverLoads())
  const [cloudLoads, setCloudLoads] = useState([])
  const [loadWarning, setLoadWarning] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusError, setStatusError] = useState('')
  const [viewMode, setViewMode] = useState('active')
  const [adminTab, setAdminTab] = useState('today')
  const [truckVehicle, setTruckVehicle] = useState(() => getLastTruck())
  const [starting, setStarting] = useState(false)
  const [segmentBusy, setSegmentBusy] = useState(false)
  const [changeJobOpen, setChangeJobOpen] = useState(false)
  const [ticketFormOpen, setTicketFormOpen] = useState(false)
  const [ticketSaving, setTicketSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const segmentLockRef = useRef(false)

  useEffect(() => {
    if (!truckVehicle && getLastTruck()) {
      setTruckVehicle(getLastTruck())
    }
  }, [truckVehicle])

  const allSheets = useMemo(
    () => getMergedDailySheets(localSheets, cloudSheets),
    [localSheets, cloudSheets],
  )

  const allLoads = useMemo(
    () => computeDuplicateTicketFlags(getMergedDriverLoads(localLoads, cloudLoads)),
    [localLoads, cloudLoads],
  )

  const todaySheet = useMemo(
    () =>
      allSheets.find(
        (sheet) =>
          sheet.sheetDate === today &&
          (sheet.cloudUserId === user?.id || !sheet.cloudUserId),
      ),
    [allSheets, today, user?.id],
  )

  const todayLoads = useMemo(() => {
    if (!todaySheet) return []
    return allLoads.filter(
      (load) =>
        load.dailySheetCloudId === todaySheet.cloudId ||
        load.dailySheetId === todaySheet.id ||
        (load.loadDate === today && load.driverName === driverName && !load.dailySheetId && !load.dailySheetCloudId),
    )
  }, [allLoads, todaySheet, today, driverName])

  const loadSummary = useMemo(() => computeDailyLoadSummary(todayLoads), [todayLoads])
  const activeSegment = useMemo(
    () => (todaySheet ? getActiveSegment(todaySheet.segments ?? []) : null),
    [todaySheet],
  )

  const isEditable = todaySheet?.status === SHEET_STATUSES.DRAFT
  const isSubmitted = todaySheet?.status === SHEET_STATUSES.SUBMITTED || todaySheet?.status === SHEET_STATUSES.CORRECTED

  const persistSheets = useCallback((sheets) => {
    setLocalSheets(sheets)
    persistLocalDailySheets(sheets)
  }, [])

  const persistLoads = useCallback((loads) => {
    setLocalLoads(loads)
    persistLocalDriverLoads(loads)
  }, [])

  const upsertLocalSheet = useCallback(
    (sheet) => {
      persistSheets(
        (() => {
          const without = localSheets.filter((item) => item.id !== sheet.id)
          return [sheet, ...without]
        })(),
      )
    },
    [localSheets, persistSheets],
  )

  useEffect(() => {
    if (!user?.id) return undefined
    let mounted = true

    async function loadCloud() {
      const sheetsResult = await fetchDailySheets(user.id, { isAdmin })
      const loadsResult = await fetchDriverLoads(user.id, { isAdmin })
      if (!mounted) return
      if (sheetsResult.error) {
        setLoadWarning(`Could not load daily sheets: ${sheetsResult.error.message}`)
      } else {
        setCloudSheets(sheetsResult.sheets)
      }
      if (loadsResult.error) {
        setLoadWarning((prev) => prev || `Could not load tickets: ${loadsResult.error.message}`)
      } else {
        setCloudLoads(loadsResult.loads)
      }
    }

    loadCloud()
    return () => {
      mounted = false
    }
  }, [user?.id, isAdmin])

  async function syncSheetToCloud(sheet) {
    if (isCloudSaveUnavailable()) {
      return { sheet, error: null, localOnly: true }
    }

    if (sheet.cloudId) {
      const { sheet: updated, error } = await updateDailySheet(user, sheet)
      if (error) return { sheet, error, localOnly: false }
      upsertLocalSheet({ ...sheet, ...updated, segments: sheet.segments })
      setCloudSheets((prev) => {
        const without = prev.filter((item) => item.cloudId !== updated.cloudId)
        return [{ ...sheet, ...updated, segments: sheet.segments }, ...without]
      })
      return { sheet: { ...sheet, ...updated }, error: null, localOnly: false }
    }

    const { sheet: created, error } = await saveDailySheet(user, sheet)
    if (error) return { sheet, error, localOnly: false }
    const merged = { ...sheet, ...created, segments: sheet.segments }
    upsertLocalSheet(merged)
    setCloudSheets((prev) => [merged, ...prev.filter((item) => item.cloudId !== merged.cloudId)])
    return { sheet: merged, error: null, localOnly: false }
  }

  async function syncSegmentToCloud(segment, sheet) {
    if (!sheet.cloudId) return { segment, error: null }
    if (segment.cloudId) {
      return updateSegment(user, { ...segment, dailySheetCloudId: sheet.cloudId })
    }
    return saveSegment(user, segment, sheet.cloudId)
  }

  async function handleStartDay() {
    const truck = truckVehicle?.trim() || getLastTruck()
    if (!truck) {
      setStatusError('Select a truck before starting the day.')
      return
    }

    setStarting(true)
    setStatusError('')
    setLastTruck(truck)

    const now = formatNowIso()
    const sheetId = createRecordId()
    const segment = createEmptySegment({
      id: createRecordId(),
      dailySheetId: sheetId,
      activityType: ACTIVITY_TYPES.YARD,
      jobName: 'Yard',
      startedAt: now,
      sortOrder: 0,
    })

    const sheet = {
      id: sheetId,
      cloudId: null,
      cloudUserId: user?.id ?? null,
      sheetDate: today,
      truckVehicle: truck,
      status: SHEET_STATUSES.DRAFT,
      startedAt: now,
      finishedAt: '',
      segments: [segment],
      createdAt: now,
      updatedAt: now,
      syncStatus: SYNC_STATUS.LOCAL,
      storageSource: 'local',
    }

    upsertLocalSheet(sheet)
    const { sheet: cloudSheet, error } = await syncSheetToCloud(sheet)
    if (error) {
      setStatusError(`Saved locally but cloud sync failed: ${error.message}`)
    } else {
      setStatusMessage('Day started.')
    }

    let syncedSheet = cloudSheet
    if (cloudSheet.cloudId) {
      const { segment: cloudSegment, error: segError } = await syncSegmentToCloud(
        { ...segment, dailySheetId: cloudSheet.id },
        cloudSheet,
      )
      if (!segError && cloudSegment) {
        syncedSheet = {
          ...cloudSheet,
          segments: [{ ...segment, ...cloudSegment, dailySheetId: cloudSheet.id }],
        }
        upsertLocalSheet(syncedSheet)
      }
    }

    setStarting(false)
    setViewMode('active')
  }

  async function handleChangeJob({ activityType, jobName }) {
    if (!todaySheet || !isEditable || segmentLockRef.current) return
    segmentLockRef.current = true
    setSegmentBusy(true)
    setChangeJobOpen(false)

    const now = formatNowIso()
    const segments = [...(todaySheet.segments ?? [])]
    const active = getActiveSegment(segments)

    if (active) {
      const ended = { ...active, endedAt: now }
      const idx = segments.findIndex((s) => s.id === active.id)
      if (idx >= 0) segments[idx] = ended
      const { segment: cloudEnded, error } = await syncSegmentToCloud(ended, todaySheet)
      if (!error && cloudEnded) segments[idx] = { ...ended, ...cloudEnded }
    }

    if (activityType === ACTIVITY_TYPES.JOB) rememberRecentJob(jobName)

    const newSegment = createEmptySegment({
      id: createRecordId(),
      dailySheetId: todaySheet.id,
      dailySheetCloudId: todaySheet.cloudId,
      activityType,
      jobName: activityType === ACTIVITY_TYPES.JOB ? jobName : '',
      startedAt: now,
      sortOrder: segments.length,
    })
    segments.push(newSegment)

    const updatedSheet = { ...todaySheet, segments, updatedAt: now }
    upsertLocalSheet(updatedSheet)
    await syncSheetToCloud(updatedSheet)

    const { segment: cloudSegment, error: segError } = await syncSegmentToCloud(newSegment, updatedSheet)
    if (!segError && cloudSegment) {
      const finalSegments = segments.map((s) =>
        s.id === newSegment.id ? { ...newSegment, ...cloudSegment } : s,
      )
      upsertLocalSheet({ ...updatedSheet, segments: finalSegments })
    }

    setSegmentBusy(false)
    segmentLockRef.current = false
    setStatusMessage('Job changed.')
  }

  async function handleSaveTicket(formLoad) {
    if (!todaySheet || !isEditable) return
    setTicketSaving(true)
    setStatusError('')

    const active = activeSegment
    const loadId = createRecordId()
    let record = applyDuplicateFlagToLoad(
      {
        ...createEmptyDriverLoad(),
        ...formLoad,
        id: loadId,
        loadDate: today,
        driverName,
        truckVehicle: todaySheet.truckVehicle,
        jobProjectName: active?.jobName || formLoad.jobProjectName || '',
        dailySheetId: todaySheet.id,
        dailySheetCloudId: todaySheet.cloudId,
        segmentId: active?.id || '',
        segmentCloudId: active?.cloudId || null,
        tripStartTime: formLoad.tripStartTime || currentTimeLocal(),
        createdAt: formatNowIso(),
        syncStatus: SYNC_STATUS.LOCAL,
      },
      allLoads,
    )

    if (formLoad.quarrySupplier) rememberRecentQuarry(formLoad.quarrySupplier)

    const peerLoads = [...allLoads, record]
    const { load: prepared } = await prepareDriverLoadForSave(record, user, { peerLoads })

    let imagePath = prepared.ticketImagePath
    if (prepared.ticketImagePreviewUrl?.startsWith('data:')) {
      const ownerId = user?.id
      const { path, error: uploadError } = await uploadDriverTicketImage(
        ownerId,
        loadId,
        prepared.ticketImagePreviewUrl,
      )
      if (uploadError) {
        setTicketSaving(false)
        setStatusError(uploadError.message || 'Could not upload ticket photo.')
        return
      }
      imagePath = path
      record = { ...prepared, ticketImagePath: path }
    } else {
      record = prepared
    }

    const nextLoads = [...localLoads.filter((l) => l.id !== record.id), record]
    persistLoads(nextLoads)

    if (!isCloudSaveUnavailable()) {
      const { load: cloudLoad, error } = await saveDriverLoad(user, record, {
        ownerUserId: user?.id,
      })
      if (error) {
        setStatusError(`Ticket saved locally. Cloud sync failed: ${error.message}`)
      } else if (cloudLoad) {
        const merged = { ...record, ...cloudLoad, ticketImagePath: imagePath || cloudLoad.ticketImagePath }
        persistLoads([...nextLoads.filter((l) => l.id !== record.id), merged])
        setCloudLoads((prev) => [merged, ...prev.filter((l) => l.cloudId !== merged.cloudId)])
        setStatusMessage('Weight ticket saved.')
      }
    } else {
      setStatusMessage('Weight ticket saved locally.')
    }

    setTicketSaving(false)
    setTicketFormOpen(false)
  }

  async function handleFinishReview() {
    if (!todaySheet || !isEditable) return
    const now = formatNowIso()
    const segments = [...(todaySheet.segments ?? [])]
    const active = getActiveSegment(segments)
    if (active) {
      const ended = { ...active, endedAt: now }
      const idx = segments.findIndex((s) => s.id === active.id)
      if (idx >= 0) segments[idx] = ended
      await syncSegmentToCloud(ended, todaySheet)
    }

    const updated = {
      ...todaySheet,
      segments,
      finishedAt: now,
      updatedAt: now,
    }
    upsertLocalSheet(updated)
    await syncSheetToCloud(updated)
    setViewMode('review')
  }

  async function handleSubmitDay() {
    if (!todaySheet) return
    setSubmitting(true)
    setStatusError('')

    const validation = validateSegments(todaySheet.segments ?? [], { allowActive: false })
    if (!validation.valid) {
      setSubmitting(false)
      setStatusError(validation.errors[0])
      return
    }

    const submitted = {
      ...todaySheet,
      status: SHEET_STATUSES.SUBMITTED,
      finishedAt: todaySheet.finishedAt || formatNowIso(),
      updatedAt: formatNowIso(),
    }
    upsertLocalSheet(submitted)
    const { error } = await syncSheetToCloud(submitted)
    if (error) {
      setStatusError(`Submitted locally but cloud sync failed: ${error.message}`)
    } else {
      setStatusMessage('Daily sheet submitted.')
    }
    setSubmitting(false)
    setViewMode('review')
  }

  const ticketDefaults = useMemo(
    () => ({
      loadDate: today,
      driverName,
      truckVehicle: todaySheet?.truckVehicle || truckVehicle,
      jobProjectName: activeSegment?.jobName || '',
      quarrySupplier: '',
    }),
    [today, driverName, todaySheet, truckVehicle, activeSegment],
  )

  if (isAdmin && adminTab === 'admin') {
    return (
      <>
        <BackButton onClick={onBack} />
        <FormPageHeader title="Driver daily sheets" subtitle="Office view — submitted sheets and tickets" />
        <div className="driver-day-admin-tabs">
          <button type="button" className="btn btn--secondary" onClick={() => setAdminTab('today')}>
            My day
          </button>
          <button type="button" className="btn btn--active btn--secondary" onClick={() => setAdminTab('admin')}>
            Admin panel
          </button>
        </div>
        <DriverDailySheetsAdminPanel user={user} settings={settings} />
      </>
    )
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <FormPageHeader
        title="Daily Driver Sheet"
        subtitle={formatNzLongDate(today)}
      />

      {isAdmin && (
        <div className="driver-day-admin-tabs">
          <button
            type="button"
            className={`btn btn--secondary${adminTab === 'today' ? ' btn--active' : ''}`}
            onClick={() => setAdminTab('today')}
          >
            My day
          </button>
          <button
            type="button"
            className={`btn btn--secondary${adminTab === 'admin' ? ' btn--active' : ''}`}
            onClick={() => setAdminTab('admin')}
          >
            Admin panel
          </button>
        </div>
      )}

      {loadWarning && (
        <p className="validation-message" role="alert">{loadWarning}</p>
      )}
      {statusMessage && (
        <p className="form-hint" role="status">{statusMessage}</p>
      )}
      {statusError && (
        <p className="validation-message validation-message--error" role="alert">{statusError}</p>
      )}

      {!todaySheet && (
        <DriverDayStart
          driverName={driverName}
          sheetDate={today}
          truckVehicle={truckVehicle}
          onTruckChange={setTruckVehicle}
          onStart={handleStartDay}
          starting={starting}
          settings={settings}
        />
      )}

      {todaySheet && viewMode === 'active' && !isSubmitted && (
        <div className="driver-day-active">
          <header className="driver-day-active__header">
            <p className="driver-day-active__driver">{driverName}</p>
            <p className="driver-day-active__meta">
              {todaySheet.truckVehicle} · {formatNzLongDate(todaySheet.sheetDate)}
            </p>
          </header>

          <CurrentJobPanel segment={activeSegment} />

          <div className="driver-day-active__actions">
            <button
              type="button"
              className="driver-day-btn driver-day-btn--primary driver-day-btn--block"
              onClick={() => setChangeJobOpen(true)}
              disabled={!isEditable || segmentBusy}
            >
              Change Job
            </button>
            <button
              type="button"
              className="driver-day-btn driver-day-btn--secondary driver-day-btn--block"
              onClick={() => setTicketFormOpen(true)}
              disabled={!isEditable}
            >
              Add Weight Ticket
            </button>
          </div>

          <section className="driver-day-active__timeline">
            <h2 className="driver-day-active__section-title">Today</h2>
            <DriverDayTimeline segments={todaySheet.segments ?? []} loads={todayLoads} />
          </section>

          <div className="driver-day-active__totals">
            <span>{Math.round((computeDayWorkMinutes(todaySheet.segments ?? []) / 60) * 100) / 100}h work</span>
            <span>{loadSummary.totalNetTonnes} t</span>
          </div>

          <button
            type="button"
            className="driver-day-btn driver-day-btn--primary driver-day-btn--block"
            onClick={handleFinishReview}
            disabled={!isEditable}
          >
            Finish and Review Day
          </button>
        </div>
      )}

      {todaySheet && (viewMode === 'review' || isSubmitted) && (
        <DriverDayReview
          sheet={todaySheet}
          loads={todayLoads}
          editable={isEditable}
          onSubmit={handleSubmitDay}
          submitting={submitting}
        />
      )}

      {todaySheet && isSubmitted && viewMode === 'active' && (
        <button
          type="button"
          className="btn btn--secondary driver-day-btn--block"
          onClick={() => setViewMode('review')}
        >
          View submitted sheet
        </button>
      )}

      <ChangeJobModal
        open={changeJobOpen}
        onClose={() => setChangeJobOpen(false)}
        onConfirm={handleChangeJob}
        settings={settings}
        saving={segmentBusy}
      />

      {ticketFormOpen && (
        <div className="driver-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-form-title">
          <div className="driver-modal__backdrop" onClick={() => !ticketSaving && setTicketFormOpen(false)} />
          <div className="driver-modal__panel driver-modal__panel--form">
            <h2 id="ticket-form-title" className="driver-modal__title">Add weight ticket</h2>
            <DriverLoadForm
              defaults={ticketDefaults}
              comboOptions={comboOptions}
              onSave={handleSaveTicket}
              onCancel={() => setTicketFormOpen(false)}
              saving={ticketSaving}
              submitLabel="Save ticket"
              ticketOnly
            />
          </div>
        </div>
      )}
    </>
  )
}
