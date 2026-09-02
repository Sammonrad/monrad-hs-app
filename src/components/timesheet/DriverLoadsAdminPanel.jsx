import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, Pencil } from 'lucide-react'
import { EmptyState } from '../common/EmptyState.jsx'
import { DriverLoadForm } from './DriverLoadForm.jsx'
import { computeLoadRangeTotals, computeDuplicateTicketFlags, applyDuplicateFlagToLoad } from '../../utils/driverLoads.js'
import { exportDriverLoadsCsv } from '../../utils/driverLoadsExport.js'
import {
  adminUpdateDriverLoad,
  fetchDriverLoads,
  getMergedDriverLoads,
  loadLocalDriverLoads,
} from '../../utils/storage/driverLoadsCloudStorage.js'
import {
  deleteDriverTicketImage,
  getDriverTicketSignedUrl,
  uploadDriverTicketImage,
} from '../../utils/storage/driverLoadsImageStorage.js'
import { getSettingsOptions } from '../../utils/storage/settingsStorage.js'

const EMPTY_FILTERS = {
  dateFrom: '',
  dateTo: '',
  driver: '',
  truck: '',
  job: '',
  quarry: '',
  material: '',
}

export function DriverLoadsAdminPanel({ user, settings }) {
  const [cloudLoads, setCloudLoads] = useState([])
  const [localLoads] = useState(() => loadLocalDriverLoads())
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [loadWarning, setLoadWarning] = useState('')
  const [editingLoad, setEditingLoad] = useState(null)
  const [editReason, setEditReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [photoUrls, setPhotoUrls] = useState({})

  const comboOptions = getSettingsOptions(settings)

  const allLoads = useMemo(
    () => getMergedDriverLoads(localLoads, cloudLoads),
    [localLoads, cloudLoads],
  )

  const allLoadsFlagged = useMemo(() => computeDuplicateTicketFlags(allLoads), [allLoads])

  const filteredLoads = useMemo(() => {
    return allLoadsFlagged.filter((load) => {
      if (filters.dateFrom && load.loadDate < filters.dateFrom) return false
      if (filters.dateTo && load.loadDate > filters.dateTo) return false
      if (filters.driver && !load.driverName?.toLowerCase().includes(filters.driver.toLowerCase())) {
        return false
      }
      if (filters.truck && !load.truckVehicle?.toLowerCase().includes(filters.truck.toLowerCase())) {
        return false
      }
      if (filters.job && !load.jobProjectName?.toLowerCase().includes(filters.job.toLowerCase())) {
        return false
      }
      if (
        filters.quarry &&
        !load.quarrySupplier?.toLowerCase().includes(filters.quarry.toLowerCase())
      ) {
        return false
      }
      if (
        filters.material &&
        !load.materialProduct?.toLowerCase().includes(filters.material.toLowerCase())
      ) {
        return false
      }
      return true
    })
  }, [allLoadsFlagged, filters])

  const totals = useMemo(() => computeLoadRangeTotals(filteredLoads), [filteredLoads])

  const loadCloud = useCallback(async () => {
    if (!user?.id) return
    const { loads, error } = await fetchDriverLoads(user.id, { isAdmin: true })
    if (error) {
      setLoadWarning(`Could not load quarry runs: ${error.message}`)
      return
    }
    setLoadWarning('')
    setCloudLoads(loads)
  }, [user?.id])

  useEffect(() => {
    loadCloud()
  }, [loadCloud])

  useEffect(() => {
    let cancelled = false

    async function resolvePhotos() {
      const next = {}
      for (const load of filteredLoads) {
        if (!load.ticketImagePath) continue
        if (load.ticketImagePreviewUrl?.startsWith('data:')) {
          next[load.id] = load.ticketImagePreviewUrl
          continue
        }
        const { url } = await getDriverTicketSignedUrl(load.ticketImagePath)
        if (!cancelled && url) next[load.id] = url
      }
      if (!cancelled) setPhotoUrls(next)
    }

    resolvePhotos()
    return () => {
      cancelled = true
    }
  }, [filteredLoads])

  async function handleAdminSave(formLoad) {
    if (!editingLoad || !user?.id) return
    setSaving(true)
    setStatusMessage('')

    let record = applyDuplicateFlagToLoad(
      { ...editingLoad, ...formLoad },
      allLoadsFlagged,
    )

    const ownerUserId = editingLoad.cloudUserId
    const loadId = editingLoad.cloudId || editingLoad.id

    if (formLoad.ticketImagePreviewUrl?.startsWith('data:')) {
      if (!ownerUserId) {
        setSaving(false)
        setStatusMessage('Cannot upload ticket photo: load has no owner.')
        return
      }
      const previousImagePath = editingLoad.ticketImagePath || ''
      const { path, error: uploadError } = await uploadDriverTicketImage(
        ownerUserId,
        loadId,
        formLoad.ticketImagePreviewUrl,
      )
      if (uploadError) {
        setSaving(false)
        setStatusMessage(uploadError.message || 'Could not upload ticket photo.')
        return
      }
      record = {
        ...record,
        ticketImagePath: path,
        ticketImagePreviewUrl: formLoad.ticketImagePreviewUrl,
      }
      if (previousImagePath && previousImagePath !== path) {
        const { ok, error: deleteError } = await deleteDriverTicketImage(previousImagePath)
        if (!ok) {
          console.warn('Replaced ticket image but old file remains:', previousImagePath, deleteError)
        }
      }
    }

    const { load: updated, error } = await adminUpdateDriverLoad(
      user,
      record,
      editingLoad,
      editReason,
    )

    setSaving(false)
    if (error) {
      setStatusMessage(error.message || 'Could not save changes.')
      return
    }

    setCloudLoads((prev) => [
      updated,
      ...prev.filter((l) => l.cloudId !== updated.cloudId && l.id !== updated.id),
    ])
    await loadCloud()
    setEditingLoad(null)
    setEditReason('')
    setStatusMessage('Load updated with audit trail.')
  }

  return (
    <section className="driver-loads-admin no-print" aria-labelledby="driver-loads-admin-heading">
      <div className="driver-loads-admin__header">
        <div>
          <h2 id="driver-loads-admin-heading" className="saved-records__title">
            Quarry runs — admin
          </h2>
          <p className="saved-records__count">
            {filteredLoads.length} load{filteredLoads.length === 1 ? '' : 's'}
            {filteredLoads.length !== allLoads.length ? ` (of ${allLoads.length} total)` : ''}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => exportDriverLoadsCsv(filteredLoads)}
          disabled={filteredLoads.length === 0}
        >
          <Download size={16} aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {loadWarning && (
        <p className="backup-warning" role="alert">
          {loadWarning}
        </p>
      )}
      {statusMessage && (
        <p className="form-hint" role="status">
          {statusMessage}
        </p>
      )}

      <div className="driver-loads-admin__filters">
        <label className="field">
          <span className="field__label">From date</span>
          <input
            type="date"
            className="field__input"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
          />
        </label>
        <label className="field">
          <span className="field__label">To date</span>
          <input
            type="date"
            className="field__input"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
          />
        </label>
        <label className="field">
          <span className="field__label">Driver</span>
          <input
            type="text"
            className="field__input"
            value={filters.driver}
            onChange={(e) => setFilters((f) => ({ ...f, driver: e.target.value }))}
            placeholder="Filter driver"
          />
        </label>
        <label className="field">
          <span className="field__label">Truck</span>
          <input
            type="text"
            className="field__input"
            value={filters.truck}
            onChange={(e) => setFilters((f) => ({ ...f, truck: e.target.value }))}
            placeholder="Filter truck"
          />
        </label>
        <label className="field">
          <span className="field__label">Job</span>
          <input
            type="text"
            className="field__input"
            value={filters.job}
            onChange={(e) => setFilters((f) => ({ ...f, job: e.target.value }))}
            placeholder="Filter job"
          />
        </label>
        <label className="field">
          <span className="field__label">Quarry</span>
          <input
            type="text"
            className="field__input"
            value={filters.quarry}
            onChange={(e) => setFilters((f) => ({ ...f, quarry: e.target.value }))}
            placeholder="Filter quarry"
          />
        </label>
        <label className="field">
          <span className="field__label">Material</span>
          <input
            type="text"
            className="field__input"
            value={filters.material}
            onChange={(e) => setFilters((f) => ({ ...f, material: e.target.value }))}
            placeholder="Filter material"
          />
        </label>
      </div>

      <div className="driver-loads-summary driver-loads-summary--admin">
        <div className="driver-loads-summary__stat">
          <span className="driver-loads-summary__value">{totals.totalTrips}</span>
          <span className="driver-loads-summary__label">Total trips</span>
        </div>
        <div className="driver-loads-summary__stat">
          <span className="driver-loads-summary__value">{totals.totalNetTonnes.toFixed(3)}</span>
          <span className="driver-loads-summary__label">Total net tonnes</span>
        </div>
      </div>

      {totals.daily.length > 0 && (
        <details className="driver-loads-breakdown">
          <summary>Daily totals</summary>
          <table className="driver-loads-admin__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Trips</th>
                <th>Net tonnes</th>
              </tr>
            </thead>
            <tbody>
              {totals.daily.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{row.trips}</td>
                  <td>{row.netTonnes.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {filteredLoads.length === 0 ? (
        <EmptyState
          title="No quarry runs found"
          description="Adjust filters or ask drivers to add loads in their timesheets."
        />
      ) : (
        <ul className="driver-loads-admin__list">
          {filteredLoads.map((load) => (
            <li key={load.id} className="driver-loads-admin__card">
              <div className="driver-loads-admin__card-header">
                <div>
                  <strong>
                    {load.loadDate} · #{load.ticketNumber}
                    {load.duplicateTicketFlag && (
                      <span className="driver-loads-list__flag">Duplicate</span>
                    )}
                  </strong>
                  <p>
                    {load.driverName} · {load.truckVehicle} · {load.jobProjectName}
                  </p>
                  <p>
                    {load.quarrySupplier} · {load.materialProduct || '—'} · {load.netWeightTonnes} t
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary btn--small"
                  onClick={() => setEditingLoad(load)}
                >
                  <Pencil size={14} aria-hidden="true" />
                  Correct
                </button>
              </div>
              {photoUrls[load.id] && (
                <div className="driver-loads-admin__photo">
                  <img src={photoUrls[load.id]} alt={`Ticket ${load.ticketNumber}`} />
                  <a
                    href={photoUrls[load.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--secondary btn--small"
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    Open photo
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editingLoad && (
        <div className="driver-loads-form-panel driver-loads-form-panel--modal">
          <h3>Correct quarry run</h3>
          <label className="field">
            <span className="field__label">Reason for correction (audit trail)</span>
            <input
              type="text"
              className="field__input"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="e.g. Ticket number typo"
            />
          </label>
          <DriverLoadForm
            load={editingLoad}
            comboOptions={comboOptions}
            saving={saving}
            onSave={handleAdminSave}
            onCancel={() => {
              setEditingLoad(null)
              setEditReason('')
            }}
            submitLabel="Save correction"
          />
        </div>
      )}
    </section>
  )
}
