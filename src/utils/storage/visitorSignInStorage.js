import { VISITOR_SIGN_IN_STORAGE_KEY } from '../../constants/storageKeys.js'
import { createRecordId } from '../ids.js'

export const VISITOR_ACKNOWLEDGEMENT_KEYS = [
  'siteRules',
  'ppeRequired',
  'emergencyProcedures',
  'criticalRisksReviewed',
]

export function createEmptyAcknowledgements() {
  return {
    siteRules: false,
    ppeRequired: false,
    emergencyProcedures: false,
    criticalRisksReviewed: false,
  }
}

export function createEmptyVisitorDraft() {
  return {
    visitorName: '',
    siteName: '',
    purpose: '',
    company: '',
    phone: '',
    personVisited: '',
    vehicleReg: '',
    hazardsReported: '',
    notes: '',
    acknowledgements: createEmptyAcknowledgements(),
    declarationName: '',
  }
}

export function normalizeVisitorRecord(record) {
  const acknowledgements = {
    ...createEmptyAcknowledgements(),
    ...(record.acknowledgements ?? {}),
  }

  return {
    id: record.id ?? createRecordId(),
    visitorName: record.visitorName ?? '',
    siteName: record.siteName ?? '',
    purpose: record.purpose ?? '',
    company: record.company ?? '',
    phone: record.phone ?? '',
    personVisited: record.personVisited ?? '',
    vehicleReg: record.vehicleReg ?? '',
    hazardsReported: record.hazardsReported ?? '',
    notes: record.notes ?? '',
    arrivalTime: record.arrivalTime ?? record.createdAt ?? new Date().toISOString(),
    departureTime: record.departureTime ?? null,
    signedOutBy: record.signedOutBy ?? null,
    acknowledgements,
    declarationName: record.declarationName ?? '',
    createdAt: record.createdAt ?? record.arrivalTime ?? new Date().toISOString(),
    cloudId: record.cloudId ?? null,
    cloudUserId: record.cloudUserId ?? null,
    storageSource: record.storageSource ?? (record.cloudId ? 'cloud' : 'local'),
    syncStatus: record.syncStatus ?? null,
  }
}

export function isVisitorOnSite(record) {
  return !record?.departureTime
}

export function patchVisitorRecord(records, recordId, patch) {
  return records.map((record) =>
    record.id === recordId ? normalizeVisitorRecord({ ...record, ...patch }) : record,
  )
}

export function loadVisitorRecords() {
  try {
    const raw = localStorage.getItem(VISITOR_SIGN_IN_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeVisitorRecord) : []
  } catch {
    return []
  }
}

export function persistVisitorRecords(records) {
  try {
    localStorage.setItem(VISITOR_SIGN_IN_STORAGE_KEY, JSON.stringify(records))
    return true
  } catch {
    window.alert('Could not save visitor records to this device.')
    return false
  }
}

export function countVisitorsOnSite(records) {
  return records.filter(isVisitorOnSite).length
}
