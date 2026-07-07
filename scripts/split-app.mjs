import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const src = path.join(root, 'src')
const lines = fs.readFileSync(path.join(src, 'App.jsx'), 'utf8').split('\n')

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n')
}

function write(rel, content) {
  const file = path.join(src, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  console.log('wrote', rel)
}

// --- constants ---
write(
  'constants/storageKeys.js',
  `export const STORAGE_KEY = 'monrad-earthworx-job-records'
export const ACTIONS_STORAGE_KEY = 'monrad-earthworx-actions'
export const SETTINGS_STORAGE_KEY = 'monrad-earthworx-settings'
export const MAX_PHOTOS = 3
`,
)

write(
  'constants/index.js',
  `${slice(8, 219)}

export const REPORT_TYPE_LABELS = {
  incident: 'Incident',
  'near-miss': 'Near Miss',
  'property-damage': 'Property Damage',
  injury: 'Injury',
  environmental: 'Environmental',
}

export const DEFECT_SEVERITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export const ACTION_STATUS_LABELS = {
  open: 'Open',
  'in-progress': 'In Progress',
  completed: 'Completed',
}

export const SOURCE_TYPE_LABELS = {
  'pre-start': 'Machine Pre-Start',
  toolbox: 'Toolbox Meeting',
  incident: 'Incident / Near Miss',
  manual: 'Manual entry',
}

${slice(1207, 1264)}

export const TIMESHEET_FIELD_ORDER = [
  'date',
  'employeeName',
  'jobProjectName',
  'siteLocation',
  'customerName',
  'machineUsed',
  'startTime',
  'finishTime',
  'breakMinutes',
  'totalHoursWorked',
  'chargeableHours',
  'nonChargeableHours',
  'nonChargeableReason',
  'workCompleted',
  'materialsUsed',
  'docketNumber',
  'delaysOrIssues',
  'safetyIssues',
  'notes',
]

${slice(1509, 1564)}

export {
  STORAGE_KEY,
  ACTIONS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  MAX_PHOTOS,
} from './storageKeys.js'
`,
)

// --- utils ---
write(
  'utils/ids.js',
  `${slice(772, 774)}
`,
)

write(
  'utils/formatting.js',
  `import { REPORT_TYPE_LABELS, DEFECT_SEVERITY_LABELS } from '../constants/index.js'

${slice(66, 68)}

${slice(77, 91)}

${slice(221, 226)}

export function formatFieldDisplayValue(key, value) {
  if (key === 'reportType') return formatReportType(value)
  if (key === 'defectsFound') return formatDefectsFound(value)
  if (key === 'defectSeverity') return formatDefectSeverity(value)
  if (key === 'machineOperableSafely') return formatMachineOperable(value)
  if (key === 'chargeableHours' && value) return formatDecimalHoursDisplay(value)
  if (key === 'nonChargeableHours' && value) return formatDecimalHoursDisplay(value)
  return value || '—'
}

export function formatDecimalHoursDisplay(hours) {
  if (hours === '' || hours == null) return ''
  const value = typeof hours === 'number' ? hours : parseFloat(hours)
  if (Number.isNaN(value)) return ''
  return \`\${value.toFixed(2)} hrs\`
}

export function formatDurationMinutes(totalMinutes) {
  if (totalMinutes == null) return ''
  if (totalMinutes <= 0) return '0h'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return \`\${minutes}m\`
  if (minutes === 0) return \`\${hours}h\`
  return \`\${hours}h \${minutes}m\`
}
`,
)

write(
  'utils/defects.js',
  `import { DEFECT_SEVERITY_LABELS } from '../constants/index.js'

export function formatDefectSeverity(value) {
  return DEFECT_SEVERITY_LABELS[value] ?? value ?? '—'
}

${slice(93, 122)}
`,
)

write(
  'utils/records.js',
  `import { FORM_TYPES, TODAY } from '../constants/index.js'
import { createEmptyDefectState, normalizePreStartDefects } from './defects.js'

${slice(776, 821)}

${slice(913, 924)}
`,
)

write(
  'utils/storage/recordsStorage.js',
  `import { STORAGE_KEY } from '../../constants/storageKeys.js'
import { normalizeRecord } from '../records.js'

${slice(228, 253)}
`,
)

write(
  'utils/storage/actionsStorage.js',
  `import { ACTIONS_STORAGE_KEY, TODAY } from '../../constants/index.js'
import { createRecordId } from '../ids.js'
import { formatDefectSeverity } from '../formatting.js'
import { isSeriousDefect } from '../defects.js'

${slice(268, 381)}

export function createEmptyManualAction() {
  return {
    date: TODAY(),
    site: '',
    description: '',
    personResponsible: '',
    dueDate: '',
    notes: '',
  }
}
`,
)

write(
  'utils/storage/settingsStorage.js',
  `import { SETTINGS_STORAGE_KEY, MACHINE_TYPES } from '../../constants/index.js'
import { createRecordId } from '../ids.js'

${slice(383, 437)}
`,
)

write(
  'utils/time.js',
  `import { formatDurationMinutes } from './formatting.js'

${slice(823, 889)}
`,
)

write(
  'utils/image.js',
  `${slice(926, 952)}
`,
)

write(
  'utils/export.js',
  `import { getFormTypeLabel } from './records.js'
import {
  formatSubmittedAt,
  formatReportType,
  formatDefectsFound,
  formatDefectSeverity,
  formatMachineOperable,
} from './formatting.js'
import { isSeriousDefect } from './defects.js'

${slice(954, 1030)}
`,
)

write(
  'utils/recordDetails.js',
  `import { TIMESHEET_FIELD_ORDER, FIELD_LABELS } from '../constants/index.js'
import { formatFieldDisplayValue } from './formatting.js'
import { formatDefectsFound, formatDefectSeverity, formatMachineOperable } from './formatting.js'
import { parseDecimalHours } from './time.js'

${slice(1276, 1345)}
`,
)

write(
  'utils/recordsDashboard.js',
  `import {
  ACTION_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
} from '../constants/index.js'
import { formatSubmittedAt, formatReportType, formatDefectSeverity } from './formatting.js'
import { getRecordTitle, getFormTypeLabel } from './records.js'

${slice(524, 748)}
`,
)

write(
  'utils/backup.js',
  `import {
  STORAGE_KEY,
  ACTIONS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  BACKUP_APP_NAME,
  BACKUP_VERSION,
  APP_STORAGE_KEYS,
} from '../constants/index.js'
import { loadSavedRecords, persistSavedRecords } from './storage/recordsStorage.js'
import { loadActions, persistActions, normalizeAction } from './storage/actionsStorage.js'
import {
  loadSettings,
  persistSettings,
  normalizeSettings,
  createEmptySettings,
} from './storage/settingsStorage.js'
import { normalizeRecord } from './records.js'
import { downloadFile } from './export.js'

export { APP_STORAGE_KEYS, BACKUP_APP_NAME }

${slice(448, 522)}
`,
)

// --- hooks ---
write(
  'hooks/useHighlightRecord.js',
  `import { useEffect } from 'react'

${slice(750, 770)}
`,
)

// --- components ---
const componentSlices = [
  ['components/BackButton.jsx', 1566, 1572, `export function BackButton`],
  ['components/SignatureConfirmationField.jsx', 1032, 1045, `export function SignatureConfirmationField`],
  ['components/RecordSignatureDisplay.jsx', 1047, 1067, `export function RecordSignatureDisplay`],
  ['components/SavedRecordSignature.jsx', 1069, 1079, `export function SavedRecordSignature`],
  ['components/PhotoUpload.jsx', 1081, 1144, `import { useState } from 'react'
import { MAX_PHOTOS } from '../constants/index.js'
import { createRecordId } from '../utils/ids.js'
import { compressImage } from '../utils/image.js'

export function PhotoUpload`],
  ['components/RadioFieldGroup.jsx', 1146, 1167, `export function RadioFieldGroup`],
  ['components/DefectWarning.jsx', 1169, 1175, `export function DefectWarning`],
  ['components/DefectPhotosDisplay.jsx', 1177, 1192, `export function DefectPhotosDisplay`],
  ['components/DefectDetailsDisplay.jsx', 1194, 1205, `import { isSeriousDefect } from '../utils/defects.js'
import { DefectWarning } from './DefectWarning.jsx'
import { DefectPhotosDisplay } from './DefectPhotosDisplay.jsx'

export function DefectDetailsDisplay`],
  ['components/RecordDetails.jsx', 1347, 1390, `import { getRecordDetailRows } from '../utils/recordDetails.js'
import { DefectDetailsDisplay } from './DefectDetailsDisplay.jsx'
import { RecordSignatureDisplay } from './RecordSignatureDisplay.jsx'

export function RecordDetails`],
  ['components/PrintableRecord.jsx', 1392, 1487, `import { formatSubmittedAt } from '../utils/formatting.js'
import { getRecordDetailRows } from '../utils/recordDetails.js'
import { isSeriousDefect } from '../utils/defects.js'
import { DefectWarning } from './DefectWarning.jsx'

export function PrintableRecord`],
  ['components/RecordActions.jsx', 1489, 1507, `import { exportRecordJson, exportRecordText } from '../utils/export.js'

export function RecordActions`],
  ['components/ActionCard.jsx', 1641, 1716, `import { ACTION_STATUS_LABELS, SOURCE_TYPE_LABELS } from '../constants/index.js'
import { isOverdue } from '../utils/storage/actionsStorage.js'
import { SummaryRow } from './FormFields.jsx'

export function ActionCard`],
  ['components/SettingsListItem.jsx', 2191, 2203, `export function SettingsListItem`],
  ['components/FormFields.jsx', 4557, 4671, `export function ComboField`],
]

for (const [rel, start, end, header] of componentSlices) {
  let body = slice(start, end)
  if (rel === 'components/FormFields.jsx') {
    body = body.replace(/^function ComboField/, 'export function ComboField')
      .replace(/^function TextField/, 'export function TextField')
      .replace(/^function DateField/, 'export function DateField')
      .replace(/^function TimeField/, 'export function TimeField')
      .replace(/^function SelectField/, 'export function SelectField')
      .replace(/^function NotesField/, 'export function NotesField')
      .replace(/^function SummaryRow/, 'export function SummaryRow')
    write(rel, body + '\n')
  } else if (header.startsWith('export function')) {
    body = body.replace(/^function \w+/, header)
    write(rel, body + '\n')
  } else {
    write(rel, header + body.slice(body.indexOf('{')) + '\n')
  }
}

// Fix PhotoUpload - the slice includes "function PhotoUpload" already
write(
  'components/PhotoUpload.jsx',
  `import { MAX_PHOTOS } from '../constants/index.js'
import { createRecordId } from '../utils/ids.js'
import { compressImage } from '../utils/image.js'

${slice(1081, 1144).replace(/^function PhotoUpload/, 'export function PhotoUpload')}
`,
)

// --- pages ---
const pageImports = {
  Dashboard: `import { DASHBOARD_CARDS } from '../constants/index.js'\n`,
  ActionRegisterView: `import { useState } from 'react'
import { TODAY } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { ActionCard } from '../components/ActionCard.jsx'
import { DateField, TextField } from '../components/FormFields.jsx'
import { createRecordId } from '../utils/ids.js'
import {
  persistActions,
  normalizeAction,
  createEmptyManualAction,
} from '../utils/storage/actionsStorage.js'
`,
  RecordsDashboardView: `import { useMemo, useState } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import { formatSubmittedAt } from '../utils/formatting.js'
import {
  getRecordsDashboardStats,
  buildSearchableItems,
  filterSearchItems,
} from '../utils/recordsDashboard.js'
`,
  SettingsView: `import { useState } from 'react'
import { MACHINE_TYPES } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { SettingsListItem } from '../components/SettingsListItem.jsx'
import { createRecordId } from '../utils/ids.js'
import { persistSettings } from '../utils/storage/settingsStorage.js'
`,
  BackupRestoreView: `import { useRef, useState } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import {
  APP_STORAGE_KEYS,
  collectBackupData,
  exportAppBackup,
  getBackupFilename,
  restoreBackupPayload,
} from '../utils/backup.js'
`,
  ComingSoonView: `import { BackButton } from '../components/BackButton.jsx'
`,
  JobStartView: `import { useEffect, useRef, useState } from 'react'
import { FORM_TYPES } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { SignatureConfirmationField } from '../components/SignatureConfirmationField.jsx'
import { PhotoUpload } from '../components/PhotoUpload.jsx'
import { RecordDetails } from '../components/RecordDetails.jsx'
import { RecordActions } from '../components/RecordActions.jsx'
import { SavedRecordSignature } from '../components/SavedRecordSignature.jsx'
import {
  ComboField,
  TextField,
  DateField,
  NotesField,
  SummaryRow,
} from '../components/FormFields.jsx'
import { useHighlightRecord } from '../hooks/useHighlightRecord.js'
import { createRecordId } from '../utils/ids.js'
import { formatSubmittedAt, formatReportType } from '../utils/formatting.js'
import { createEmptyDraft, getRecordTitle } from '../utils/records.js'
import { persistSavedRecords } from '../utils/storage/recordsStorage.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
`,
  PreStartView: `import { useEffect, useRef, useState } from 'react'
import { FORM_TYPES, MAX_PHOTOS } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { SignatureConfirmationField } from '../components/SignatureConfirmationField.jsx'
import { PhotoUpload } from '../components/PhotoUpload.jsx'
import { RadioFieldGroup } from '../components/RadioFieldGroup.jsx'
import { DefectWarning } from '../components/DefectWarning.jsx'
import { RecordDetails } from '../components/RecordDetails.jsx'
import { RecordActions } from '../components/RecordActions.jsx'
import { SavedRecordSignature } from '../components/SavedRecordSignature.jsx'
import {
  ComboField,
  TextField,
  DateField,
  NotesField,
  SelectField,
  SummaryRow,
} from '../components/FormFields.jsx'
import { useHighlightRecord } from '../hooks/useHighlightRecord.js'
import { createRecordId } from '../utils/ids.js'
import {
  formatSubmittedAt,
  formatDefectsFound,
  formatDefectSeverity,
  formatMachineOperable,
} from '../utils/formatting.js'
import { isSeriousDefect } from '../utils/defects.js'
import { createEmptyDraft, getRecordTitle } from '../utils/records.js'
import { persistSavedRecords } from '../utils/storage/recordsStorage.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
`,
  ToolboxView: `import { useEffect, useRef, useState } from 'react'
import { FORM_TYPES } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { SignatureConfirmationField } from '../components/SignatureConfirmationField.jsx'
import { PhotoUpload } from '../components/PhotoUpload.jsx'
import { RecordDetails } from '../components/RecordDetails.jsx'
import { RecordActions } from '../components/RecordActions.jsx'
import { SavedRecordSignature } from '../components/SavedRecordSignature.jsx'
import {
  ComboField,
  TextField,
  DateField,
  NotesField,
  SummaryRow,
} from '../components/FormFields.jsx'
import { useHighlightRecord } from '../hooks/useHighlightRecord.js'
import { createRecordId } from '../utils/ids.js'
import { formatSubmittedAt } from '../utils/formatting.js'
import { createEmptyDraft, getRecordTitle } from '../utils/records.js'
import { persistSavedRecords } from '../utils/storage/recordsStorage.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
`,
  TimesheetView: `import { useEffect, useMemo, useRef, useState } from 'react'
import { FORM_TYPES } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { SignatureConfirmationField } from '../components/SignatureConfirmationField.jsx'
import { RecordDetails } from '../components/RecordDetails.jsx'
import { RecordActions } from '../components/RecordActions.jsx'
import { SavedRecordSignature } from '../components/SavedRecordSignature.jsx'
import {
  ComboField,
  TextField,
  DateField,
  NotesField,
  TimeField,
  SummaryRow,
} from '../components/FormFields.jsx'
import { useHighlightRecord } from '../hooks/useHighlightRecord.js'
import { createRecordId } from '../utils/ids.js'
import { formatSubmittedAt, formatDecimalHoursDisplay } from '../utils/formatting.js'
import { createEmptyDraft, getRecordTitle } from '../utils/records.js'
import { persistSavedRecords } from '../utils/storage/recordsStorage.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
import {
  calculateLabourHours,
  calculateAutoChargeableHours,
  parseDecimalHours,
} from '../utils/time.js'
`,
  IncidentView: `import { useEffect, useRef, useState } from 'react'
import { FORM_TYPES } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { SignatureConfirmationField } from '../components/SignatureConfirmationField.jsx'
import { PhotoUpload } from '../components/PhotoUpload.jsx'
import { RecordDetails } from '../components/RecordDetails.jsx'
import { RecordActions } from '../components/RecordActions.jsx'
import { SavedRecordSignature } from '../components/SavedRecordSignature.jsx'
import {
  ComboField,
  TextField,
  DateField,
  NotesField,
  SelectField,
  SummaryRow,
} from '../components/FormFields.jsx'
import { useHighlightRecord } from '../hooks/useHighlightRecord.js'
import { createRecordId } from '../utils/ids.js'
import { formatSubmittedAt, formatReportType } from '../utils/formatting.js'
import { createEmptyDraft, getRecordTitle } from '../utils/records.js'
import { persistSavedRecords } from '../utils/storage/recordsStorage.js'
import { getSettingsOptions } from '../utils/storage/settingsStorage.js'
`,
}

const pages = [
  ['pages/Dashboard.jsx', 1574, 1628, 'Dashboard'],
  ['pages/ActionRegisterView.jsx', 1718, 1908, 'ActionRegisterView'],
  ['pages/RecordsDashboardView.jsx', 1910, 2189, 'RecordsDashboardView'],
  ['pages/SettingsView.jsx', 2205, 2416, 'SettingsView'],
  ['pages/BackupRestoreView.jsx', 2418, 2549, 'BackupRestoreView'],
  ['pages/ComingSoonView.jsx', 2551, 2567, 'ComingSoonView'],
  ['pages/JobStartView.jsx', 2569, 2901, 'JobStartView'],
  ['pages/PreStartView.jsx', 2903, 3364, 'PreStartView'],
  ['pages/ToolboxView.jsx', 3366, 3652, 'ToolboxView'],
  ['pages/TimesheetView.jsx', 3654, 4076, 'TimesheetView'],
  ['pages/IncidentView.jsx', 4078, 4397, 'IncidentView'],
]

for (const [rel, start, end, name] of pages) {
  const body = slice(start, end).replace(/^function \w+/, `export function ${name}`)
  write(rel, pageImports[name] + '\n' + body + '\n')
}

// --- App.jsx ---
write(
  'App.jsx',
  `import { useEffect, useState } from 'react'
import './App.css'
import { Dashboard } from './pages/Dashboard.jsx'
import { ActionRegisterView } from './pages/ActionRegisterView.jsx'
import { RecordsDashboardView } from './pages/RecordsDashboardView.jsx'
import { SettingsView } from './pages/SettingsView.jsx'
import { BackupRestoreView } from './pages/BackupRestoreView.jsx'
import { JobStartView } from './pages/JobStartView.jsx'
import { PreStartView } from './pages/PreStartView.jsx'
import { ToolboxView } from './pages/ToolboxView.jsx'
import { TimesheetView } from './pages/TimesheetView.jsx'
import { IncidentView } from './pages/IncidentView.jsx'
import { PrintableRecord } from './components/PrintableRecord.jsx'
import { loadSavedRecords } from './utils/storage/recordsStorage.js'
import { loadActions, persistActions, syncActionsFromRecord } from './utils/storage/actionsStorage.js'
import { loadSettings } from './utils/storage/settingsStorage.js'

${slice(4399, 4555)}

export default App
`,
)

console.log('done')
