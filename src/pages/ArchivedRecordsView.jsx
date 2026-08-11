import { useCallback, useEffect, useMemo, useState } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import { EmptyState } from '../components/common/EmptyState.jsx'
import { FilterDisclosure } from '../components/common/FilterDisclosure.jsx'
import { LoadingState } from '../components/common/LoadingState.jsx'
import { StatusBadge } from '../components/common/StatusBadge.jsx'
import { getEquipmentReadableName } from '../constants/equipmentConfig.js'
import { getSsspStatusLabel } from '../constants/ssspStatuses.js'
import { formatSubmittedAt, formatNzDate, formatFieldDisplayValue } from '../utils/formatting.js'
import { formatTime12Hour } from '../utils/time12Hour.js'
import { getFormTypeLabel, getRecordTitle } from '../utils/records.js'
import { PermanentDeleteModal } from '../components/PermanentDeleteModal.jsx'
import { ARCHIVE_RECORD_TYPES, isArchived } from '../utils/storage/archiveFilter.js'
import {
  canPermanentlyDelete,
  permanentlyDeleteArchivedRecord,
  restoreArchivedRecord,
} from '../utils/storage/archiveActions.js'
import { fetchJobStartRecords, getMergedJobStartRecords } from '../utils/storage/jobStartCloudStorage.js'
import { fetchPreStartRecords, getMergedPreStartRecords } from '../utils/storage/preStartCloudStorage.js'
import { fetchToolboxRecords, getMergedToolboxRecords } from '../utils/storage/toolboxCloudStorage.js'
import { fetchIncidentRecords, getMergedIncidentRecords } from '../utils/storage/incidentCloudStorage.js'
import { fetchTimesheetRecords, getMergedTimesheetRecords } from '../utils/storage/timesheetCloudStorage.js'
import { fetchActionRecords, getMergedActions } from '../utils/storage/actionCloudStorage.js'
import {
  fetchVisitorSignInRecords,
  getMergedVisitorRecords,
} from '../utils/storage/visitorSignInCloudStorage.js'
import {
  fetchGeneralMeetingRecords,
  getMergedMeetings,
} from '../utils/storage/generalMeetingCloudStorage.js'
import {
  fetchEquipmentRecords,
  getMergedEquipmentRecords,
  loadLocalEquipmentRecords,
} from '../utils/storage/equipmentCloudStorage.js'
import { fetchSsspRecords } from '../utils/storage/ssspCloudStorage.js'
import { loadSavedRecords } from '../utils/storage/recordsStorage.js'
import { loadActions } from '../utils/storage/actionsStorage.js'
import { loadVisitorRecords } from '../utils/storage/visitorSignInStorage.js'
import { loadMeetings } from '../utils/storage/generalMeetingStorage.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'

const RECORD_TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: ARCHIVE_RECORD_TYPES.JOB_START, label: 'Job Start' },
  { id: ARCHIVE_RECORD_TYPES.PRE_START, label: 'Pre-Start' },
  { id: ARCHIVE_RECORD_TYPES.TOOLBOX, label: 'Toolbox' },
  { id: ARCHIVE_RECORD_TYPES.INCIDENT, label: 'Incident' },
  { id: ARCHIVE_RECORD_TYPES.TIMESHEET, label: 'Timesheets' },
  { id: ARCHIVE_RECORD_TYPES.ACTION, label: 'Action Register' },
  { id: ARCHIVE_RECORD_TYPES.VISITOR, label: 'Visitor Sign-In' },
  { id: ARCHIVE_RECORD_TYPES.GENERAL_MEETING, label: 'General Meetings' },
  { id: ARCHIVE_RECORD_TYPES.EQUIPMENT, label: 'Equipment' },
  { id: ARCHIVE_RECORD_TYPES.SSSP, label: 'SSSP' },
]

function formatDateLabel(value) {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) {
    return formatNzDate(value)
  }
  try {
    return formatSubmittedAt(value)
  } catch {
    return String(value)
  }
}

function sortByDateDesc(a, b) {
  const timeA = Date.parse(a.sortDate || '') || 0
  const timeB = Date.parse(b.sortDate || '') || 0
  return timeB - timeA
}

function toFormItem(record, type) {
  const fields = record.fields ?? {}
  const date = fields.date || record.submittedAt || record.createdAt || ''
  const person =
    fields.employeeName ||
    fields.operatorName ||
    fields.operator ||
    fields.reportedBy ||
    fields.meetingLedBy ||
    fields.facilitator ||
    ''
  const site = fields.siteLocation || fields.jobName || fields.jobProjectName || ''
  const title = getRecordTitle(record)
  return {
    key: `${type}:${record.cloudId || record.id}`,
    recordType: type,
    typeLabel: getFormTypeLabel(type) || RECORD_TYPE_FILTERS.find((t) => t.id === type)?.label || type,
    dateLabel: formatDateLabel(date),
    sortDate: date || record.submittedAt || record.createdAt || '',
    title,
    meta: [person, site].filter(Boolean).join(' · ') || '—',
    statusLabel: record.cloudId ? 'Archived' : 'Local',
    record,
    searchText: [title, person, site, type, record.cloudId, record.id]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  }
}

function buildArchivedItems({
  jobStarts,
  preStarts,
  toolbox,
  incidents,
  timesheets,
  actions,
  visitors,
  meetings,
  equipment,
  sssps,
}) {
  const items = []

  for (const record of jobStarts) {
    if (isArchived(record, ARCHIVE_RECORD_TYPES.JOB_START)) {
      items.push(toFormItem(record, ARCHIVE_RECORD_TYPES.JOB_START))
    }
  }
  for (const record of preStarts) {
    if (isArchived(record, ARCHIVE_RECORD_TYPES.PRE_START)) {
      items.push(toFormItem(record, ARCHIVE_RECORD_TYPES.PRE_START))
    }
  }
  for (const record of toolbox) {
    if (isArchived(record, ARCHIVE_RECORD_TYPES.TOOLBOX)) {
      items.push(toFormItem(record, ARCHIVE_RECORD_TYPES.TOOLBOX))
    }
  }
  for (const record of incidents) {
    if (isArchived(record, ARCHIVE_RECORD_TYPES.INCIDENT)) {
      items.push(toFormItem(record, ARCHIVE_RECORD_TYPES.INCIDENT))
    }
  }
  for (const record of timesheets) {
    if (isArchived(record, ARCHIVE_RECORD_TYPES.TIMESHEET)) {
      items.push(toFormItem(record, ARCHIVE_RECORD_TYPES.TIMESHEET))
    }
  }

  for (const action of actions) {
    if (!isArchived(action, ARCHIVE_RECORD_TYPES.ACTION)) continue
    const title = action.description?.slice(0, 80) || 'Action'
    items.push({
      key: `action:${action.cloudId || action.id}`,
      recordType: ARCHIVE_RECORD_TYPES.ACTION,
      typeLabel: 'Action Register',
      dateLabel: formatDateLabel(action.date || action.createdAt),
      sortDate: action.date || action.createdAt || '',
      title,
      meta: [action.personResponsible, action.site].filter(Boolean).join(' · ') || '—',
      statusLabel: action.cloudId ? 'Archived' : 'Local',
      record: action,
      searchText: [title, action.personResponsible, action.site, action.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    })
  }

  for (const visitor of visitors) {
    if (!isArchived(visitor, ARCHIVE_RECORD_TYPES.VISITOR)) continue
    const title = visitor.visitorName || 'Visitor'
    items.push({
      key: `visitor:${visitor.cloudId || visitor.id}`,
      recordType: ARCHIVE_RECORD_TYPES.VISITOR,
      typeLabel: 'Visitor Sign-In',
      dateLabel: formatDateLabel(visitor.arrivalTime || visitor.createdAt),
      sortDate: visitor.arrivalTime || visitor.createdAt || '',
      title,
      meta: [visitor.siteName, visitor.company, visitor.personVisited]
        .filter(Boolean)
        .join(' · ') || '—',
      statusLabel: visitor.cloudId ? 'Archived' : 'Local',
      record: visitor,
      searchText: [title, visitor.siteName, visitor.company, visitor.purpose]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    })
  }

  for (const meeting of meetings) {
    if (!isArchived(meeting, ARCHIVE_RECORD_TYPES.GENERAL_MEETING)) continue
    const title = meeting.meetingType
      ? `${meeting.meetingType} meeting`
      : 'H&S General Meeting'
    items.push({
      key: `gm:${meeting.cloudId || meeting.id}`,
      recordType: ARCHIVE_RECORD_TYPES.GENERAL_MEETING,
      typeLabel: 'General Meeting',
      dateLabel: formatDateLabel(meeting.meetingDate || meeting.createdAt),
      sortDate: meeting.meetingDate || meeting.createdAt || '',
      title,
      meta: [meeting.location, meeting.chairperson].filter(Boolean).join(' · ') || '—',
      statusLabel: meeting.cloudId ? 'Archived' : 'Local',
      record: meeting,
      searchText: [title, meeting.location, meeting.chairperson, meeting.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    })
  }

  for (const item of equipment) {
    if (!isArchived(item, ARCHIVE_RECORD_TYPES.EQUIPMENT)) continue
    const title = getEquipmentReadableName(item) || 'Equipment'
    items.push({
      key: `equipment:${item.cloudId || item.id}`,
      recordType: ARCHIVE_RECORD_TYPES.EQUIPMENT,
      typeLabel: 'Equipment',
      dateLabel: formatDateLabel(item.updatedAt || item.createdAt),
      sortDate: item.updatedAt || item.createdAt || '',
      title,
      meta: [item.assetType, item.operationalStatus].filter(Boolean).join(' · ') || '—',
      statusLabel: item.cloudId ? 'Archived' : 'Local',
      record: item,
      searchText: [title, item.assetType, item.make, item.model, item.serialNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    })
  }

  for (const sssp of sssps) {
    if (!isArchived(sssp, ARCHIVE_RECORD_TYPES.SSSP)) continue
    const title = sssp.ssspNumber || sssp.project || 'SSSP'
    items.push({
      key: `sssp:${sssp.cloudId || sssp.id}`,
      recordType: ARCHIVE_RECORD_TYPES.SSSP,
      typeLabel: 'SSSP',
      dateLabel: formatDateLabel(sssp.archivedAt || sssp.updatedAt || sssp.effectiveDate),
      sortDate: sssp.archivedAt || sssp.updatedAt || sssp.effectiveDate || '',
      title,
      meta: [sssp.project, sssp.site, sssp.client].filter(Boolean).join(' · ') || '—',
      statusLabel: getSsspStatusLabel(sssp.status) || 'Archived',
      record: sssp,
      searchText: [title, sssp.project, sssp.site, sssp.client, sssp.preparedBy]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    })
  }

  return items.sort(sortByDateDesc)
}

function DetailRows({ item }) {
  const record = item.record
  const type = item.recordType

  if (
    type === ARCHIVE_RECORD_TYPES.JOB_START ||
    type === ARCHIVE_RECORD_TYPES.PRE_START ||
    type === ARCHIVE_RECORD_TYPES.TOOLBOX ||
    type === ARCHIVE_RECORD_TYPES.INCIDENT ||
    type === ARCHIVE_RECORD_TYPES.TIMESHEET
  ) {
    const fields = record.fields ?? {}
    const rows = Object.entries(fields)
      .filter(([, value]) => value != null && String(value).trim() !== '')
      .slice(0, 12)
    return (
      <dl className="equipment-summary-card__details archived-records__detail-dl">
        {rows.map(([key, value]) => (
          <div key={key} className="archived-records__detail-row">
            <dt>{key}</dt>
            <dd>{formatFieldDisplayValue(key, value)}</dd>
          </div>
        ))}
        {record.cloudId && (
          <div className="archived-records__detail-row">
            <dt>Cloud ID</dt>
            <dd>{record.cloudId}</dd>
          </div>
        )}
      </dl>
    )
  }

  if (type === ARCHIVE_RECORD_TYPES.ACTION) {
    return (
      <dl className="equipment-summary-card__details archived-records__detail-dl">
        <div className="archived-records__detail-row">
          <dt>Description</dt>
          <dd>{record.description || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Responsible</dt>
          <dd>{record.personResponsible || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Due</dt>
          <dd>{formatNzDate(record.dueDate)}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Status</dt>
          <dd>{record.status || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Site</dt>
          <dd>{record.site || '—'}</dd>
        </div>
        {record.notes ? (
          <div className="archived-records__detail-row">
            <dt>Notes</dt>
            <dd>{record.notes}</dd>
          </div>
        ) : null}
      </dl>
    )
  }

  if (type === ARCHIVE_RECORD_TYPES.VISITOR) {
    return (
      <dl className="equipment-summary-card__details archived-records__detail-dl">
        <div className="archived-records__detail-row">
          <dt>Visitor</dt>
          <dd>{record.visitorName || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Site</dt>
          <dd>{record.siteName || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Company</dt>
          <dd>{record.company || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Purpose</dt>
          <dd>{record.purpose || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Arrival</dt>
          <dd>{formatDateLabel(record.arrivalTime)}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Departure</dt>
          <dd>{record.departureTime ? formatDateLabel(record.departureTime) : 'On site / —'}</dd>
        </div>
      </dl>
    )
  }

  if (type === ARCHIVE_RECORD_TYPES.GENERAL_MEETING) {
    return (
      <dl className="equipment-summary-card__details archived-records__detail-dl">
        <div className="archived-records__detail-row">
          <dt>Date</dt>
          <dd>{formatNzDate(record.meetingDate)}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Time</dt>
          <dd>{formatTime12Hour(record.meetingTime) || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Location</dt>
          <dd>{record.location || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Chairperson</dt>
          <dd>{record.chairperson || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Status</dt>
          <dd>{record.status || '—'}</dd>
        </div>
      </dl>
    )
  }

  if (type === ARCHIVE_RECORD_TYPES.EQUIPMENT) {
    return (
      <dl className="equipment-summary-card__details archived-records__detail-dl">
        <div className="archived-records__detail-row">
          <dt>Asset</dt>
          <dd>{getEquipmentReadableName(record) || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Type</dt>
          <dd>{record.assetType || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Make / model</dt>
          <dd>{[record.make, record.model].filter(Boolean).join(' ') || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Status</dt>
          <dd>{record.operationalStatus || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Location</dt>
          <dd>{record.normalLocation || '—'}</dd>
        </div>
      </dl>
    )
  }

  if (type === ARCHIVE_RECORD_TYPES.SSSP) {
    return (
      <dl className="equipment-summary-card__details archived-records__detail-dl">
        <div className="archived-records__detail-row">
          <dt>Number</dt>
          <dd>{record.ssspNumber || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Project</dt>
          <dd>{record.project || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Site</dt>
          <dd>{record.site || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Client</dt>
          <dd>{record.client || '—'}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Status</dt>
          <dd>{getSsspStatusLabel(record.status)}</dd>
        </div>
        <div className="archived-records__detail-row">
          <dt>Prepared by</dt>
          <dd>{record.preparedBy || '—'}</dd>
        </div>
      </dl>
    )
  }

  return null
}

export function ArchivedRecordsView({
  onBack,
  onNavigate,
  user,
  profile,
  savedRecords,
  setSavedRecords,
  actions,
  setActions,
  visitorRecords,
  setVisitorRecords,
  setCloudEquipment,
  setCloudSsspRecords,
  setCloudGeneralMeetings,
  setCloudActions,
  setCloudVisitorRecords,
  setCloudJobStarts,
  setCloudPreStarts,
  setCloudToolboxRecords,
  setCloudIncidents,
  setCloudTimesheets,
}) {
  const isAdmin = isAdminProfile(profile)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedKey, setExpandedKey] = useState(null)
  const [restoringKey, setRestoringKey] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadArchived = useCallback(async () => {
    if (!isAdmin || !user?.id) {
      setItems([])
      setLoading(false)
      setFetchError('')
      return
    }

    setLoading(true)
    setFetchError('')

    const opts = { isAdmin: true, includeArchived: true }
    const localSaved = savedRecords ?? loadSavedRecords()
    const localActions = actions ?? loadActions()
    const localVisitors = visitorRecords ?? loadVisitorRecords()
    const localMeetings = loadMeetings()
    const localEquipment = loadLocalEquipmentRecords()

    const results = await Promise.all([
      fetchJobStartRecords(user.id, opts),
      fetchPreStartRecords(user.id, opts),
      fetchToolboxRecords(user.id, opts),
      fetchIncidentRecords(user.id, opts),
      fetchTimesheetRecords(user.id, opts),
      fetchActionRecords(user.id, opts),
      fetchVisitorSignInRecords(user.id, { includeArchived: true }),
      fetchGeneralMeetingRecords(user.id, opts),
      fetchEquipmentRecords(user.id, { includeArchived: true }),
      fetchSsspRecords(user.id, { isAdmin: true, includeArchived: true }),
    ])

    const [
      jobRes,
      preRes,
      toolboxRes,
      incidentRes,
      timesheetRes,
      actionRes,
      visitorRes,
      meetingRes,
      equipmentRes,
      ssspRes,
    ] = results

    const errors = results
      .map((result) => result.error)
      .filter(Boolean)
      .map((error) => error.message || 'Load failed')

    const nextItems = buildArchivedItems({
      jobStarts: getMergedJobStartRecords(localSaved, jobRes.records, { includeArchived: true }),
      preStarts: getMergedPreStartRecords(localSaved, preRes.records, { includeArchived: true }),
      toolbox: getMergedToolboxRecords(localSaved, toolboxRes.records, { includeArchived: true }),
      incidents: getMergedIncidentRecords(localSaved, incidentRes.records, { includeArchived: true }),
      timesheets: getMergedTimesheetRecords(localSaved, timesheetRes.records, {
        includeArchived: true,
      }),
      actions: getMergedActions(localActions, actionRes.records, { includeArchived: true }),
      visitors: getMergedVisitorRecords(localVisitors, visitorRes.records, {
        includeArchived: true,
      }),
      meetings: getMergedMeetings(localMeetings, meetingRes.records, { includeArchived: true }),
      equipment: getMergedEquipmentRecords(localEquipment, equipmentRes.records, {
        includeArchived: true,
      }),
      sssps: ssspRes.records ?? [],
    })

    setItems(nextItems)
    setLoading(false)
    if (errors.length) {
      setFetchError(errors[0])
    }
  }, [isAdmin, user?.id, savedRecords, actions, visitorRecords])

  useEffect(() => {
    let mounted = true
    loadArchived().then(() => {
      if (!mounted) return
    })
    return () => {
      mounted = false
    }
  }, [loadArchived])

  useEffect(() => {
    if (!isAdmin && onBack) {
      onBack()
    }
  }, [isAdmin, onBack])

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.recordType !== typeFilter) return false
      if (query && !item.searchText.includes(query)) return false
      return true
    })
  }, [items, typeFilter, searchQuery])

  function syncAppStateAfterRestore(type, restored) {
    if (!restored) return

    if (
      type === ARCHIVE_RECORD_TYPES.JOB_START ||
      type === ARCHIVE_RECORD_TYPES.PRE_START ||
      type === ARCHIVE_RECORD_TYPES.TOOLBOX ||
      type === ARCHIVE_RECORD_TYPES.INCIDENT ||
      type === ARCHIVE_RECORD_TYPES.TIMESHEET
    ) {
      setSavedRecords?.(loadSavedRecords())
      const cloudSetters = {
        [ARCHIVE_RECORD_TYPES.JOB_START]: setCloudJobStarts,
        [ARCHIVE_RECORD_TYPES.PRE_START]: setCloudPreStarts,
        [ARCHIVE_RECORD_TYPES.TOOLBOX]: setCloudToolboxRecords,
        [ARCHIVE_RECORD_TYPES.INCIDENT]: setCloudIncidents,
        [ARCHIVE_RECORD_TYPES.TIMESHEET]: setCloudTimesheets,
      }
      const setter = cloudSetters[type]
      setter?.((prev) =>
        (prev ?? []).map((row) =>
          row.cloudId === restored.cloudId || row.id === restored.id
            ? { ...row, archived: false }
            : row,
        ),
      )
      return
    }

    if (type === ARCHIVE_RECORD_TYPES.ACTION) {
      setActions?.(loadActions())
      setCloudActions?.((prev) =>
        (prev ?? []).map((row) =>
          row.cloudId === restored.cloudId || row.id === restored.id
            ? { ...row, archived: false }
            : row,
        ),
      )
      return
    }

    if (type === ARCHIVE_RECORD_TYPES.VISITOR) {
      setVisitorRecords?.(loadVisitorRecords())
      setCloudVisitorRecords?.((prev) =>
        (prev ?? []).map((row) =>
          row.cloudId === restored.cloudId || row.id === restored.id
            ? { ...row, archived: false }
            : row,
        ),
      )
      return
    }

    if (type === ARCHIVE_RECORD_TYPES.GENERAL_MEETING) {
      setCloudGeneralMeetings?.((prev) =>
        (prev ?? []).map((row) =>
          row.cloudId === restored.cloudId || row.id === restored.id
            ? { ...row, archived: false }
            : row,
        ),
      )
      return
    }

    if (type === ARCHIVE_RECORD_TYPES.EQUIPMENT) {
      setCloudEquipment?.((prev) =>
        (prev ?? []).map((row) =>
          row.cloudId === restored.cloudId || row.id === restored.id
            ? { ...row, ...restored, archived: false }
            : row,
        ),
      )
      return
    }

    if (type === ARCHIVE_RECORD_TYPES.SSSP) {
      setCloudSsspRecords?.((prev) => {
        const list = prev ?? []
        const without = list.filter((row) => row.cloudId !== restored.cloudId)
        return [restored, ...without]
      })
    }
  }

  async function handleRestore(item) {
    if (!user?.id || restoringKey || deleting) return
    setRestoringKey(item.key)
    setActionError('')
    setActionMessage('')

    const { record: restored, error } = await restoreArchivedRecord(
      item.recordType,
      item.record,
      user,
      profile,
      { preparedByName: profile?.full_name?.trim() || user.email || 'Admin' },
    )

    setRestoringKey(null)

    if (error || !restored) {
      setActionError(error?.message || 'Restore failed.')
      return
    }

    setActionMessage(`Restored: ${item.title}`)
    syncAppStateAfterRestore(item.recordType, restored)
    setItems((prev) => prev.filter((row) => row.key !== item.key))
    if (expandedKey === item.key) setExpandedKey(null)
  }

  function syncAppStateAfterDelete(type, deleted) {
    if (!deleted) return
    const match = (row) =>
      (deleted.cloudId && row.cloudId === deleted.cloudId) ||
      (deleted.id && row.id === deleted.id)

    if (
      type === ARCHIVE_RECORD_TYPES.JOB_START ||
      type === ARCHIVE_RECORD_TYPES.PRE_START ||
      type === ARCHIVE_RECORD_TYPES.TOOLBOX ||
      type === ARCHIVE_RECORD_TYPES.TIMESHEET
    ) {
      setSavedRecords?.(loadSavedRecords())
      const cloudSetters = {
        [ARCHIVE_RECORD_TYPES.JOB_START]: setCloudJobStarts,
        [ARCHIVE_RECORD_TYPES.PRE_START]: setCloudPreStarts,
        [ARCHIVE_RECORD_TYPES.TOOLBOX]: setCloudToolboxRecords,
        [ARCHIVE_RECORD_TYPES.TIMESHEET]: setCloudTimesheets,
      }
      cloudSetters[type]?.((prev) => (prev ?? []).filter((row) => !match(row)))
      return
    }

    if (type === ARCHIVE_RECORD_TYPES.ACTION) {
      setActions?.(loadActions())
      setCloudActions?.((prev) => (prev ?? []).filter((row) => !match(row)))
      return
    }

    if (type === ARCHIVE_RECORD_TYPES.GENERAL_MEETING) {
      setCloudGeneralMeetings?.((prev) => (prev ?? []).filter((row) => !match(row)))
    }
  }

  function openDeleteModal(item) {
    if (deleting || restoringKey) return
    setActionError('')
    setActionMessage('')
    setDeleteError('')
    setDeleteConfirmText('')
    setDeleteTarget(item)
  }

  function closeDeleteModal() {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteConfirmText('')
    setDeleteError('')
  }

  async function handlePermanentDelete() {
    if (!deleteTarget || deleting || deleteConfirmText !== 'DELETE') return
    setDeleting(true)
    setDeleteError('')
    setActionError('')
    setActionMessage('')

    const { ok, error } = await permanentlyDeleteArchivedRecord(
      deleteTarget.recordType,
      deleteTarget.record,
      user,
      profile,
    )

    if (!ok) {
      setDeleting(false)
      setDeleteError(error?.message || 'Delete failed.')
      return
    }

    syncAppStateAfterDelete(deleteTarget.recordType, deleteTarget.record)
    setItems((prev) => prev.filter((row) => row.key !== deleteTarget.key))
    if (expandedKey === deleteTarget.key) setExpandedKey(null)
    setActionMessage(`Permanently deleted: ${deleteTarget.title}`)
    setDeleting(false)
    setDeleteTarget(null)
    setDeleteConfirmText('')
    setDeleteError('')
    await loadArchived()
  }

  function handleViewToggle(item) {
    setExpandedKey((prev) => (prev === item.key ? null : item.key))
  }

  function handleOpenInModule(item) {
    if (!onNavigate) return
    const record = item.record
    switch (item.recordType) {
      case ARCHIVE_RECORD_TYPES.JOB_START:
      case ARCHIVE_RECORD_TYPES.PRE_START:
      case ARCHIVE_RECORD_TYPES.TOOLBOX:
      case ARCHIVE_RECORD_TYPES.INCIDENT:
      case ARCHIVE_RECORD_TYPES.TIMESHEET:
        onNavigate(item.recordType, { highlightRecordId: record.id })
        break
      case ARCHIVE_RECORD_TYPES.ACTION:
        onNavigate('action-register', { highlightActionId: record.id })
        break
      case ARCHIVE_RECORD_TYPES.VISITOR:
        onNavigate('visitor-sign-in')
        break
      case ARCHIVE_RECORD_TYPES.GENERAL_MEETING:
        onNavigate('general-meeting', { meetingId: record.cloudId || record.id })
        break
      case ARCHIVE_RECORD_TYPES.EQUIPMENT:
        onNavigate('equipment-profile', { equipmentId: record.cloudId || record.id })
        break
      case ARCHIVE_RECORD_TYPES.SSSP:
        onNavigate('sssp-editor', { ssspCloudId: record.cloudId, ssspMode: 'view' })
        break
      default:
        break
    }
  }

  if (!isAdmin) {
    return (
      <>
        <BackButton onClick={onBack} />
        <p className="staff-management__access-denied" role="alert">
          Access denied — admin only.
        </p>
      </>
    )
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header no-print form-page-header form-page-header--mobile-compact">
        <p className="company form-page-header__company">Monrad Earthworx</p>
        <h1 className="title form-page-header__title">Archived Records</h1>
        <p className="progress" aria-live="polite">
          {loading
            ? 'Loading archived records…'
            : `${filteredItems.length} archived record${filteredItems.length === 1 ? '' : 's'}`}
        </p>
        {fetchError && (
          <p className="validation-message" role="alert">
            {fetchError}
          </p>
        )}
        {actionError && (
          <p className="validation-message" role="alert">
            {actionError}
          </p>
        )}
        {actionMessage && !actionError && (
          <p className="form-hint" role="status">
            {actionMessage}
          </p>
        )}
        <p className="form-hint">
          Admin-only archive register. Use View for details on this page; Restore returns the record
          to active lists. Permanently Delete is available only for allowed archived types and
          requires typing DELETE.
        </p>
      </header>

      <section className="records-search no-print" aria-labelledby="archived-records-filters-heading">
        <div className="records-search__header">
          <h2 id="archived-records-filters-heading" className="records-summary__title">
            Filters
          </h2>
          {(typeFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              className="records-search__clear"
              onClick={() => {
                setTypeFilter('all')
                setSearchQuery('')
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        <label className="field records-search__query">
          <span className="field__label">Search</span>
          <input
            type="search"
            className="field__input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Name, site, asset, project…"
          />
        </label>

        <FilterDisclosure
          activeCount={typeFilter !== 'all' ? 1 : 0}
          onReset={() => setTypeFilter('all')}
        >
          <div className="records-search__filters">
            <label className="field records-search__filter">
              <span className="field__label">Record type</span>
              <select
                className="field__input"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                {RECORD_TYPE_FILTERS.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </FilterDisclosure>
      </section>

      <section className="archived-records__list no-print" aria-live="polite">
        {loading ? (
          <LoadingState label="Loading archived records…" />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            title="No archived records found"
            description="Archived items will appear here. Try clearing filters if you expected results."
            secondaryAction={
              typeFilter !== 'all' || searchQuery
                ? {
                    label: 'Clear filters',
                    onClick: () => {
                      setTypeFilter('all')
                      setSearchQuery('')
                    },
                  }
                : undefined
            }
          />
        ) : (
          filteredItems.map((item) => {
            const expanded = expandedKey === item.key
            return (
              <article key={item.key} className="equipment-summary-card archived-records__card">
                <header className="equipment-summary-card__header">
                  <div>
                    <p className="archived-records__type">{item.typeLabel}</p>
                    <h3 className="equipment-summary-card__title">{item.title}</h3>
                    <p className="equipment-summary-card__meta">
                      {item.dateLabel}
                      {item.meta && item.meta !== '—' ? ` · ${item.meta}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={item.statusLabel} label={item.statusLabel} />
                </header>

                {expanded && (
                  <div className="archived-records__detail">
                    <DetailRows item={item} />
                    <p className="form-hint archived-records__detail-note">
                      Active module lists hide archived rows. Restore first to open the live module
                      view.
                    </p>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => handleOpenInModule(item)}
                    >
                      Open in module
                    </button>
                  </div>
                )}

                <div className="equipment-summary-card__actions">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => handleViewToggle(item)}
                    aria-expanded={expanded}
                    disabled={deleting}
                  >
                    {expanded ? 'Hide' : 'View'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => handleRestore(item)}
                    disabled={restoringKey === item.key || deleting}
                  >
                    {restoringKey === item.key ? 'Restoring…' : 'Restore'}
                  </button>
                  {canPermanentlyDelete(item.recordType, item.record) ? (
                    <button
                      type="button"
                      className="btn btn--secondary btn--danger-text archived-records__delete-btn"
                      onClick={() => openDeleteModal(item)}
                      disabled={deleting || Boolean(restoringKey)}
                    >
                      Permanently Delete
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })
        )}
      </section>

      <PermanentDeleteModal
        open={Boolean(deleteTarget)}
        onCancel={closeDeleteModal}
        onConfirm={handlePermanentDelete}
        deleting={deleting}
        error={deleteError}
        recordLabel={deleteTarget?.title || ''}
        confirmText={deleteConfirmText}
        onConfirmTextChange={setDeleteConfirmText}
      />
    </>
  )
}
