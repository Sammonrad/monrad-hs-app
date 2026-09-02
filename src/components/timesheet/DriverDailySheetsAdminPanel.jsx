import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { EmptyState } from '../common/EmptyState.jsx'
import { DriverDayReview } from './DriverDayReview.jsx'
import { exportDriverLoadsCsv } from '../../utils/driverLoadsExport.js'
import { computeDuplicateTicketFlags } from '../../utils/driverLoads.js'
import {
  formatTimeFromIso,
  getActivityLabel,
} from '../../utils/driverDaySegments.js'
import {
  fetchDailySheets,
  getMergedDailySheets,
  loadLocalDailySheets,
} from '../../utils/storage/driverDailySheetStorage.js'
import {
  fetchDriverLoads,
  getMergedDriverLoads,
  loadLocalDriverLoads,
} from '../../utils/storage/driverLoadsCloudStorage.js'
import { getDriverTicketSignedUrl } from '../../utils/storage/driverLoadsImageStorage.js'
import { fetchAllProfiles, getProfileTimesheetType, TIMESHEET_TYPES } from '../../utils/storage/userProfileStorage.js'

const EMPTY_FILTERS = {
  dateFrom: '',
  dateTo: '',
  driver: '',
  truck: '',
  job: '',
  quarry: '',
  material: '',
}

export function DriverDailySheetsAdminPanel({ user, settings }) {
  const [cloudSheets, setCloudSheets] = useState([])
  const [localSheets] = useState(() => loadLocalDailySheets())
  const [cloudLoads, setCloudLoads] = useState([])
  const [localLoads] = useState(() => loadLocalDriverLoads())
  const [profiles, setProfiles] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [selectedSheetId, setSelectedSheetId] = useState(null)
  const [loadWarning, setLoadWarning] = useState('')
  const [photoUrls, setPhotoUrls] = useState({})

  const allSheets = useMemo(
    () => getMergedDailySheets(localSheets, cloudSheets),
    [localSheets, cloudSheets],
  )

  const allLoads = useMemo(
    () => computeDuplicateTicketFlags(getMergedDriverLoads(localLoads, cloudLoads)),
    [localLoads, cloudLoads],
  )

  const driverProfiles = useMemo(
    () => profiles.filter((p) => getProfileTimesheetType(p) === TIMESHEET_TYPES.DRIVER),
    [profiles],
  )

  const filteredSheets = useMemo(() => {
    return allSheets.filter((sheet) => {
      const driverName = profiles.find((p) => p.id === sheet.cloudUserId)?.full_name || ''
      if (filters.dateFrom && sheet.sheetDate < filters.dateFrom) return false
      if (filters.dateTo && sheet.sheetDate > filters.dateTo) return false
      if (filters.driver && !driverName.toLowerCase().includes(filters.driver.toLowerCase())) return false
      if (filters.truck && !sheet.truckVehicle?.toLowerCase().includes(filters.truck.toLowerCase())) return false
      if (filters.job) {
        const hasJob = (sheet.segments ?? []).some((s) =>
          s.jobName?.toLowerCase().includes(filters.job.toLowerCase()),
        )
        if (!hasJob) return false
      }
      return sheet.status === 'submitted' || sheet.status === 'corrected' || filters.dateFrom || filters.dateTo
    })
  }, [allSheets, filters, profiles])

  const selectedSheet = useMemo(
    () => filteredSheets.find((s) => s.id === selectedSheetId || s.cloudId === selectedSheetId),
    [filteredSheets, selectedSheetId],
  )

  const selectedLoads = useMemo(() => {
    if (!selectedSheet) return []
    return allLoads.filter(
      (load) =>
        load.dailySheetCloudId === selectedSheet.cloudId ||
        load.dailySheetId === selectedSheet.id,
    )
  }, [allLoads, selectedSheet])

  const loadCloud = useCallback(async () => {
    if (!user?.id) return
    const sheetsResult = await fetchDailySheets(user.id, { isAdmin: true })
    const loadsResult = await fetchDriverLoads(user.id, { isAdmin: true })
    const profilesResult = await fetchAllProfiles()

    if (sheetsResult.error) {
      setLoadWarning(`Could not load sheets: ${sheetsResult.error.message}`)
    } else {
      setCloudSheets(sheetsResult.sheets)
    }
    if (loadsResult.error) {
      setLoadWarning((prev) => prev || `Could not load tickets: ${loadsResult.error.message}`)
    } else {
      setCloudLoads(loadsResult.loads)
    }
    if (!profilesResult.error) {
      setProfiles(profilesResult.profiles)
    }
  }, [user?.id])

  useEffect(() => {
    loadCloud()
  }, [loadCloud])

  useEffect(() => {
    let cancelled = false
    async function resolvePhotos() {
      const next = {}
      for (const load of selectedLoads) {
        if (!load.ticketImagePath) continue
        const { url } = await getDriverTicketSignedUrl(load.ticketImagePath)
        if (!cancelled && url) next[load.id] = url
      }
      if (!cancelled) setPhotoUrls(next)
    }
    resolvePhotos()
    return () => {
      cancelled = true
    }
  }, [selectedLoads])

  function handleExport() {
    const loadsToExport = selectedSheet ? selectedLoads : allLoads.filter((load) => {
      if (filters.dateFrom && load.loadDate < filters.dateFrom) return false
      if (filters.dateTo && load.loadDate > filters.dateTo) return false
      return true
    })
    exportDriverLoadsCsv(loadsToExport, `driver-sheets-${filters.dateFrom || 'all'}.csv`)
  }

  return (
    <div className="driver-sheets-admin">
      <header className="driver-loads-admin__header">
        <h2>Driver daily sheets</h2>
        <button type="button" className="btn btn--secondary" onClick={handleExport}>
          <Download size={16} aria-hidden="true" />
          Export CSV
        </button>
      </header>

      {loadWarning && (
        <p className="validation-message" role="alert">{loadWarning}</p>
      )}

      <div className="driver-loads-admin__filters">
        <input
          type="date"
          className="form-input"
          value={filters.dateFrom}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
          aria-label="From date"
        />
        <input
          type="date"
          className="form-input"
          value={filters.dateTo}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
          aria-label="To date"
        />
        <input
          type="search"
          className="form-input"
          placeholder="Driver"
          value={filters.driver}
          onChange={(e) => setFilters((f) => ({ ...f, driver: e.target.value }))}
        />
        <input
          type="search"
          className="form-input"
          placeholder="Truck"
          value={filters.truck}
          onChange={(e) => setFilters((f) => ({ ...f, truck: e.target.value }))}
        />
        <input
          type="search"
          className="form-input"
          placeholder="Job"
          value={filters.job}
          onChange={(e) => setFilters((f) => ({ ...f, job: e.target.value }))}
        />
      </div>

      {driverProfiles.length > 0 && (
        <p className="form-hint">
          Driver profiles: {driverProfiles.map((p) => p.full_name).join(', ')}
        </p>
      )}

      {filteredSheets.length === 0 ? (
        <EmptyState message="No daily sheets match these filters." />
      ) : (
        <ul className="driver-sheets-admin__list">
          {filteredSheets.map((sheet) => {
            const driverName = profiles.find((p) => p.id === sheet.cloudUserId)?.full_name || '—'
            return (
              <li key={sheet.id} className="driver-sheets-admin__card">
                <button
                  type="button"
                  className="driver-sheets-admin__card-btn"
                  onClick={() => setSelectedSheetId(sheet.cloudId || sheet.id)}
                >
                  <strong>{sheet.sheetDate}</strong> · {driverName} · {sheet.truckVehicle}
                  <span className="driver-sheets-admin__status">{sheet.status}</span>
                </button>
                <p className="driver-sheets-admin__segments">
                  {(sheet.segments ?? []).slice(0, 3).map((seg) => (
                    <span key={seg.id || seg.cloudId}>
                      {getActivityLabel(seg)} ({formatTimeFromIso(seg.startedAt)})
                    </span>
                  ))}
                </p>
              </li>
            )
          })}
        </ul>
      )}

      {selectedSheet && (
        <div className="driver-sheets-admin__detail">
          <DriverDayReview sheet={selectedSheet} loads={selectedLoads} editable={false} />
          {selectedLoads.length > 0 && (
            <section className="driver-sheets-admin__tickets">
              <h3>Tickets</h3>
              <ul>
                {selectedLoads.map((load) => (
                  <li key={load.id}>
                    #{load.ticketNumber || '—'} · {load.netWeightTonnes} t · {load.quarrySupplier}
                    {load.duplicateTicketFlag && ' · DUPLICATE'}
                    {photoUrls[load.id] && (
                      <a href={photoUrls[load.id]} target="_blank" rel="noopener noreferrer">
                        View photo
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
