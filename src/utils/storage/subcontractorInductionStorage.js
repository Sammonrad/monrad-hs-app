import { SUBCONTRACTOR_INDUCTION_STORAGE_KEY } from '../../constants/storageKeys.js'
import { TODAY } from '../../constants/index.js'
import { createRecordId } from '../ids.js'

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
  return { ...empty, ...record, id: record.id || createRecordId(), topics: { ...empty.topics, ...(record.topics || {}) } }
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
  const merged = new Map(localRecords.map((item) => [item.cloudId || item.id, normalizeSubcontractorInduction(item)]))
  cloudRecords.forEach((item) => {
    const key = item.cloudId || item.id
    const local = merged.get(key)
    merged.set(key, normalizeSubcontractorInduction({ ...local, ...item, id: local?.id || item.id, storageSource: local ? 'both' : 'cloud' }))
  })
  return [...merged.values()].sort((a, b) => (b.inductionDate || b.createdAt).localeCompare(a.inductionDate || a.createdAt))
}

