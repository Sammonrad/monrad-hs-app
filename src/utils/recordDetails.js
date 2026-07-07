import { TIMESHEET_FIELD_ORDER, FIELD_LABELS } from '../constants/index.js'
import { formatFieldDisplayValue } from './formatting.js'
import { formatDefectsFound, formatDefectSeverity, formatMachineOperable } from './formatting.js'
import { parseDecimalHours } from './time.js'

export function getRecordDetailRows(record) {
  const fields = record.fields ?? {}

  if (record.formType === 'timesheet') {
    const nonChargeable = parseDecimalHours(fields.nonChargeableHours)
    return TIMESHEET_FIELD_ORDER.filter((key) => {
      if (key === 'nonChargeableHours' || key === 'nonChargeableReason') {
        return nonChargeable > 0
      }
      return true
    }).map((key) => ({
      key,
      label: FIELD_LABELS[key] ?? key,
      value: formatFieldDisplayValue(key, fields[key]),
    }))
  }

  const rows = Object.entries(fields).map(([key, value]) => ({
    key,
    label: FIELD_LABELS[key] ?? key,
    value: formatFieldDisplayValue(key, value),
  }))

  if (record.totalCount > 0) {
    rows.push({
      key: 'checklist-progress',
      label: 'Checklist progress',
      value: `${record.completedCount ?? 0} of ${record.totalCount} completed`,
    })
  }

  if (record.formType === 'pre-start' && record.defectsFound) {
    rows.push({
      key: 'defectsFound',
      label: FIELD_LABELS.defectsFound,
      value: formatDefectsFound(record.defectsFound),
    })
    if (record.defectsFound === 'found') {
      rows.push(
        {
          key: 'defectDescription',
          label: FIELD_LABELS.defectDescription,
          value: record.defectDescription || '—',
        },
        {
          key: 'defectSeverity',
          label: FIELD_LABELS.defectSeverity,
          value: formatDefectSeverity(record.defectSeverity),
        },
        {
          key: 'machineOperableSafely',
          label: FIELD_LABELS.machineOperableSafely,
          value: formatMachineOperable(record.machineOperableSafely),
        },
        {
          key: 'actionRequired',
          label: FIELD_LABELS.actionRequired,
          value: record.actionRequired || '—',
        },
        {
          key: 'reportedTo',
          label: FIELD_LABELS.reportedTo,
          value: record.reportedTo || '—',
        },
      )
    }
  }

  return rows
}
