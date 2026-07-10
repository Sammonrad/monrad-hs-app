import { createRecordId } from '../ids.js'
import { TODAY } from '../../constants/index.js'
import { SSSP_EDITOR_DRAFT_KEY } from '../../constants/storageKeys.js'
import { createEmptySsspRecordData } from '../../constants/ssspSections.js'
import { SSSP_STATUS } from '../../constants/ssspStatuses.js'
import { calculateRiskScore, getRiskBandLabel } from '../../constants/ssspRiskMatrix.js'

export function createEmptyHazard(overrides = {}) {
  return {
    id: createRecordId(),
    activity: '',
    hazard: '',
    potentialHarm: '',
    initialLikelihood: '',
    initialConsequence: '',
    initialRisk: null,
    controls: '',
    controlHierarchy: '',
    residualLikelihood: '',
    residualConsequence: '',
    residualRisk: null,
    residualRiskExplanation: '',
    criticalRiskId: '',
    templateId: '',
    archived: false,
    sortOrder: 0,
    ...overrides,
  }
}

export function normalizeHazard(hazard, index = 0) {
  if (!hazard || typeof hazard !== 'object') return createEmptyHazard({ sortOrder: index })

  const initialRisk =
    hazard.initialRisk ??
    calculateRiskScore(hazard.initialLikelihood, hazard.initialConsequence)
  const residualRisk =
    hazard.residualRisk ??
    calculateRiskScore(hazard.residualLikelihood, hazard.residualConsequence)

  return {
    ...createEmptyHazard(),
    ...hazard,
    id: hazard.id || createRecordId(),
    initialRisk,
    residualRisk,
    archived: Boolean(hazard.archived),
    sortOrder: hazard.sortOrder ?? index,
  }
}

export function createEmptySsspRecord(overrides = {}) {
  const now = new Date().toISOString()
  return {
    id: createRecordId(),
    cloudId: null,
    ssspNumber: '',
    project: '',
    client: '',
    principalContractor: '',
    site: '',
    contractRef: '',
    status: SSSP_STATUS.DRAFT,
    revision: 1,
    preparedBy: '',
    preparedByUserId: null,
    effectiveDate: TODAY(),
    reviewDate: '',
    approvedAt: null,
    approvedBy: null,
    approvedByName: '',
    submittedAt: null,
    closedAt: null,
    archivedAt: null,
    recordData: createEmptySsspRecordData(),
    hazards: [],
    acknowledgements: [],
    createdAt: now,
    updatedAt: now,
    storageSource: 'local',
    syncStatus: null,
    ...overrides,
  }
}

export function normalizeSsspRecord(record) {
  if (!record || typeof record !== 'object') return createEmptySsspRecord()

  const recordData = {
    ...createEmptySsspRecordData(),
    ...(record.recordData ?? {}),
  }

  const hazards = Array.isArray(record.hazards)
    ? record.hazards.map((h, i) => normalizeHazard(h, i))
    : Array.isArray(recordData.hazards)
      ? recordData.hazards.map((h, i) => normalizeHazard(h, i))
      : []

  recordData.hazards = hazards

  const projectDetails = recordData.projectDetails ?? {}
  const declaration = recordData.declaration ?? {}

  return {
    ...createEmptySsspRecord(),
    ...record,
    recordData,
    hazards,
    project: record.project ?? projectDetails.projectName ?? '',
    client: record.client ?? projectDetails.client ?? '',
    principalContractor:
      record.principalContractor ?? projectDetails.principalContractor ?? '',
    site: record.site ?? projectDetails.siteAddress ?? '',
    contractRef: record.contractRef ?? projectDetails.contractRef ?? '',
    preparedBy: record.preparedBy ?? declaration.preparedByName ?? '',
    revision: Number(record.revision) || 1,
    status: record.status ?? SSSP_STATUS.DRAFT,
    acknowledgements: Array.isArray(record.acknowledgements) ? record.acknowledgements : [],
    updatedAt: record.updatedAt ?? record.createdAt ?? new Date().toISOString(),
  }
}

export function syncIndexedFieldsFromRecordData(record) {
  const normalized = normalizeSsspRecord(record)
  const pd = normalized.recordData.projectDetails ?? {}
  const decl = normalized.recordData.declaration ?? {}

  return {
    ...normalized,
    project: pd.projectName ?? normalized.project,
    client: pd.client ?? normalized.client,
    principalContractor: pd.principalContractor ?? normalized.principalContractor,
    site: pd.siteAddress ?? normalized.site,
    contractRef: pd.contractRef ?? normalized.contractRef,
    preparedBy: decl.preparedByName ?? normalized.preparedBy,
    recordData: {
      ...normalized.recordData,
      hazards: normalized.hazards,
    },
  }
}

export function getActiveHazards(hazards) {
  return (hazards ?? []).filter((h) => !h.archived).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function formatHazardRiskSummary(hazard) {
  const initial = hazard.initialRisk != null ? `${hazard.initialRisk} (${getRiskBandLabel(hazard.initialRisk)})` : '—'
  const residual = hazard.residualRisk != null ? `${hazard.residualRisk} (${getRiskBandLabel(hazard.residualRisk)})` : '—'
  return { initial, residual }
}

export function loadEditorDraft() {
  try {
    const raw = localStorage.getItem(SSSP_EDITOR_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      record: normalizeSsspRecord(parsed.record ?? parsed),
      savedAt: parsed.savedAt ?? null,
      sectionId: parsed.sectionId ?? 'documentControl',
    }
  } catch {
    return null
  }
}

export function persistEditorDraft(record, sectionId = 'documentControl') {
  try {
    const payload = {
      record: syncIndexedFieldsFromRecordData(record),
      savedAt: new Date().toISOString(),
      sectionId,
    }
    localStorage.setItem(SSSP_EDITOR_DRAFT_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function clearEditorDraft() {
  try {
    localStorage.removeItem(SSSP_EDITOR_DRAFT_KEY)
    return true
  } catch {
    return false
  }
}

export function filterSsspRecords(records, { tab, search, isAdmin }) {
  let list = [...(records ?? [])]

  if (!isAdmin) {
    list = list.filter((r) =>
      ['approved', 'submitted', 'closed'].includes(r.status),
    )
  }

  if (tab === 'new') return []

  const tabConfig = {
    drafts: ['draft'],
    ready: ['ready_for_review'],
    approved: ['approved'],
    submitted: ['submitted'],
    closed: ['closed'],
    archived: ['archived'],
  }

  if (tab && tabConfig[tab]) {
    list = list.filter((r) => tabConfig[tab].includes(r.status))
  }

  const q = search?.trim().toLowerCase()
  if (q) {
    list = list.filter((r) => {
      const haystack = [
        r.ssspNumber,
        r.project,
        r.client,
        r.principalContractor,
        r.site,
        r.contractRef,
        r.preparedBy,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }

  return list.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export function countSsspByStatus(records) {
  const counts = {
    active: 0,
    awaitingReview: 0,
    approved: 0,
    submitted: 0,
  }
  for (const record of records ?? []) {
    if (record.status === SSSP_STATUS.ARCHIVED) continue
    if ([SSSP_STATUS.APPROVED, SSSP_STATUS.SUBMITTED].includes(record.status)) {
      counts.active += 1
    }
    if (record.status === SSSP_STATUS.READY_FOR_REVIEW) {
      counts.awaitingReview += 1
    }
    if (record.status === SSSP_STATUS.APPROVED) counts.approved += 1
    if (record.status === SSSP_STATUS.SUBMITTED) counts.submitted += 1
  }
  return counts
}

export function appendChangeLog(record, entry) {
  const changeLog = Array.isArray(record.recordData?.changeLog)
    ? [...record.recordData.changeLog]
    : []
  changeLog.unshift({
    id: createRecordId(),
    at: new Date().toISOString(),
    ...entry,
  })
  return {
    ...record,
    recordData: {
      ...record.recordData,
      changeLog,
    },
  }
}
