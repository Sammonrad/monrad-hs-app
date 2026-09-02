import { SUBCONTRACTOR_INDUCTION_STORAGE_KEY } from '../../constants/storageKeys.js'
import { TODAY } from '../../constants/index.js'
import { createRecordId } from '../ids.js'
import { SYNC_STATUS } from './cloudSyncStatus.js'

export const INDUCTION_TOPICS = [
  ['siteRules', 'Site rules, access and restricted areas'],
  ['hazards', 'Site hazards, controls and critical risks'],
  ['ppe', 'Required PPE'],
  ['emergency', 'Emergency procedures, assembly point and first aid'],
  ['incidentReporting', 'Incident, near-miss and hazard reporting'],
  ['plantTraffic', 'Plant, vehicle and pedestrian controls'],
  ['services', 'Underground and overhead services'],
  ['environment', 'Environmental controls and spill response'],
  ['fitness', 'Fitness for work, drugs and alcohol'],
  ['sssp', 'Relevant SSSP / task controls and permit requirements'],
]

export function createEmptySubcontractorInduction() {
  return {
    id: createRecordId(), cloudId: null, status: 'draft', inductionDate: TODAY(), inductionTime: '',
    siteName: '', siteAddress: '', principalContractor: 'Monrad Earthworx', inductedBy: '',
    subcontractorName: '', companyName: '', roleTrade: '', phone: '', email: '',
    emergencyContactName: '', emergencyContactPhone: '',
    licencesCompetencies: '', plantEquipment: '', workDescription: '',
    topics: Object.fromEntries(INDUCTION_TOPICS.map(([key]) => [key, false])),
    siteSpecificHazards: '', agreedControls: '', questionsNotes: '',
    subcontractorDeclaration: false, subcontractorSignature: '', inducerSignature: '',
    createdAt: new Date().toISOString(), updatedAt: null, submittedAt: null,
    syncStatus: null, storageSource: 'local',
  }
}

export function normalizeSubcontractorInduction(record) {
  const empty = createEmptySubcontractorInduction()
  if (!record || typeof record !== 'object') return empty
  return {
    ...empty,
    ...record,
    id: record.id || createRecordId(),
    topics: { ...empty.topics, ...(record.topics || {}) },
    lastVerifiedAt: record.lastVerifiedAt ?? null,
  }
}

export function upsertSubcontractorInduction(records, record) {
  const normalized = normalizeSubcontractorInduction(record)
  const index = records.findIndex((item) => item.id === normalized.id)
  if (index === -1) {
    return [normalized, ...records]
  }
  const next = [...records]
  next[index] = normalized
  return next
}

export function persistSubcontractorInduction(records, record) {
  return persistSubcontractorInductions(upsertSubcontractorInduction(records, record))
}

export function loadSubcontractorInductions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SUBCONTRACTOR_INDUCTION_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(normalizeSubcontractorInduction) : []
  } catch { return [] }
}

export function persistSubcontractorInductions(records) {
  try { localStorage.setItem(SUBCONTRACTOR_INDUCTION_STORAGE_KEY, JSON.stringify(records)); return true }
  catch { window.alert('Could not save subcontractor induction records to this device.'); return false }
}

export function mergeSubcontractorInductions(localRecords = [], cloudRecords = []) {
  const byId = new Map()

  function upsert(record) {
    const normalized = normalizeSubcontractorInduction(record)
    byId.set(normalized.id, normalized)
  }

  function findByCloudId(cloudId) {
    if (!cloudId) return null
    for (const record of byId.values()) {
      if (record.cloudId === cloudId) return record
    }
    return null
  }

  localRecords.forEach((item) => {
    upsert({ ...item, storageSource: item.cloudId ? 'both' : 'local' })
  })

  cloudRecords.forEach((item) => {
    const cloud = normalizeSubcontractorInduction({ ...item, storageSource: 'cloud' })
    const existing = findByCloudId(cloud.cloudId) || byId.get(cloud.id)

    if (existing) {
      const preferLocalSync =
        existing.syncStatus === SYNC_STATUS.CLOUD_FAILED ||
        existing.syncStatus === SYNC_STATUS.CLOUD_MISSING ||
        existing.syncStatus === SYNC_STATUS.OFFLINE ||
        existing.syncStatus === SYNC_STATUS.LOCAL_ONLY

      upsert({
        ...cloud,
        ...existing,
        id: existing.id,
        cloudId: cloud.cloudId || existing.cloudId,
        storageSource: 'both',
        syncStatus: preferLocalSync ? existing.syncStatus : SYNC_STATUS.CLOUD,
      })
    } else {
      upsert({ ...cloud, id: cloud.cloudId || cloud.id })
    }
  })

  return [...byId.values()].sort((a, b) =>
    (b.inductionDate || b.createdAt).localeCompare(a.inductionDate || a.createdAt),
  )
}

