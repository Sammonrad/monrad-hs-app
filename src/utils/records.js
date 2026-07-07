import { FORM_TYPES, TODAY } from '../constants/index.js'
import { createEmptyDefectState, normalizePreStartDefects } from './defects.js'

export function normalizeRecord(record) {
  if (record.formType && record.fields) {
    const normalized = { ...record, photos: record.photos ?? [] }
    if (record.formType === 'pre-start') {
      return { ...normalized, ...normalizePreStartDefects(record) }
    }
    return normalized
  }

  return {
    ...record,
    formType: 'job-start',
    formTypeLabel: 'Job Start Checklist',
    fields: {
      jobName: record.jobName ?? '',
      siteLocation: record.siteLocation ?? '',
      employeeName: record.employeeName ?? '',
      machineUsed: record.machineUsed ?? '',
      date: record.date ?? '',
      notes: record.notes ?? '',
    },
    signature: record.signature ?? null,
    signatureConfirmation: record.signatureConfirmation ?? '',
    photos: record.photos ?? [],
  }
}

export function getRecordTitle(record) {
  const fields = record.fields ?? {}
  switch (record.formType) {
    case 'pre-start':
      return fields.machineNameId || fields.machine || 'Pre-start record'
    case 'toolbox':
      return fields.jobProjectName || fields.topic || 'Toolbox meeting'
    case 'incident':
      return (fields.whatHappened || fields.description)?.slice(0, 60) || 'Incident report'
    case 'timesheet':
      return fields.jobProjectName || fields.workCompleted?.slice(0, 60) || 'Timesheet record'
    default:
      return fields.jobName || 'Untitled job'
  }
}

export function getFormTypeLabel(formType) {
  return FORM_TYPES[formType]?.title ?? formType
}

export function createEmptyDraft(formType) {
  const draft = {
    fields: { ...FORM_TYPES[formType].emptyFields, date: TODAY() },
    checked: new Set(),
    signatureConfirmation: '',
    photos: [],
  }
  if (formType === 'pre-start') {
    Object.assign(draft, createEmptyDefectState())
  }
  return draft
}
