import { useMemo, useState, useEffect } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import { EquipmentStatusBadge } from '../components/equipment/EquipmentStatusBadge.jsx'
import { DefectSeverityBadge } from '../components/equipment/DefectSeverityBadge.jsx'
import { MaintenanceDueBadge } from '../components/equipment/MaintenanceDueBadge.jsx'
import { ComplianceExpiryBadge } from '../components/equipment/ComplianceExpiryBadge.jsx'
import { EquipmentSummaryCard } from '../components/equipment/EquipmentSummaryCard.jsx'
import {
  EquipmentForm,
  DefectForm,
  ServiceForm,
  DocumentForm,
  ServiceUpdatePrompt,
} from '../components/equipment/EquipmentForms.jsx'
import {
  ASSET_TYPES,
  OPERATIONAL_STATUSES,
  OWNERSHIP_STATUSES,
  matchesEquipmentSearch,
  getEquipmentReadableName,
  getEquipmentMakeModel,
} from '../constants/equipmentConfig.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
import {
  checkAssetNumberExists,
  saveEquipmentRecord,
  updateEquipmentRecord,
  persistLocalEquipmentRecords,
  getMergedEquipmentRecords,
  isCloudSaveUnavailable,
  getUnavailableSyncStatus,
  formatCloudSaveError,
  isAuthRequiredError,
  NOT_SIGNED_IN_CLOUD_MESSAGE,
  requireEquipmentCloudUser,
  SYNC_STATUS,
} from '../utils/storage/equipmentCloudStorage.js'
import {
  saveServiceRecord,
  updateServiceRecord,
  persistLocalServiceRecords,
  getMergedServiceRecords,
} from '../utils/storage/equipmentServiceCloudStorage.js'
import {
  saveDocumentRecord,
  updateDocumentRecord,
  persistLocalDocumentRecords,
  getMergedDocumentRecords,
} from '../utils/storage/equipmentDocumentCloudStorage.js'
import {
  saveDefectRecord,
  updateDefectRecord,
  sortDefectsForDisplay,
  persistLocalDefectRecords,
  getMergedDefectRecords,
} from '../utils/storage/equipmentDefectStorage.js'
import { computeEquipmentStats } from '../utils/equipmentStats.js'
import { CloudSyncBadge } from '../components/CloudSyncBadge.jsx'

const TABS = [
  { id: 'register', label: 'Register' },
  { id: 'defects', label: 'Defects' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'compliance', label: 'Compliance' },
]

function StatCard({ label, value, variant }) {
  const hasIssue = variant === 'warning' || variant === 'alert'
  return (
    <div className={`equipment-stat${hasIssue ? ` equipment-stat--${variant}` : ''}`}>
      <span className="equipment-stat__value">{value}</span>
      <span className="equipment-stat__label">{label}</span>
    </div>
  )
}

export function EquipmentView({
  onBack,
  onNavigate,
  initialTab = 'register',
  initialDefectPrefill = null,
  user,
  profile,
  settings,
  cloudEquipment,
  setCloudEquipment,
  localEquipment,
  setLocalEquipment,
  cloudServiceRecords,
  setCloudServiceRecords,
  localServiceRecords,
  setLocalServiceRecords,
  cloudDocumentRecords,
  setCloudDocumentRecords,
  localDocumentRecords,
  setLocalDocumentRecords,
  defectRecords,
  setDefectRecords,
  localDefectRecords,
  setLocalDefectRecords,
}) {
  const isAdmin = isAdminProfile(profile)
  const operatorOptions = getSettingsOptions(settings).operators
  const [tab, setTab] = useState(initialTab)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterOwnership, setFilterOwnership] = useState('')
  const [filterPrestart, setFilterPrestart] = useState('')
  const [filterRoadLegal, setFilterRoadLegal] = useState('')
  const [filterArchived, setFilterArchived] = useState('active')
  const [defectStatusFilter, setDefectStatusFilter] = useState('')
  const [defectSeverityFilter, setDefectSeverityFilter] = useState('')
  const [defectMachineFilter, setDefectMachineFilter] = useState('')
  const [defectDateFrom, setDefectDateFrom] = useState('')
  const [defectDateTo, setDefectDateTo] = useState('')
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [serviceUpdatePrompt, setServiceUpdatePrompt] = useState(null)

  useEffect(() => {
    if (initialDefectPrefill) {
      setTab('defects')
      setModal({ type: 'report-defect', prefill: initialDefectPrefill })
    }
  }, [initialDefectPrefill])

  const equipment = useMemo(
    () => getMergedEquipmentRecords(localEquipment, cloudEquipment),
    [localEquipment, cloudEquipment],
  )
  const serviceRecords = useMemo(
    () => getMergedServiceRecords(localServiceRecords, cloudServiceRecords),
    [localServiceRecords, cloudServiceRecords],
  )
  const documentRecords = useMemo(
    () => getMergedDocumentRecords(localDocumentRecords, cloudDocumentRecords),
    [localDocumentRecords, cloudDocumentRecords],
  )
  const mergedDefects = useMemo(
    () => getMergedDefectRecords(localDefectRecords, defectRecords),
    [localDefectRecords, defectRecords],
  )

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

  function equipmentKey(item) {
    return item.cloudId ?? item.id
  }

  const stats = useMemo(
    () =>
      computeEquipmentStats({
        equipment,
        defectRecords: mergedDefects,
        serviceRecords,
        documentRecords,
      }),
    [equipment, mergedDefects, serviceRecords, documentRecords],
  )

  const filteredEquipment = useMemo(() => {
    return equipment
      .filter((item) => {
        if (filterArchived === 'active' && item.archived) return false
        if (filterArchived === 'archived' && !item.archived) return false
        if (filterType && item.assetType !== filterType) return false
        if (filterStatus && item.operationalStatus !== filterStatus) return false
        if (filterOwnership && item.ownershipStatus !== filterOwnership) return false
        if (filterPrestart === 'yes' && !item.prestartRequired) return false
        if (filterPrestart === 'no' && item.prestartRequired) return false
        if (filterRoadLegal === 'yes' && !item.roadLegal) return false
        if (filterRoadLegal === 'no' && item.roadLegal) return false
        return matchesEquipmentSearch(item, search)
      })
      .sort((a, b) => {
        if (a.archived !== b.archived) return a.archived ? 1 : -1
        return (a.assetNumber || '').localeCompare(b.assetNumber || '')
      })
  }, [equipment, search, filterType, filterStatus, filterOwnership, filterPrestart, filterRoadLegal, filterArchived])

  const filteredDefects = useMemo(() => {
    return sortDefectsForDisplay(
      mergedDefects.filter((defect) => {
        if (defectStatusFilter && defect.status !== defectStatusFilter) return false
        if (defectSeverityFilter && defect.severity !== defectSeverityFilter) return false
        if (defectMachineFilter && defect.equipmentId !== defectMachineFilter) return false
        if (defectDateFrom && (defect.reportedAt?.slice(0, 10) ?? '') < defectDateFrom) return false
        if (defectDateTo && (defect.reportedAt?.slice(0, 10) ?? '') > defectDateTo) return false
        return true
      }),
    )
  }, [mergedDefects, defectStatusFilter, defectSeverityFilter, defectMachineFilter, defectDateFrom, defectDateTo])

  const activeEquipment = useMemo(
    () => equipment.filter((item) => !item.archived),
    [equipment],
  )

  function closeModal() {
    setModal(null)
    setSaveError('')
    setSaving(false)
  }

  async function handleSaveEquipment(form) {
    if (!form.assetNumber?.trim() || !form.assetName?.trim()) {
      setSaveError('Asset number and asset name are required.')
      return
    }
    setSaving(true)
    setSaveError('')

    const localDuplicate = equipment.some(
      (item) =>
        item.assetNumber?.trim().toLowerCase() === form.assetNumber.trim().toLowerCase() &&
        item.id !== form.id &&
        item.cloudId !== form.cloudId,
    )
    if (localDuplicate) {
      setSaveError('An asset with this asset number already exists on this device.')
      setSaving(false)
      return
    }

    const persistLocalFallback = (syncStatus) => {
      const localRecord = {
        ...form,
        syncStatus,
        storageSource: 'local',
        updatedAt: new Date().toISOString(),
      }
      return upsertLocalEquipment(localRecord)
    }

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

    const { exists, error: checkError } = await checkAssetNumberExists(
      form.assetNumber,
      form.cloudId,
    )
    if (checkError) {
      setSaveError(`Could not verify asset number: ${formatCloudSaveError(checkError)}`)
      setSaving(false)
      return
    }
    if (exists) {
      setSaveError('An asset with this asset number already exists.')
      setSaving(false)
      return
    }

    const saveFn = form.cloudId ? updateEquipmentRecord : saveEquipmentRecord
    const { record, error } = await saveFn(cloudUser, form)
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
          error ?? { code: 'NO_ROW', message: 'Insert returned no row.' },
          { adminRequired: true },
        )}`,
      )
      return
    }

    setCloudEquipment((prev) => {
      const without = prev.filter((item) => item.cloudId !== record.cloudId && item.id !== form.id)
      return [...without, record].sort((a, b) =>
        (a.assetNumber || '').localeCompare(b.assetNumber || ''),
      )
    })
    setLocalEquipment((prev) => {
      const next = prev.filter((item) => item.id !== form.id && item.cloudId !== record.cloudId)
      persistLocalEquipmentRecords(next)
      return next
    })
    closeModal()
  }

  async function handleSaveDefect(form) {
    if (!form.equipmentId) {
      setSaveError('Please select equipment.')
      return
    }
    if (form.status === 'Resolved' && isAdmin) {
      if (!form.resolutionDetails?.trim()) {
        setSaveError('Resolution details are required when resolving a defect.')
        return
      }
      form.resolvedAt = form.resolvedAt || new Date().toISOString()
      form.resolvedByName = profile?.full_name?.trim() || profile?.email?.split('@')[0] || 'Admin'
    }

    setSaving(true)
    setSaveError('')

    if (isCloudSaveUnavailable(user)) {
      const syncStatus = getUnavailableSyncStatus(user)
      const localRecord = { ...form, syncStatus, storageSource: 'local' }
      const next = [localRecord, ...localDefectRecords.filter((d) => d.id !== form.id)]
      if (persistLocalDefectRecords(next)) {
        setLocalDefectRecords(next)
        closeModal()
      } else {
        setSaveError('Could not save defect locally.')
      }
      setSaving(false)
      return
    }

    const saveFn = form.cloudId ? updateDefectRecord : saveDefectRecord
    const payload = {
      ...form,
      reportedByName: form.reportedByName || profile?.full_name?.trim() || '',
    }
    const { record, error } = await saveFn(user, payload)
    setSaving(false)
    if (error) {
      const syncStatus = SYNC_STATUS.CLOUD_FAILED
      const localRecord = { ...payload, syncStatus, storageSource: 'local' }
      const next = [localRecord, ...localDefectRecords.filter((d) => d.id !== form.id)]
      persistLocalDefectRecords(next)
      setLocalDefectRecords(next)
      setSaveError(`Cloud save failed — saved locally. ${formatCloudSaveError(error)}`)
      return
    }
    setDefectRecords((prev) => {
      const without = prev.filter((d) => d.cloudId !== record.cloudId)
      return [record, ...without]
    })
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
      setServiceUpdatePrompt({ service: localRecord, equipmentId: form.equipmentId })
      setSaving(false)
      closeModal()
      return
    }

    const saveFn = form.cloudId ? updateServiceRecord : saveServiceRecord
    const { record, error } = await saveFn(user, form)
    setSaving(false)
    if (error) {
      const localRecord = {
        ...form,
        syncStatus: SYNC_STATUS.CLOUD_FAILED,
        storageSource: 'local',
      }
      upsertLocalService(localRecord)
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
    setServiceUpdatePrompt({ service: record, equipmentId: form.equipmentId })
    closeModal()
  }

  async function applyServiceUpdate() {
    if (!serviceUpdatePrompt) return
    const { service, equipmentId } = serviceUpdatePrompt
    const asset = equipment.find((e) => equipmentKey(e) === equipmentId)
    if (!asset) {
      setServiceUpdatePrompt(null)
      return
    }
    const updated = {
      ...asset,
      ...(service.operatingHours ? { currentHours: service.operatingHours } : {}),
      ...(service.odometer ? { currentOdometer: service.odometer } : {}),
      ...(service.nextServiceDate ? { nextServiceDate: service.nextServiceDate } : {}),
      ...(service.nextServiceHours ? { nextServiceHours: service.nextServiceHours } : {}),
      ...(service.nextServiceOdometer ? { nextServiceOdometer: service.nextServiceOdometer } : {}),
    }

    if (isCloudSaveUnavailable(user)) {
      const syncStatus = getUnavailableSyncStatus(user)
      upsertLocalEquipment({ ...updated, syncStatus, storageSource: 'local' })
      setServiceUpdatePrompt(null)
      return
    }

    const { record, error } = await updateEquipmentRecord(user, updated)
    if (error) {
      upsertLocalEquipment({
        ...updated,
        syncStatus: SYNC_STATUS.CLOUD_FAILED,
        storageSource: 'local',
      })
      setSaveError(
        `Cloud equipment update failed — saved locally. ${formatCloudSaveError(error, { adminRequired: true })}`,
      )
      setServiceUpdatePrompt(null)
      return
    }
    if (record) {
      setCloudEquipment((prev) => prev.map((e) => (e.cloudId === record.cloudId ? record : e)))
    }
    setServiceUpdatePrompt(null)
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
      setSaving(false)
      closeModal()
      return
    }

    const saveFn = form.cloudId ? updateDocumentRecord : saveDocumentRecord
    const { record, error } = await saveFn(user, form)
    setSaving(false)
    if (error) {
      const localRecord = {
        ...form,
        syncStatus: SYNC_STATUS.CLOUD_FAILED,
        storageSource: 'local',
      }
      upsertLocalDocument(localRecord)
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

  function getEquipmentName(equipmentId) {
    const item = equipment.find((e) => equipmentKey(e) === equipmentId)
    return item ? getEquipmentReadableName(item) : '—'
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="equipment-page-header">
        <h1 className="page-title">Machines &amp; Equipment</h1>
        <p className="page-description">Plant register, defects, maintenance and compliance</p>
      </header>

      <section className="equipment-stats" aria-label="Summary statistics">
        <StatCard label="Active assets" value={stats.activeAssets} />
        <StatCard label="Out of service" value={stats.outOfService} variant={stats.outOfService > 0 ? 'warning' : undefined} />
        <StatCard label="Open defects" value={stats.openDefects} variant={stats.openDefects > 0 ? 'warning' : undefined} />
        <StatCard label="Critical defects" value={stats.criticalDefects} variant={stats.criticalDefects > 0 ? 'alert' : undefined} />
        <StatCard label="Services overdue" value={stats.servicesOverdue} variant={stats.servicesOverdue > 0 ? 'warning' : undefined} />
        <StatCard label="Due soon" value={stats.servicesDueSoon} variant={stats.servicesDueSoon > 0 ? 'warning' : undefined} />
        <StatCard label="Docs expired" value={stats.documentsExpired} variant={stats.documentsExpired > 0 ? 'warning' : undefined} />
        <StatCard label="Expiring soon" value={stats.documentsExpiringSoon} variant={stats.documentsExpiringSoon > 0 ? 'warning' : undefined} />
      </section>

      <nav className="equipment-tabs" aria-label="Equipment sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`equipment-tabs__btn${tab === item.id ? ' equipment-tabs__btn--active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'register' && (
        <section className="equipment-section">
          <div className="equipment-toolbar">
            <input
              type="search"
              className="form-input equipment-toolbar__search"
              placeholder="Search assets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="form-input" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All types</option>
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All statuses</option>
              {OPERATIONAL_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className="form-input" value={filterOwnership} onChange={(e) => setFilterOwnership(e.target.value)}>
              <option value="">All ownership</option>
              {OWNERSHIP_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className="form-input" value={filterPrestart} onChange={(e) => setFilterPrestart(e.target.value)}>
              <option value="">Pre-start: all</option>
              <option value="yes">Pre-start required</option>
              <option value="no">Not required</option>
            </select>
            <select className="form-input" value={filterArchived} onChange={(e) => setFilterArchived(e.target.value)}>
              <option value="active">Active only</option>
              <option value="archived">Archived only</option>
              <option value="all">All</option>
            </select>
            {isAdmin && (
              <button type="button" className="btn btn--primary" onClick={() => setModal({ type: 'add-equipment' })}>
                Add equipment
              </button>
            )}
          </div>

          <div className="responsive-data-list">
            <div className="responsive-data-list__desktop">
              <div className="data-table-scroll">
                <table className="equipment-table">
                  <thead>
                    <tr>
                      <th>Asset #</th>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Make / model</th>
                      <th>Registration</th>
                      <th>Status</th>
                      <th>Hours / km</th>
                      <th>Next service</th>
                      <th>Defects</th>
                      <th>Pre-start</th>
                      <th>Sync</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEquipment.length === 0 && (
                      <tr><td colSpan={12}>No equipment found.</td></tr>
                    )}
                    {filteredEquipment.map((item) => {
                      const key = equipmentKey(item)
                      const openCount = mergedDefects.filter(
                        (d) =>
                          (d.equipmentId === item.cloudId || d.equipmentId === item.id) &&
                          d.status !== 'Resolved',
                      ).length
                      return (
                        <tr key={key} className={item.archived ? 'equipment-table__row--archived' : ''}>
                          <td>{item.assetNumber}</td>
                          <td>{item.assetName}</td>
                          <td>{item.assetType || '—'}</td>
                          <td>{getEquipmentMakeModel(item)}</td>
                          <td>{item.registrationNumber || '—'}</td>
                          <td><EquipmentStatusBadge status={item.operationalStatus} /></td>
                          <td>{item.currentHours || '—'} / {item.currentOdometer || '—'}</td>
                          <td>
                            <MaintenanceDueBadge equipment={item} />
                          </td>
                          <td>{openCount}</td>
                          <td>{item.prestartRequired ? 'Yes' : 'No'}</td>
                          <td><CloudSyncBadge syncStatus={item.syncStatus} size="small" /></td>
                          <td>
                            <button
                              type="button"
                              className="btn btn--secondary btn--small"
                              onClick={() => onNavigate('equipment-profile', { equipmentId: key })}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="responsive-data-list__mobile">
              {filteredEquipment.length === 0 && <p>No equipment found.</p>}
              {filteredEquipment.map((item) => (
                <EquipmentSummaryCard
                  key={equipmentKey(item)}
                  equipment={item}
                  defectRecords={mergedDefects}
                  onView={() => onNavigate('equipment-profile', { equipmentId: equipmentKey(item) })}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === 'defects' && (
        <section className="equipment-section">
          <div className="equipment-toolbar">
            <select className="form-input" value={defectStatusFilter} onChange={(e) => setDefectStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {['Open', 'In Progress', 'Deferred', 'Resolved'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className="form-input" value={defectSeverityFilter} onChange={(e) => setDefectSeverityFilter(e.target.value)}>
              <option value="">All severities</option>
              {['Minor', 'Major', 'Critical'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className="form-input" value={defectMachineFilter} onChange={(e) => setDefectMachineFilter(e.target.value)}>
              <option value="">All machines</option>
              {equipment.filter((e) => !e.archived).map((e) => (
                <option key={equipmentKey(e)} value={equipmentKey(e)}>{getEquipmentReadableName(e)}</option>
              ))}
            </select>
            <input type="date" className="form-input" value={defectDateFrom} onChange={(e) => setDefectDateFrom(e.target.value)} aria-label="From date" />
            <input type="date" className="form-input" value={defectDateTo} onChange={(e) => setDefectDateTo(e.target.value)} aria-label="To date" />
            <button type="button" className="btn btn--primary" onClick={() => setModal({ type: 'report-defect' })}>
              Report defect
            </button>
          </div>

          <div className="responsive-data-list">
            <div className="responsive-data-list__desktop">
              <div className="data-table-scroll">
                <table className="equipment-table">
                  <thead>
                    <tr>
                      <th>Machine</th>
                      <th>Reported</th>
                      <th>Severity</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Assigned</th>
                      <th>Sync</th>
                      {isAdmin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDefects.length === 0 && (
                      <tr><td colSpan={isAdmin ? 8 : 7}>No defects found.</td></tr>
                    )}
                    {filteredDefects.map((defect) => (
                      <tr key={defect.id} className={defect.severity === 'Critical' && defect.status !== 'Resolved' ? 'equipment-table__row--critical' : ''}>
                        <td>{defect.equipmentName || getEquipmentName(defect.equipmentId)}</td>
                        <td>{new Date(defect.reportedAt).toLocaleString('en-NZ')}</td>
                        <td><DefectSeverityBadge severity={defect.severity} /></td>
                        <td>{defect.description}</td>
                        <td>{defect.status}</td>
                        <td>{defect.assignedPerson || '—'}</td>
                        <td><CloudSyncBadge syncStatus={defect.syncStatus} /></td>
                        {isAdmin && (
                          <td>
                            <button type="button" className="btn btn--secondary btn--small" onClick={() => setModal({ type: 'edit-defect', defect })}>
                              Manage
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="responsive-data-list__mobile">
              {filteredDefects.length === 0 && <p>No defects found.</p>}
              {filteredDefects.map((defect) => (
                <article key={defect.id} className={`equipment-defect-card${defect.severity === 'Critical' ? ' equipment-defect-card--critical' : ''}`}>
                  <header>
                    <DefectSeverityBadge severity={defect.severity} />
                    <span>{defect.status}</span>
                  </header>
                  <p>{defect.equipmentName || getEquipmentName(defect.equipmentId)}</p>
                  <p>{defect.description}</p>
                  <CloudSyncBadge syncStatus={defect.syncStatus} />
                  {isAdmin && (
                    <button type="button" className="btn btn--secondary" onClick={() => setModal({ type: 'edit-defect', defect })}>
                      Manage
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === 'maintenance' && (
        <section className="equipment-section">
          {isAdmin && (
            <div className="equipment-toolbar">
              <button type="button" className="btn btn--primary" onClick={() => setModal({ type: 'add-service' })}>
                Record service
              </button>
            </div>
          )}
          <h3 className="equipment-section__subtitle">Maintenance due</h3>
          <div className="responsive-data-list">
            <div className="responsive-data-list__desktop">
              <div className="data-table-scroll">
                <table className="equipment-table">
                  <thead>
                    <tr>
                      <th>Machine</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Provider</th>
                      <th>Work completed</th>
                      <th>Due status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEquipment.length === 0 && (
                      <tr><td colSpan={6}>No active equipment.</td></tr>
                    )}
                    {activeEquipment.map((item) => (
                      <tr key={equipmentKey(item)}>
                        <td>{getEquipmentReadableName(item)}</td>
                        <td>{item.nextServiceDate || '—'}</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td><MaintenanceDueBadge equipment={item} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="responsive-data-list__mobile">
              {activeEquipment.length === 0 && <p>No active equipment.</p>}
              {activeEquipment.map((item) => (
                <article key={item.cloudId ?? item.id} className="equipment-summary-card">
                  <header className="equipment-summary-card__header">
                    <div>
                      <h3 className="equipment-summary-card__title">{getEquipmentReadableName(item)}</h3>
                      <p className="equipment-summary-card__meta">
                        {item.assetNumber || '—'}
                        {item.assetType ? ` · ${item.assetType}` : ''}
                      </p>
                    </div>
                    <MaintenanceDueBadge equipment={item} />
                  </header>
                  <dl className="equipment-summary-card__details">
                    <dt>Next service</dt>
                    <dd>{item.nextServiceDate || '—'}</dd>
                    <dt>Next hours / odo</dt>
                    <dd>
                      {item.nextServiceHours || item.nextServiceOdometer
                        ? `${item.nextServiceHours ? `${item.nextServiceHours} hrs` : '—'}${item.nextServiceOdometer ? ` · ${item.nextServiceOdometer} km` : ''}`
                        : '—'}
                    </dd>
                  </dl>
                  <div className="equipment-summary-card__actions">
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => onNavigate('equipment-profile', { equipmentId: equipmentKey(item) })}
                    >
                      View
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => setModal({ type: 'add-service', equipmentId: equipmentKey(item) })}
                      >
                        Record service
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <h3 className="equipment-section__subtitle">Service history</h3>
          <div className="responsive-data-list">
            <div className="responsive-data-list__desktop">
              <div className="data-table-scroll">
                <table className="equipment-table">
                  <thead>
                    <tr>
                      <th>Machine</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Hours / km</th>
                      <th>Provider</th>
                      <th>Work completed</th>
                      <th>Next service</th>
                      <th>Sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceRecords.length === 0 && (
                      <tr><td colSpan={8}>No service records.</td></tr>
                    )}
                    {serviceRecords.map((record) => (
                      <tr key={record.cloudId ?? record.id}>
                        <td>{getEquipmentName(record.equipmentId)}</td>
                        <td>{record.serviceDate}</td>
                        <td>{record.serviceType}</td>
                        <td>
                          {record.operatingHours || '—'} / {record.odometer || '—'}
                        </td>
                        <td>{record.serviceProvider || '—'}</td>
                        <td>{record.workCompleted || '—'}</td>
                        <td>
                          {record.nextServiceDate || record.nextServiceHours || record.nextServiceOdometer
                            ? [
                                record.nextServiceDate,
                                record.nextServiceHours ? `${record.nextServiceHours} hrs` : null,
                                record.nextServiceOdometer ? `${record.nextServiceOdometer} km` : null,
                              ].filter(Boolean).join(' · ')
                            : '—'}
                        </td>
                        <td><CloudSyncBadge syncStatus={record.syncStatus} size="small" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="responsive-data-list__mobile">
              {serviceRecords.length === 0 && <p>No service records.</p>}
              {serviceRecords.map((record) => (
                <article key={record.cloudId ?? record.id} className="equipment-summary-card">
                  <header className="equipment-summary-card__header">
                    <div>
                      <h3 className="equipment-summary-card__title">{getEquipmentName(record.equipmentId)}</h3>
                      <p className="equipment-summary-card__meta">
                        {record.serviceDate || '—'} · {record.serviceType || '—'}
                      </p>
                    </div>
                  </header>
                  <dl className="equipment-summary-card__details">
                    <dt>Hours / odo</dt>
                    <dd>
                      {record.operatingHours ? `${record.operatingHours} hrs` : '—'}
                      {record.odometer ? ` · ${record.odometer} km` : ''}
                    </dd>
                    <dt>Provider</dt>
                    <dd>{record.serviceProvider || '—'}</dd>
                    <dt>Work completed</dt>
                    <dd>{record.workCompleted || '—'}</dd>
                    <dt>Next service</dt>
                    <dd>
                      {record.nextServiceDate || record.nextServiceHours || record.nextServiceOdometer
                        ? [
                            record.nextServiceDate,
                            record.nextServiceHours ? `${record.nextServiceHours} hrs` : null,
                            record.nextServiceOdometer ? `${record.nextServiceOdometer} km` : null,
                          ].filter(Boolean).join(' · ')
                        : '—'}
                    </dd>
                  </dl>
                  <div className="equipment-summary-card__actions">
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => onNavigate('equipment-profile', { equipmentId: record.equipmentId })}
                    >
                      View
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === 'compliance' && (
        <section className="equipment-section">
          {isAdmin && (
            <div className="equipment-toolbar">
              <button type="button" className="btn btn--primary" onClick={() => setModal({ type: 'add-document' })}>
                Add document
              </button>
            </div>
          )}
          <div className="responsive-data-list">
            <div className="responsive-data-list__desktop">
              <div className="data-table-scroll">
                <table className="equipment-table">
                  <thead>
                    <tr>
                      <th>Machine</th>
                      <th>Type</th>
                      <th>Title</th>
                      <th>Reference</th>
                      <th>Issuing org</th>
                      <th>Issue</th>
                      <th>Expiry</th>
                      <th>Status</th>
                      <th>Sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentRecords.length === 0 && (
                      <tr><td colSpan={9}>No compliance documents.</td></tr>
                    )}
                    {documentRecords.map((doc) => (
                      <tr key={doc.cloudId ?? doc.id}>
                        <td>{getEquipmentName(doc.equipmentId)}</td>
                        <td>{doc.documentType}</td>
                        <td>{doc.documentTitle}</td>
                        <td>{doc.referenceNumber || '—'}</td>
                        <td>{doc.issuingOrganisation || '—'}</td>
                        <td>{doc.issueDate || '—'}</td>
                        <td>{doc.expiryDate || '—'}</td>
                        <td><ComplianceExpiryBadge document={doc} /></td>
                        <td><CloudSyncBadge syncStatus={doc.syncStatus} size="small" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="responsive-data-list__mobile">
              {documentRecords.length === 0 && <p>No compliance documents.</p>}
              {documentRecords.map((doc) => (
                <article key={doc.cloudId ?? doc.id} className="equipment-summary-card">
                  <header className="equipment-summary-card__header">
                    <div>
                      <h3 className="equipment-summary-card__title">{doc.documentTitle || doc.documentType || 'Document'}</h3>
                      <p className="equipment-summary-card__meta">
                        {getEquipmentName(doc.equipmentId)}
                        {doc.documentType ? ` · ${doc.documentType}` : ''}
                      </p>
                    </div>
                    <ComplianceExpiryBadge document={doc} />
                  </header>
                  <dl className="equipment-summary-card__details">
                    <dt>Reference</dt>
                    <dd>{doc.referenceNumber || '—'}</dd>
                    <dt>Issuing org</dt>
                    <dd>{doc.issuingOrganisation || '—'}</dd>
                    <dt>Issue date</dt>
                    <dd>{doc.issueDate || '—'}</dd>
                    <dt>Expiry</dt>
                    <dd>{doc.expiryDate || '—'}</dd>
                  </dl>
                  <div className="equipment-summary-card__actions">
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => onNavigate('equipment-profile', { equipmentId: doc.equipmentId })}
                    >
                      View
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {modal && (
        <div className="equipment-modal-overlay" role="dialog" aria-modal="true">
          <div className="equipment-modal">
            <button type="button" className="equipment-modal__close" onClick={closeModal} aria-label="Close">×</button>
            {modal.type === 'add-equipment' && (
              <EquipmentForm onSave={handleSaveEquipment} onCancel={closeModal} saving={saving} saveError={saveError} operatorOptions={operatorOptions} />
            )}
            {modal.type === 'report-defect' && (
              <DefectForm equipment={equipment.filter((e) => !e.archived)} onSave={handleSaveDefect} onCancel={closeModal} saving={saving} isAdmin={isAdmin} operatorOptions={operatorOptions} initial={{ reportedByName: profile?.full_name?.trim() || '', ...(modal.prefill || {}) }} />
            )}
            {modal.type === 'edit-defect' && (
              <DefectForm equipment={equipment} initial={modal.defect} onSave={handleSaveDefect} onCancel={closeModal} saving={saving} isAdmin={isAdmin} operatorOptions={operatorOptions} />
            )}
            {modal.type === 'add-service' && (
              <>
                <h2>Record service</h2>
                <ServiceForm equipment={equipment.filter((e) => !e.archived)} onSave={handleSaveService} onCancel={closeModal} saving={saving} initial={{ equipmentId: modal.equipmentId || '' }} />
              </>
            )}
            {modal.type === 'add-document' && (
              <>
                <h2>Add compliance document</h2>
                <DocumentForm equipment={equipment.filter((e) => !e.archived)} onSave={handleSaveDocument} onCancel={closeModal} saving={saving} initial={{ equipmentId: modal.equipmentId || '' }} />
              </>
            )}
          </div>
        </div>
      )}

      {serviceUpdatePrompt && (
        <div className="equipment-modal-overlay">
          <div className="equipment-modal">
            <ServiceUpdatePrompt service={serviceUpdatePrompt.service} onConfirm={applyServiceUpdate} onSkip={() => setServiceUpdatePrompt(null)} />
          </div>
        </div>
      )}
    </>
  )
}
