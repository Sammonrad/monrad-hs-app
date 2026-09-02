import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { FormSection } from '../forms/FormSection.jsx'
import { ConfirmModal } from '../common/ConfirmModal.jsx'
import { DriverLoadForm } from './DriverLoadForm.jsx'
import { createRecordId } from '../../utils/ids.js'
import { computeDailyLoadSummary, applyDuplicateFlagToLoad, computeDuplicateTicketFlags } from '../../utils/driverLoads.js'
import {
  deleteDriverLoad,
  fetchDriverLoads,
  getMergedDriverLoads,
  isCloudSaveUnavailable,
  loadLocalDriverLoads,
  persistLocalDriverLoads,
  resolveDriverLoadOwnerId,
  saveDriverLoad,
  SYNC_STATUS,
  updateDriverLoad,
} from '../../utils/storage/driverLoadsCloudStorage.js'
import { uploadDriverTicketImage } from '../../utils/storage/driverLoadsImageStorage.js'

export function DriverLoadsSection({
  timesheetLocalId,
  timesheetCloudId,
  timesheetOwnerId = null,
  loadDate,
  driverName,
  jobProjectName,
  truckVehicle,
  comboOptions,
  user,
  isAdmin = false,
  editable = true,
}) {
  const [localLoads, setLocalLoads] = useState(() => loadLocalDriverLoads())
  const [cloudLoads, setCloudLoads] = useState([])
  const [loadWarning, setLoadWarning] = useState('')
  const [formMode, setFormMode] = useState(null)
  const [editingLoad, setEditingLoad] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const defaults = useMemo(
    () => ({
      loadDate: loadDate || '',
      driverName: driverName || '',
      jobProjectName: jobProjectName || '',
      truckVehicle: truckVehicle || '',
      timesheetLocalId: timesheetLocalId || '',
      timesheetCloudId: timesheetCloudId || null,
    }),
    [loadDate, driverName, jobProjectName, truckVehicle, timesheetLocalId, timesheetCloudId],
  )

  const allLoads = useMemo(
    () => getMergedDriverLoads(localLoads, cloudLoads),
    [localLoads, cloudLoads],
  )

  const allLoadsFlagged = useMemo(() => computeDuplicateTicketFlags(allLoads), [allLoads])

  const timesheetLoads = useMemo(() => {
    return allLoadsFlagged.filter((load) => {
      if (timesheetCloudId && load.timesheetCloudId === timesheetCloudId) return true
      if (timesheetLocalId && load.timesheetLocalId === timesheetLocalId) return true
      if (!timesheetCloudId && !timesheetLocalId && loadDate && load.loadDate === loadDate) {
        return load.driverName === driverName
      }
      return false
    })
  }, [allLoadsFlagged, timesheetCloudId, timesheetLocalId, loadDate, driverName])

  const summary = useMemo(() => computeDailyLoadSummary(timesheetLoads), [timesheetLoads])

  const persistLocal = useCallback((loads) => {
    setLocalLoads(loads)
    persistLocalDriverLoads(loads)
  }, [])

  const loadOwnerId = resolveDriverLoadOwnerId({}, user, timesheetOwnerId)

  const reloadCloudLoads = useCallback(async () => {
    if (!user?.id) return
    const { loads, error } = await fetchDriverLoads(loadOwnerId || user.id, { isAdmin })
    if (!error) setCloudLoads(loads)
  }, [user?.id, loadOwnerId, isAdmin])

  useEffect(() => {
    if (!user?.id) return undefined
    let mounted = true

    async function load() {
      const { loads, error } = await fetchDriverLoads(loadOwnerId || user.id, { isAdmin })
      if (!mounted) return
      if (error) {
        setLoadWarning(`Could not load quarry runs from cloud: ${error.message}`)
        return
      }
      setLoadWarning('')
      setCloudLoads(loads)
    }

    load()
    return () => {
      mounted = false
    }
  }, [user?.id, isAdmin, loadOwnerId])

  function upsertLocal(load) {
    persistLocal(
      [load, ...localLoads.filter((item) => item.id !== load.id)],
    )
  }

  function removeLocal(load) {
    persistLocal(localLoads.filter((item) => item.id !== load.id))
  }

  async function handleSaveLoad(formLoad) {
    if (!editable) return
    setSaving(true)
    setStatusMessage('')

    const now = new Date().toISOString()
    const isEdit = Boolean(editingLoad?.id)
    const ownerUserId = resolveDriverLoadOwnerId(editingLoad, user, timesheetOwnerId)
    let record = {
      ...formLoad,
      id: isEdit ? editingLoad.id : createRecordId(),
      cloudId: editingLoad?.cloudId ?? null,
      cloudUserId: ownerUserId,
      timesheetLocalId: timesheetLocalId || formLoad.timesheetLocalId,
      timesheetCloudId: timesheetCloudId || formLoad.timesheetCloudId,
      createdAt: editingLoad?.createdAt || now,
      updatedAt: now,
    }

    record = applyDuplicateFlagToLoad(record, allLoadsFlagged)

    if (formLoad.ticketImagePreviewUrl && formLoad.ticketImagePreviewUrl.startsWith('data:')) {
      if (!ownerUserId) {
        setSaving(false)
        setStatusMessage('Cannot upload ticket photo without a driver owner.')
        return
      }
      const { path, error: uploadError } = await uploadDriverTicketImage(
        ownerUserId,
        record.cloudId || record.id,
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
    }

    upsertLocal({ ...record, syncStatus: SYNC_STATUS.LOCAL })

    if (isCloudSaveUnavailable(user)) {
      setSaving(false)
      setFormMode(null)
      setEditingLoad(null)
      setStatusMessage('Quarry run saved on this device.')
      return
    }

    if (record.cloudId) {
      const { load: cloudRecord, error } = await updateDriverLoad(user, record, {
        isAdmin,
        previousTicketNumber: editingLoad?.ticketNumber ?? null,
      })
      setSaving(false)
      if (error) {
        upsertLocal({ ...record, syncStatus: SYNC_STATUS.CLOUD_FAILED })
        setStatusMessage(error.message || 'Could not update quarry run in cloud.')
        return
      }
      const merged = { ...record, ...cloudRecord, id: record.id, syncStatus: SYNC_STATUS.CLOUD }
      upsertLocal(merged)
      await reloadCloudLoads()
      setFormMode(null)
      setEditingLoad(null)
      setStatusMessage('Quarry run updated.')
      return
    }

    const { load: cloudRecord, error } = await saveDriverLoad(user, record, {
      ownerUserId,
      timesheetOwnerId,
    })
    setSaving(false)
    if (error) {
      upsertLocal({ ...record, syncStatus: SYNC_STATUS.CLOUD_FAILED })
      setStatusMessage(error.message || 'Could not save quarry run to cloud.')
      return
    }

    const merged = {
      ...record,
      ...cloudRecord,
      id: record.id,
      syncStatus: SYNC_STATUS.CLOUD,
      storageSource: 'both',
    }
    upsertLocal(merged)
    await reloadCloudLoads()
    setFormMode(null)
    setEditingLoad(null)
    setStatusMessage('Quarry run saved.')
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)

    if (deleteTarget.cloudId && !isCloudSaveUnavailable(user)) {
      const { ok, error, imageDeleteFailed } = await deleteDriverLoad(user, deleteTarget, { isAdmin })
      if (!ok) {
        setDeleting(false)
        setStatusMessage(error?.message || 'Could not delete quarry run.')
        return
      }
      if (imageDeleteFailed) {
        removeLocal(deleteTarget)
        await reloadCloudLoads()
        setDeleting(false)
        setDeleteTarget(null)
        setStatusMessage(
          error?.message ||
            'Load removed, but the ticket photo could not be deleted from storage.',
        )
        return
      }
      await reloadCloudLoads()
    }

    removeLocal(deleteTarget)
    setDeleting(false)
    setDeleteTarget(null)
    setStatusMessage('Quarry run removed.')
  }

  return (
    <FormSection
      title="Quarry runs / driver loads"
      description="Record quarry trips and weighbridge tickets for this day. Totals update as you add loads."
      id="timesheet-driver-loads"
      className="driver-loads-section"
    >
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

      <div className="driver-loads-summary" aria-live="polite">
        <div className="driver-loads-summary__stat">
          <span className="driver-loads-summary__value">{summary.totalTrips}</span>
          <span className="driver-loads-summary__label">Trips today</span>
        </div>
        <div className="driver-loads-summary__stat">
          <span className="driver-loads-summary__value">{summary.totalNetTonnes.toFixed(3)}</span>
          <span className="driver-loads-summary__label">Net tonnes</span>
        </div>
        {summary.firstTripTime && (
          <div className="driver-loads-summary__stat">
            <span className="driver-loads-summary__value">
              {summary.firstTripTime}
              {summary.finalTripTime ? ` – ${summary.finalTripTime}` : ''}
            </span>
            <span className="driver-loads-summary__label">Trip times</span>
          </div>
        )}
      </div>

      {summary.byMaterial.length > 0 && (
        <details className="driver-loads-breakdown">
          <summary>Tonnes by material, quarry & job</summary>
          <div className="driver-loads-breakdown__grid">
            <div>
              <h4>By material</h4>
              <ul>
                {summary.byMaterial.map((row) => (
                  <li key={row.label}>
                    {row.label}: {row.tonnes.toFixed(3)} t
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>By quarry</h4>
              <ul>
                {summary.byQuarry.map((row) => (
                  <li key={row.label}>
                    {row.label}: {row.tonnes.toFixed(3)} t
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>By job</h4>
              <ul>
                {summary.byJob.map((row) => (
                  <li key={row.label}>
                    {row.label}: {row.tonnes.toFixed(3)} t
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      )}

      {summary.duplicateTicketCount > 0 && (
        <p className="validation-message validation-message--warning" role="alert">
          {summary.duplicateTicketCount} load(s) share a ticket number — please review before submitting.
        </p>
      )}

      {timesheetLoads.length > 0 && (
        <ul className="driver-loads-list">
          {timesheetLoads.map((load) => (
            <li key={load.id} className="driver-loads-list__item">
              <div className="driver-loads-list__main">
                <strong>
                  #{load.ticketNumber || '—'}
                  {load.duplicateTicketFlag && (
                    <span className="driver-loads-list__flag">Duplicate ticket</span>
                  )}
                </strong>
                <span>
                  {load.quarrySupplier || '—'} · {load.materialProduct || 'No material'} ·{' '}
                  {load.netWeightTonnes || '0'} t
                </span>
                <span className="driver-loads-list__meta">
                  {load.truckVehicle || '—'}
                  {load.tripStartTime ? ` · ${load.tripStartTime}` : ''}
                </span>
              </div>
              {editable && (
                <div className="driver-loads-list__actions">
                  <button
                    type="button"
                    className="btn btn--secondary btn--small"
                    onClick={() => {
                      setEditingLoad(load)
                      setFormMode('edit')
                    }}
                  >
                    <Pencil size={14} aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--small btn--danger-text"
                    onClick={() => setDeleteTarget(load)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && formMode !== 'new' && formMode !== 'edit' && (
        <button
          type="button"
          className="btn btn--primary driver-loads-add-btn"
          onClick={() => {
            setEditingLoad(null)
            setFormMode('new')
          }}
        >
          <Plus size={18} aria-hidden="true" />
          Add quarry run
        </button>
      )}

      {editable && (formMode === 'new' || formMode === 'edit') && (
        <div className="driver-loads-form-panel">
          <h3 className="driver-loads-form-panel__title">
            {formMode === 'edit' ? 'Edit quarry run' : 'New quarry run'}
          </h3>
          <DriverLoadForm
            load={editingLoad}
            defaults={defaults}
            comboOptions={comboOptions}
            saving={saving}
            onSave={handleSaveLoad}
            onCancel={() => {
              setFormMode(null)
              setEditingLoad(null)
            }}
            submitLabel={formMode === 'edit' ? 'Update load' : 'Save load'}
          />
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Remove quarry run?"
        message="Remove this load from today's timesheet? The ticket photo will also be deleted from cloud storage when synced."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        processingLabel="Removing…"
        processing={deleting}
        variant="danger"
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </FormSection>
  )
}