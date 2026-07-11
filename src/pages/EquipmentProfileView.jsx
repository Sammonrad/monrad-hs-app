import { useMemo, useState } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import { EquipmentStatusBadge } from '../components/equipment/EquipmentStatusBadge.jsx'
import { DefectSeverityBadge } from '../components/equipment/DefectSeverityBadge.jsx'
import { MaintenanceDueBadge } from '../components/equipment/MaintenanceDueBadge.jsx'
import { ComplianceExpiryBadge } from '../components/equipment/ComplianceExpiryBadge.jsx'
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
} from '../utils/storage/equipmentCloudStorage.js'
import {
  getServicesForEquipment,
  saveServiceRecord,
  updateServiceRecord,
} from '../utils/storage/equipmentServiceCloudStorage.js'
import {
  getDocumentsForEquipment,
  saveDocumentRecord,
  updateDocumentRecord,
} from '../utils/storage/equipmentDocumentCloudStorage.js'
import {
  getDefectsForEquipment,
  saveDefectRecord,
  updateDefectRecord,
  getMergedDefectRecords,
} from '../utils/storage/equipmentDefectStorage.js'
import { getMergedPreStartRecords } from '../utils/storage/preStartCloudStorage.js'
import {
  PrintableEquipmentProfile,
  PrintableDefectReport,
  PrintableMaintenanceHistory,
  PrintableComplianceSummary,
} from '../components/equipment/PrintableEquipment.jsx'

export function EquipmentProfileView({
  onBack,
  onNavigate,
  equipmentId,
  user,
  profile,
  settings,
  equipment,
  setEquipment,
  serviceRecords,
  setServiceRecords,
  documentRecords,
  setDocumentRecords,
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

  const asset = useMemo(() => getEquipmentById(equipment, equipmentId), [equipment, equipmentId])

  const mergedDefects = useMemo(
    () => getMergedDefectRecords(localDefectRecords, defectRecords),
    [localDefectRecords, defectRecords],
  )

  const assetDefects = useMemo(
    () => getDefectsForEquipment(mergedDefects, equipmentId).filter((d) => d.status !== 'Resolved'),
    [mergedDefects, equipmentId],
  )

  const assetServices = useMemo(
    () => getServicesForEquipment(serviceRecords, equipmentId),
    [serviceRecords, equipmentId],
  )

  const assetDocuments = useMemo(
    () => getDocumentsForEquipment(documentRecords, equipmentId),
    [documentRecords, equipmentId],
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
  }

  async function handleSaveEquipment(form) {
    setSaving(true)
    setSaveError('')
    const { exists, error: checkError } = await checkAssetNumberExists(form.assetNumber, form.cloudId)
    if (checkError || exists) {
      setSaveError(exists ? 'An asset with this asset number already exists.' : checkError.message)
      setSaving(false)
      return
    }
    const { record, error } = await updateEquipmentRecord(user, form)
    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    setEquipment((prev) => prev.map((e) => (e.cloudId === record.cloudId ? record : e)))
    closeModal()
  }

  async function handleArchive() {
    if (!window.confirm(`Archive ${getEquipmentReadableName(asset)}?`)) return
    const updated = { ...asset, archived: true }
    const { record, error } = await updateEquipmentRecord(user, updated)
    if (!error && record) {
      setEquipment((prev) => prev.map((e) => (e.cloudId === record.cloudId ? record : e)))
    }
  }

  async function handleReactivate() {
    const updated = { ...asset, archived: false }
    const { record, error } = await updateEquipmentRecord(user, updated)
    if (!error && record) {
      setEquipment((prev) => prev.map((e) => (e.cloudId === record.cloudId ? record : e)))
    }
  }

  async function handleStatusUpdate(values) {
    const updated = { ...asset, ...values }
    const { record, error } = await updateEquipmentRecord(user, updated)
    if (!error && record) {
      setEquipment((prev) => prev.map((e) => (e.cloudId === record.cloudId ? record : e)))
    }
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
        <EquipmentStatusBadge status={asset.operationalStatus} />
      </header>

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
              <button type="button" className="btn btn--secondary" onClick={handleArchive}>Archive asset</button>
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
            <div><dt>Next service date</dt><dd>{asset.nextServiceDate || '—'}</dd></div>
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
                <li key={defect.id}>
                  <DefectSeverityBadge severity={defect.severity} /> {defect.description}
                  <span className="equipment-profile-list__meta">{defect.status}</span>
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
                <li key={service.id}>
                  <strong>{service.serviceDate}</strong> — {service.serviceType}: {service.workCompleted || 'No details'}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="equipment-profile-section">
          <h2>Upcoming maintenance</h2>
          <MaintenanceDueBadge equipment={asset} />
          <p>Next service: {asset.nextServiceDate || '—'} · {asset.nextServiceHours || '—'} hrs · {asset.nextServiceOdometer || '—'} km</p>
        </section>

        <section className="equipment-profile-section">
          <h2>Compliance documents</h2>
          <button type="button" className="btn btn--secondary btn--small no-print" onClick={() => handlePrint('compliance')}>Print summary</button>
          {assetDocuments.length === 0 ? (
            <p>No compliance documents.</p>
          ) : (
            <ul className="equipment-profile-list">
              {assetDocuments.map((doc) => (
                <li key={doc.id}>
                  {doc.documentTitle} ({doc.documentType}) — <ComplianceExpiryBadge document={doc} />
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
                    <td>{record.fields?.date}</td>
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
                initial={{ equipmentId: asset.cloudId, equipmentName: getEquipmentReadableName(asset), reportedByName: profile?.full_name?.trim() || '' }}
                onSave={async (form) => {
                  const saveFn = form.cloudId ? updateDefectRecord : saveDefectRecord
                  const { record, error } = await saveFn(user, form)
                  if (!error) setDefectRecords((prev) => [record, ...prev.filter((d) => d.cloudId !== record?.cloudId)])
                  closeModal()
                }}
                onCancel={closeModal}
                saving={saving}
                isAdmin={isAdmin}
                operatorOptions={operatorOptions}
              />
            )}
            {modal.type === 'service' && (
              <ServiceForm
                equipment={equipment.filter((e) => !e.archived)}
                initial={{ equipmentId: asset.cloudId }}
                onSave={async (form) => {
                  const { record, error } = await saveServiceRecord(user, form)
                  if (!error) setServiceRecords((prev) => [record, ...prev])
                  closeModal()
                }}
                onCancel={closeModal}
                saving={saving}
              />
            )}
            {modal.type === 'document' && (
              <DocumentForm
                equipment={equipment.filter((e) => !e.archived)}
                initial={{ equipmentId: asset.cloudId }}
                onSave={async (form) => {
                  const { record, error } = await saveDocumentRecord(user, form)
                  if (!error) setDocumentRecords((prev) => [record, ...prev])
                  closeModal()
                }}
                onCancel={closeModal}
                saving={saving}
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
