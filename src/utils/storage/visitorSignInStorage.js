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

function resolveAcknowledgements(record) {
  const fromObject = record.acknowledgements ?? {}
  const acknowledgements = {
    ...createEmptyAcknowledgements(),
    ...fromObject,
  }

  // Legacy / cloud rows may store ack flags as flat columns instead of an object.
  if (fromObject.siteRules == null && record.induction_acknowledged != null) {
    acknowledgements.siteRules = Boolean(record.induction_acknowledged)
  }
  if (fromObject.ppeRequired == null && record.ppe_acknowledged != null) {
    acknowledgements.ppeRequired = Boolean(record.ppe_acknowledged)
  }
  if (
    fromObject.emergencyProcedures == null &&
    record.emergency_procedure_acknowledged != null
  ) {
    acknowledgements.emergencyProcedures = Boolean(record.emergency_procedure_acknowledged)
  }
  if (
    fromObject.criticalRisksReviewed == null &&
    record.critical_risks_acknowledged != null
  ) {
    acknowledgements.criticalRisksReviewed = Boolean(record.critical_risks_acknowledged)
  }

  return acknowledgements
}

export function normalizeVisitorRecord(record) {
  return {
    id: record.id ?? createRecordId(),
    visitorName: record.visitorName ?? record.visitor_name ?? '',
    siteName: record.siteName ?? record.site_name ?? '',
    purpose: record.purpose ?? '',
    company: record.company ?? '',
    phone: record.phone ?? '',
    // App field stays camelCase; accept snake_case from cloud/legacy local rows.
    personVisited: record.personVisited ?? record.person_visiting ?? record.person_visited ?? '',
    vehicleReg:
      record.vehicleReg ?? record.vehicle_registration ?? record.vehicle_reg ?? '',
    hazardsReported: record.hazardsReported ?? record.hazards_reported ?? '',
    notes: record.notes ?? '',
    arrivalTime:
      record.arrivalTime ?? record.arrival_time ?? record.createdAt ?? new Date().toISOString(),
    departureTime: record.departureTime ?? record.departure_time ?? null,
    signedOutBy: record.signedOutBy ?? record.signed_out_by ?? null,
    acknowledgements: resolveAcknowledgements(record),
    declarationName: record.declarationName ?? '',
    createdAt:
      record.createdAt ??
      record.created_at ??
      record.arrivalTime ??
      record.arrival_time ??
      new Date().toISOString(),
    cloudId: record.cloudId ?? null,
    cloudUserId: record.cloudUserId ?? record.signed_in_by ?? null,
    storageSource: record.storageSource ?? (record.cloudId ? 'cloud' : 'local'),
    syncStatus: record.syncStatus ?? null,
    ...(typeof record.archived === 'boolean' ? { archived: record.archived } : {}),
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
