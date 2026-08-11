import { useMemo, useState } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import { EquipmentStatusBadge } from '../components/equipment/EquipmentStatusBadge.jsx'
import { DefectSeverityBadge } from '../components/equipment/DefectSeverityBadge.jsx'
import { MaintenanceDueBadge } from '../components/equipment/MaintenanceDueBadge.jsx'
import { ComplianceExpiryBadge } from '../components/equipment/ComplianceExpiryBadge.jsx'
import { CloudSyncBadge } from '../components/CloudSyncBadge.jsx'
import {
  EquipmentForm,
  DefectForm,
  ServiceForm,
  DocumentForm,
  StatusUpdateForm,
} from '../components/equipment/EquipmentForms.jsx'
import {
  getEquipmentReadableName,
  getEquipmentMakeModel,
} from '../constants/equipmentConfig.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
import {
  getEquipmentById,
  checkAssetNumberExists,
  updateEquipmentRecord,
  persistLocalEquipmentRecords,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
  formatCloudSaveError,
  isAuthRequiredError,
  NOT_SIGNED_IN_CLOUD_MESSAGE,
  requireEquipmentCloudUser,
  SYNC_STATUS,
} from '../utils/storage/equipmentCloudStorage.js'
import { ARCHIVE_RECORD_TYPES } from '../utils/storage/archiveFilter.js'
import { AdminArchiveAction } from '../components/AdminArchiveAction.jsx'
import {
  getServicesForEquipment,
  saveServiceRecord,
  updateServiceRecord,
  persistLocalServiceRecords,
} from '../utils/storage/equipmentServiceCloudStorage.js'
import {
  getDocumentsForEquipment,
  saveDocumentRecord,
  updateDocumentRecord,
  persistLocalDocumentRecords,
} from '../utils/storage/equipmentDocumentCloudStorage.js'
import {
  getDefectsForEquipment,
  saveDefectRecord,
  updateDefectRecord,
  getMergedDefectRecords,
  persistLocalDefectRecords,
} from '../utils/storage/equipmentDefectStorage.js'
import { getMergedPreStartRecords } from '../utils/storage/preStartCloudStorage.js'
import {
  PrintableEquipmentProfile,
  PrintableMaintenanceHistory,
  PrintableComplianceSummary,
} from '../components/equipment/PrintableEquipment.jsx'
import { formatNzDate } from '../utils/formatting.js'

export function EquipmentProfileView({
  onBack,
  onNavigate,
  equipmentId,
  user,
  profile,
  settings,
  equipment,
  setCloudEquipment,
  localEquipment,
  setLocalEquipment,
  serviceRecords,
  setCloudServiceRecords,
  localServiceRecords,
  setLocalServiceRecords,
  documentRecords,
  setCloudDocumentRecords,
  localDocumentRecords,
  setLocalDocumentRecords,
  defectRecords,
  setDefectRecords,
  localDefectRecords,
  setLocalDefectRecords,
  savedRecords,
  cloudPreStarts,
  setPrintContent,
}) {
  const isAdmin = isAdminProfile(profile)
  const operatorOptions = getSettingsOptions(settings).operators
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [archiveMessage, setArchiveMessage] = useState('')

  const asset = useMemo(() => getEquipmentById(equipment, equipmentId), [equipment, equipmentId])
  const assetKey = asset?.cloudId ?? asset?.id

  const mergedDefects = useMemo(
    () => getMergedDefectRecords(localDefectRecords, defectRecords),
    [localDefectRecords, defectRecords],
  )

  const assetDefects = useMemo(
    () => getDefectsForEquipment(mergedDefects, assetKey).filter((d) => d.status !== 'Resolved'),
    [mergedDefects, assetKey],
  )

  const assetServices = useMemo(
    () => getServicesForEquipment(serviceRecords, assetKey),
    [serviceRecords, assetKey],
  )

  const assetDocuments = useMemo(
    () => getDocumentsForEquipment(documentRecords, assetKey),
    [documentRecords, assetKey],
  )

  const preStartHistory = useMemo(() => {
    if (!asset) return []
    const readable = getEquipmentReadableName(asset)
    const merged = getMergedPreStartRecords(savedRecords, cloudPreStarts)
    return merged
      .filter((record) => {
        const name = record.fields?.machineNameId?.trim()?.toLowerCase() ?? ''
        return (
          name === readable.toLowerCase() ||
          name === asset.assetNumber?.trim().toLowerCase() ||
          name === asset.assetName?.trim().toLowerCase()
        )
      })
      .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
  }, [asset, savedRecords, cloudPreStarts])

  function upsertLocalEquipment(record) {
    const next = [record, ...localEquipment.filter((item) => item.id !== record.id)]
    if (!persistLocalEquipmentRecords(next)) return false
    setLocalEquipment(next)
    return true
  }

  function upsertLocalService(record) {
    const next = [record, ...localServiceRecords.filter((item) => item.id !== record.id)]
    if (!persistLocalServiceRecords(next)) return false
    setLocalServiceRecords(next)
    return true
  }

  function upsertLocalDocument(record) {
    const next = [record, ...localDocumentRecords.filter((item) => item.id !== record.id)]
    if (!persistLocalDocumentRecords(next)) return false
    setLocalDocumentRecords(next)
    return true
  }

  if (!asset) {
    return (
      <>
        <BackButton onClick={onBack} />
        <p>Equipment not found.</p>
      </>
    )
  }

  function closeModal() {
    setModal(null)
    setSaveError('')
    setSaving(false)
  }

  async function handleSaveEquipment(form) {
    setSaving(true)
    setSaveError('')

    const persistLocalFallback = (syncStatus) =>
      upsertLocalEquipment({
        ...form,
        syncStatus,
        storageSource: 'local',
        updatedAt: new Date().toISOString(),
      })

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (!persistLocalFallback(SYNC_STATUS.OFFLINE)) {
        setSaveError('Could not save equipment locally.')
        setSaving(false)
        return
      }
      setSaveError('Offline/local save only')
      setSaving(false)
      return
    }

    const { user: cloudUser, error: authError } = await requireEquipmentCloudUser()
    if (authError || !cloudUser?.id) {
      if (!persistLocalFallback(SYNC_STATUS.LOCAL_ONLY)) {
        setSaveError('Could not save equipment locally.')
        setSaving(false)
        return
      }
      setSaveError(
        !authError || isAuthRequiredError(authError)
          ? NOT_SIGNED_IN_CLOUD_MESSAGE
          : `Cloud save failed — saved locally. ${formatCloudSaveError(authError)}`,
      )
      setSaving(false)
      return
    }

    const { exists, error: checkError } = await checkAssetNumberExists(form.assetNumber, form.cloudId)
    if (checkError || exists) {
      setSaveError(
        exists
          ? 'An asset with this asset number already exists.'
          : formatCloudSaveError(checkError),
      )
      setSaving(false)
      return
    }

    const { record, error } = await updateEquipmentRecord(cloudUser, form)
    setSaving(false)
    if (isAuthRequiredError(error)) {
      if (!persistLocalFallback(SYNC_STATUS.LOCAL_ONLY)) {
        setSaveError('Could not save equipment locally.')
        return
      }
      setSaveError(NOT_SIGNED_IN_CLOUD_MESSAGE)
      return
    }
    if (error || !record?.cloudId) {
      persistLocalFallback(SYNC_STATUS.CLOUD_FAILED)
      setSaveError(
        `Cloud save failed — saved locally. ${formatCloudSaveError(
          error ?? { code: 'NO_ROW', message: 'Update returned no row.' },
          { adminRequired: true },
        )}`,
      )
      return
    }
    setCloudEquipment((prev) => prev.map((e) => (e.cloudId === record.cloudId ? record : e)))
    setLocalEquipment((prev) => {
      const next = prev.filter((item) => item.id !== form.id && item.cloudId !== record.cloudId)
      persistLocalEquipmentRecords(next)
      return next
    })
    closeModal()
  }

  async function persistEquipmentPatch(updated) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      upsertLocalEquipment({
        ...updated,
        syncStatus: SYNC_STATUS.OFFLINE,
        storageSource: 'local',
      })
      return { ok: true }
    }

    const { user: cloudUser, error: authError } = await requireEquipmentCloudUser()
    if (authError || !cloudUser?.id) {
      upsertLocalEquipment({
        ...updated,
        syncStatus: SYNC_STATUS.LOCAL_ONLY,
        storageSource: 'local',
      })
      setSaveError(
        !authError || isAuthRequiredError(authError)
          ? NOT_SIGNED_IN_CLOUD_MESSAGE
          : `Cloud save failed — saved locally. ${formatCloudSaveError(authError)}`,
      )
      return { ok: false }
    }

    const { record, error } = await updateEquipmentRecord(cloudUser, updated)
    if (isAuthRequiredError(error)) {
      upsertLocalEquipment({
        ...updated,
        syncStatus: SYNC_STATUS.LOCAL_ONLY,
        storageSource: 'local',
      })
      setSaveError(NOT_SIGNED_IN_CLOUD_MESSAGE)
      return { ok: false }
    }
    if (error || !record?.cloudId) {
      upsertLocalEquipment({
        ...updated,
        syncStatus: SYNC_STATUS.CLOUD_FAILED,
        storageSource: 'local',
      })
      setSaveError(
        `Cloud save failed — saved locally. ${formatCloudSaveError(
          error ?? { code: 'NO_ROW', message: 'Update returned no row.' },
          { adminRequired: true },
        )}`,
      )
      return { ok: false }
    }
    setCloudEquipment((prev) => prev.map((e) => (e.cloudId === record.cloudId ? record : e)))
    return { ok: true }
  }

  function handleEquipmentArchived(archived, { localOnly } = {}) {
    if (archived.cloudId) {
      setCloudEquipment((prev) =>
        prev.map((item) =>
          item.cloudId === archived.cloudId ? { ...item, ...archived, archived: true } : item,
        ),
      )
    }
    setLocalEquipment((prev) => {
      const next = prev.map((item) =>
        item.id === archived.id || (archived.cloudId && item.cloudId === archived.cloudId)
          ? { ...item, archived: true }
          : item,
      )
      persistLocalEquipmentRecords(next)
      return next
    })
    setSaveError('')
    setArchiveMessage(
      localOnly
        ? 'Asset archived on this device (Local). Find it under Archived Records.'
        : 'Asset archived. Find it under Archived Records.',
    )
  }

  async function handleReactivate() {
    await persistEquipmentPatch({ ...asset, archived: false })
  }

  async function handleStatusUpdate(values) {
    await persistEquipmentPatch({ ...asset, ...values })
    closeModal()
  }

  async function handleSaveDefect(form) {
    setSaving(true)
    setSaveError('')
    if (isCloudSaveUnavailable(user)) {
      const syncStatus = getUnavailableSyncStatus(user)
      const localRecord = { ...form, syncStatus, storageSource: 'local' }
      const next = [localRecord, ...localDefectRecords.filter((d) => d.id !== form.id)]
      if (!persistLocalDefectRecords(next)) {
        setSaveError('Could not save defect locally.')
        setSaving(false)
        return
      }
      setLocalDefectRecords(next)
      closeModal()
      return
    }
    const saveFn = form.cloudId ? updateDefectRecord : saveDefectRecord
    const { record, error } = await saveFn(user, form)
    setSaving(false)
    if (error) {
      const localRecord = {
        ...form,
        syncStatus: SYNC_STATUS.CLOUD_FAILED,
        storageSource: 'local',
      }
      const next = [localRecord, ...localDefectRecords.filter((d) => d.id !== form.id)]
      persistLocalDefectRecords(next)
      setLocalDefectRecords(next)
      setSaveError(`Cloud save failed — saved locally. ${formatCloudSaveError(error)}`)
      return
    }
    setDefectRecords((prev) => [record, ...prev.filter((d) => d.cloudId !== record?.cloudId)])
    closeModal()
  }

  async function handleSaveService(form) {
    setSaving(true)
    setSaveError('')
    if (isCloudSaveUnavailable(user)) {
      const syncStatus = getUnavailableSyncStatus(user)
      const localRecord = { ...form, syncStatus, storageSource: 'local' }
      if (!upsertLocalService(localRecord)) {
        setSaveError('Could not save service record locally.')
        setSaving(false)
        return
      }
      closeModal()
      return
    }
    const saveFn = form.cloudId ? updateServiceRecord : saveServiceRecord
    const { record, error } = await saveFn(user, form)
    setSaving(false)
    if (error) {
      upsertLocalService({
        ...form,
        syncStatus: SYNC_STATUS.CLOUD_FAILED,
        storageSource: 'local',
      })
      setSaveError(
        `Cloud save failed — saved locally. ${formatCloudSaveError(error, { adminRequired: true })}`,
      )
      return
    }
    setCloudServiceRecords((prev) => [record, ...prev.filter((s) => s.cloudId !== record.cloudId)])
    setLocalServiceRecords((prev) => {
      const next = prev.filter((s) => s.id !== form.id && s.cloudId !== record.cloudId)
      persistLocalServiceRecords(next)
      return next
    })
    closeModal()
  }

  async function handleSaveDocument(form) {
    setSaving(true)
    setSaveError('')
    if (isCloudSaveUnavailable(user)) {
      const syncStatus = getUnavailableSyncStatus(user)
      const localRecord = { ...form, syncStatus, storageSource: 'local' }
      if (!upsertLocalDocument(localRecord)) {
        setSaveError('Could not save document locally.')
        setSaving(false)
        return
      }
      closeModal()
      return
    }
    const saveFn = form.cloudId ? updateDocumentRecord : saveDocumentRecord
    const { record, error } = await saveFn(user, form)
    setSaving(false)
    if (error) {
      upsertLocalDocument({
        ...form,
        syncStatus: SYNC_STATUS.CLOUD_FAILED,
        storageSource: 'local',
      })
      setSaveError(
        `Cloud save failed — saved locally. ${formatCloudSaveError(error, { adminRequired: true })}`,
      )
      return
    }
    setCloudDocumentRecords((prev) => [record, ...prev.filter((d) => d.cloudId !== record.cloudId)])
    setLocalDocumentRecords((prev) => {
      const next = prev.filter((d) => d.id !== form.id && d.cloudId !== record.cloudId)
      persistLocalDocumentRecords(next)
      return next
    })
    closeModal()
  }

  function handlePrint(type) {
    let content = null
    if (type === 'profile') {
      content = (
        <PrintableEquipmentProfile
          equipment={asset}
          defects={assetDefects}
          services={assetServices}
          documents={assetDocuments}
          preStarts={preStartHistory}
        />
      )
    } else if (type === 'maintenance') {
      content = <PrintableMaintenanceHistory equipment={asset} services={assetServices} />
    } else if (type === 'compliance') {
      content = <PrintableComplianceSummary equipment={asset} documents={assetDocuments} />
    }
    if (content) setPrintContent(content)
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="equipment-profile-header">
        <div>
          <h1 className="page-title">{asset.assetName}</h1>
          <p className="equipment-profile-header__meta">
            {asset.assetNumber} · {asset.assetType || '—'} · {getEquipmentMakeModel(asset)}
            {asset.registrationNumber && ` · ${asset.registrationNumber}`}
          </p>
        </div>
        <div className="equipment-summary-card__badge-row">
          <EquipmentStatusBadge status={asset.operationalStatus} />
          <CloudSyncBadge syncStatus={asset.syncStatus} />
        </div>
      </header>

      {saveError && !modal && (
        <p className="validation-message validation-message--error" role="alert">
          {saveError}
        </p>
      )}
      {archiveMessage && !modal && (
        <p className="form-hint" role="status">
          {archiveMessage}
        </p>
      )}

      <div className="equipment-profile-actions no-print">
        <button type="button" className="btn btn--secondary" onClick={() => setModal({ type: 'report-defect' })}>
          Report defect
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => onNavigate('pre-start')}>
          Open Machine Pre-Start
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => handlePrint('profile')}>
          Print profile
        </button>
        {isAdmin && (
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setModal({ type: 'edit' })}>Edit asset</button>
            <button type="button" className="btn btn--secondary" onClick={() => setModal({ type: 'service' })}>Record service</button>
            <button type="button" className="btn btn--secondary" onClick={() => setModal({ type: 'document' })}>Add document</button>
            <button type="button" className="btn btn--secondary" onClick={() => setModal({ type: 'status' })}>Change status</button>
            {asset.archived ? (
              <button type="button" className="btn btn--secondary" onClick={handleReactivate}>Reactivate</button>
            ) : (
              <AdminArchiveAction
                recordType={ARCHIVE_RECORD_TYPES.EQUIPMENT}
                record={asset}
                user={user}
                profile={profile}
                onArchived={handleEquipmentArchived}
                buttonClassName="btn btn--secondary archive-record-action"
              />
            )}
          </>
        )}
      </div>

      <div className="equipment-profile-grid">
        <section className="equipment-profile-section">
          <h2>Asset details</h2>
          <dl className="equipment-profile-dl">
            <div><dt>Serial number</dt><dd>{asset.serialNumber || '—'}</dd></div>
            <div><dt>Ownership</dt><dd>{asset.ownershipStatus || '—'}</dd></div>
            <div><dt>Assigned operator</dt><dd>{asset.assignedOperator || '—'}</dd></div>
            <div><dt>Normal location</dt><dd>{asset.normalLocation || '—'}</dd></div>
            <div><dt>Manufacture year</dt><dd>{asset.manufactureYear || '—'}</dd></div>
            <div><dt>Pre-start required</dt><dd>{asset.prestartRequired ? 'Yes' : 'No'}</dd></div>
            <div><dt>Road legal</dt><dd>{asset.roadLegal ? 'Yes' : 'No'}</dd></div>
          </dl>
        </section>

        <section className="equipment-profile-section">
          <h2>Current status</h2>
          <dl className="equipment-profile-dl">
            <div><dt>Operational status</dt><dd><EquipmentStatusBadge status={asset.operationalStatus} /></dd></div>
            <div><dt>Current hours</dt><dd>{asset.currentHours || '—'}</dd></div>
            <div><dt>Current odometer</dt><dd>{asset.currentOdometer ? `${asset.currentOdometer} km` : '—'}</dd></div>
            <div><dt>Next service</dt><dd><MaintenanceDueBadge equipment={asset} /></dd></div>
            <div><dt>Next service date</dt><dd>{formatNzDate(asset.nextServiceDate)}</dd></div>
            <div><dt>Next service hours</dt><dd>{asset.nextServiceHours || '—'}</dd></div>
          </dl>
        </section>

        <section className="equipment-profile-section">
          <h2>Open defects ({assetDefects.length})</h2>
          {assetDefects.length === 0 ? (
            <p>No open defects.</p>
          ) : (
            <ul className="equipment-profile-list">
              {assetDefects.map((defect) => (
                <li key={defect.cloudId ?? defect.id}>
                  <DefectSeverityBadge severity={defect.severity} /> {defect.description}
                  <span className="equipment-profile-list__meta">{defect.status}</span>
                  {' '}
                  <CloudSyncBadge syncStatus={defect.syncStatus} size="small" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="equipment-profile-section">
          <h2>Service history</h2>
          <button type="button" className="btn btn--secondary btn--small no-print" onClick={() => handlePrint('maintenance')}>Print history</button>
          {assetServices.length === 0 ? (
            <p>No service records.</p>
          ) : (
            <ul className="equipment-profile-list">
              {assetServices.map((service) => (
                <li key={service.cloudId ?? service.id}>
                  <strong>{formatNzDate(service.serviceDate)}</strong> — {service.serviceType}: {service.workCompleted || 'No details'}
                  {' '}
                  <CloudSyncBadge syncStatus={service.syncStatus} size="small" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="equipment-profile-section">
          <h2>Upcoming maintenance</h2>
          <MaintenanceDueBadge equipment={asset} />
          <p>Next service: {formatNzDate(asset.nextServiceDate)} · {asset.nextServiceHours || '—'} hrs · {asset.nextServiceOdometer || '—'} km</p>
        </section>

        <section className="equipment-profile-section">
          <h2>Compliance documents</h2>
          <button type="button" className="btn btn--secondary btn--small no-print" onClick={() => handlePrint('compliance')}>Print summary</button>
          {assetDocuments.length === 0 ? (
            <p>No compliance documents.</p>
          ) : (
            <ul className="equipment-profile-list">
              {assetDocuments.map((doc) => (
                <li key={doc.cloudId ?? doc.id}>
                  {doc.documentTitle} ({doc.documentType}) — <ComplianceExpiryBadge document={doc} />
                  {' '}
                  <CloudSyncBadge syncStatus={doc.syncStatus} size="small" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="equipment-profile-section equipment-profile-section--full">
          <h2>Pre-start history</h2>
          {preStartHistory.length === 0 ? (
            <p>No pre-start records for this asset.</p>
          ) : (
            <div className="responsive-data-list">
              <div className="responsive-data-list__desktop">
                <div className="data-table-scroll">
                  <table className="equipment-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Operator</th>
                        <th>Result</th>
                        <th>Defects</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {preStartHistory.map((record) => (
                        <tr key={record.id}>
                          <td>{formatNzDate(record.fields?.date)}</td>
                          <td>{record.fields?.operatorName}</td>
                          <td>{record.allComplete ? 'Complete' : 'Partial'}</td>
                          <td>{record.defectsFound === 'found' ? 'Defects found' : 'None'}</td>
                          <td>
                            <button type="button" className="btn btn--secondary btn--small" onClick={() => onNavigate('pre-start', { highlightRecordId: record.id })}>
                              Open
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="responsive-data-list__mobile">
                {preStartHistory.map((record) => (
                  <article key={record.id} className="equipment-summary-card">
                    <header className="equipment-summary-card__header">
                      <div>
                        <h3 className="equipment-summary-card__title">{formatNzDate(record.fields?.date)}</h3>
                        <p className="equipment-summary-card__meta">
                          {record.fields?.operatorName || '—'}
                        </p>
                      </div>
                    </header>
                    <dl className="equipment-summary-card__details">
                      <dt>Result</dt>
                      <dd>{record.allComplete ? 'Complete' : 'Partial'}</dd>
                      <dt>Defects</dt>
                      <dd>{record.defectsFound === 'found' ? 'Defects found' : 'None'}</dd>
                    </dl>
                    <div className="equipment-summary-card__actions">
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={() => onNavigate('pre-start', { highlightRecordId: record.id })}
                      >
                        Open
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        {asset.notes && (
          <section className="equipment-profile-section equipment-profile-section--full">
            <h2>Notes</h2>
            <p>{asset.notes}</p>
          </section>
        )}
      </div>

      {modal && (
        <div className="equipment-modal-overlay" role="dialog" aria-modal="true">
          <div className="equipment-modal">
            <button type="button" className="equipment-modal__close" onClick={closeModal} aria-label="Close">×</button>
            {modal.type === 'edit' && (
              <EquipmentForm initial={asset} onSave={handleSaveEquipment} onCancel={closeModal} saving={saving} saveError={saveError} operatorOptions={operatorOptions} />
            )}
            {modal.type === 'report-defect' && (
              <DefectForm
                equipment={equipment.filter((e) => !e.archived)}
                initial={{
                  equipmentId: assetKey,
                  equipmentName: getEquipmentReadableName(asset),
                  reportedByName: profile?.full_name?.trim() || '',
                }}
                onSave={handleSaveDefect}
                onCancel={closeModal}
                saving={saving}
                saveError={saveError}
                isAdmin={isAdmin}
                operatorOptions={operatorOptions}
              />
            )}
            {modal.type === 'service' && (
              <ServiceForm
                equipment={equipment.filter((e) => !e.archived)}
                initial={{ equipmentId: assetKey }}
                onSave={handleSaveService}
                onCancel={closeModal}
                saving={saving}
                saveError={saveError}
              />
            )}
            {modal.type === 'document' && (
              <DocumentForm
                equipment={equipment.filter((e) => !e.archived)}
                initial={{ equipmentId: assetKey }}
                onSave={handleSaveDocument}
                onCancel={closeModal}
                saving={saving}
                saveError={saveError}
              />
            )}
            {modal.type === 'status' && (
              <StatusUpdateForm equipment={asset} onSave={handleStatusUpdate} onCancel={closeModal} />
            )}
          </div>
        </div>
      )}
    </>
  )
}
