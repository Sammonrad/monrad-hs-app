import { getFormTypeLabel } from './records.js'
import {
  formatSubmittedAt,
  formatReportType,
  formatDefectsFound,
  formatDefectSeverity,
  formatMachineOperable,
} from './formatting.js'
import { isSeriousDefect } from './defects.js'
import {
  ACTION_STATUS_LABELS,
  ACTION_PRIORITY_LABELS,
  SOURCE_TYPE_LABELS,
} from '../constants/index.js'
import { isOverdue } from './storage/actionsStorage.js'

export function buildTextSummary(record) {
  const lines = [
    'Monrad Earthworx — Record Export',
    `Form: ${record.formTypeLabel || getFormTypeLabel(record.formType)}`,
    `Saved: ${formatSubmittedAt(record.submittedAt)}`,
    '',
  ]

  Object.entries(record.fields ?? {}).forEach(([key, value]) => {
    if (value) {
      lines.push(`${key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}: ${value}`)
    }
  })

  if (record.completedCount != null) {
    lines.push('', `Checklist: ${record.completedCount} of ${record.totalCount} completed`)
  }

  if (record.completedItems?.length) {
    lines.push('', 'Completed items:')
    record.completedItems.forEach((item) => lines.push(`  - ${item}`))
  }

  if (record.signatureConfirmation) {
    lines.push('', `Signature / Name Confirmation: ${record.signatureConfirmation}`)
  } else if (record.signature) {
    lines.push('', 'Signature: included (image)')
  }
  if (record.photos?.length) lines.push(`Photos: ${record.photos.length} attached`)

  if (record.formType === 'pre-start' && record.defectsFound) {
    lines.push('', `Any defects found?: ${formatDefectsFound(record.defectsFound)}`)
    if (record.defectsFound === 'found') {
      lines.push(`Defect description: ${record.defectDescription || '—'}`)
      lines.push(`Severity: ${formatDefectSeverity(record.defectSeverity)}`)
      lines.push(
        `Can machine be operated safely?: ${formatMachineOperable(record.machineOperableSafely)}`,
      )
      if (record.actionRequired) lines.push(`Action required: ${record.actionRequired}`)
      if (record.reportedTo) lines.push(`Reported to: ${record.reportedTo}`)
      if (record.defectPhotos?.length) {
        lines.push(`Defect photos: ${record.defectPhotos.length} attached`)
      }
      if (isSeriousDefect(record)) {
        lines.push('', 'WARNING: Do not operate this machine until the issue has been reviewed.')
      }
    }
  }

  return lines.join('\n')
}

export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function exportRecordJson(record) {
  downloadFile(
    JSON.stringify(record, null, 2),
    `monrad-${record.formType}-${record.id.slice(0, 8)}.json`,
    'application/json',
  )
}

export function exportRecordText(record) {
  downloadFile(
    buildTextSummary(record),
    `monrad-${record.formType}-${record.id.slice(0, 8)}.txt`,
    'text/plain',
  )
}

export function buildActionTextSummary(action) {
  const overdue = isOverdue(action)
  const lines = [
    'Monrad Earthworx — Action Export',
    `Source: ${SOURCE_TYPE_LABELS[action.sourceType] ?? action.sourceType}`,
    `Status: ${ACTION_STATUS_LABELS[action.status] ?? action.status}${overdue ? ' — Overdue' : ''}`,
    `Priority: ${ACTION_PRIORITY_LABELS[action.priority] ?? action.priority}`,
    `Date: ${action.date || '—'}`,
    `Due date: ${action.dueDate || '—'}`,
    `Site: ${action.site || '—'}`,
    `Description: ${action.description || '—'}`,
    `Person responsible: ${action.personResponsible || '—'}`,
  ]
  if (action.notes) lines.push(`Notes: ${action.notes}`)
  return lines.join('\n')
}

export function exportActionJson(action) {
  downloadFile(
    JSON.stringify(action, null, 2),
    `monrad-action-${action.id.slice(0, 8)}.json`,
    'application/json',
  )
}

export function exportActionText(action) {
  downloadFile(
    buildActionTextSummary(action),
    `monrad-action-${action.id.slice(0, 8)}.txt`,
    'text/plain',
  )
}
