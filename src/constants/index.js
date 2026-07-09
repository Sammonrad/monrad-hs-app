export {
  STORAGE_KEY,
  ACTIONS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  MAX_PHOTOS,
} from './storageKeys.js'

import {
  STORAGE_KEY,
  ACTIONS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
} from './storageKeys.js'

export const MACHINE_TYPES = ['Excavator', 'Truck', 'Loader', 'Roller', 'Other']
export const TODAY = () => new Date().toISOString().slice(0, 10)

export const JOB_START_CHECKLIST = [
  'Arrived on site safely',
  'Checked job hazards',
  'Checked underground services',
  'Completed machine pre-start',
  'PPE is being worn',
  'Weather and ground conditions checked',
  'Emergency access confirmed',
]

export const PRE_START_CHECKLIST = [
  'Engine oil checked',
  'Coolant checked',
  'Hydraulic oil checked',
  'Fuel / AdBlue checked',
  'Tracks / tyres checked',
  'Leaks checked',
  'Pins, bushes, bucket, and attachments checked',
  'Lights / beacon checked',
  'Horn / reversing alarm checked',
  'Fire extinguisher present',
  'Grease points completed',
  'Machine safe to operate',
]

export const TOOLBOX_CHECKLIST = [
  'Scope of work discussed',
  'Site hazards discussed',
  'Machinery risks discussed',
  'Underground/overhead services discussed',
  'Traffic / public risks discussed',
  'PPE requirements confirmed',
  'Emergency plan discussed',
  'Everyone understands the work plan',
]

export const INCIDENT_CHECKLIST = [
  'Area made safe',
  'Supervisor / manager notified',
  'Injured person treated if required',
  'Photos or evidence collected if available',
  'Witnesses recorded if applicable',
  'Corrective action identified',
  'Follow-up required',
  'Report completed honestly and accurately',
]

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

export const APP_VERSION = '0.1'

export const FORM_TYPES = {
  'job-start': {
    id: 'job-start',
    label: 'Job Start',
    title: 'Job Start Checklist',
    checklist: JOB_START_CHECKLIST,
    emptyFields: {
      jobName: '',
      siteLocation: '',
      employeeName: '',
      machineUsed: '',
      date: TODAY(),
      notes: '',
    },
  },
  'pre-start': {
    id: 'pre-start',
    label: 'Pre-start',
    title: 'Machine Pre-Start',
    checklist: PRE_START_CHECKLIST,
    emptyFields: {
      date: TODAY(),
      operatorName: '',
      machineNameId: '',
      machineHours: '',
      siteLocation: '',
      notes: '',
    },
  },
  toolbox: {
    id: 'toolbox',
    label: 'Toolbox',
    title: 'Toolbox Meeting',
    checklist: TOOLBOX_CHECKLIST,
    emptyFields: {
      date: TODAY(),
      jobProjectName: '',
      siteLocation: '',
      meetingLedBy: '',
      attendees: '',
      workPlannedToday: '',
      mainHazardsDiscussed: '',
      controlsAgreed: '',
      weatherGroundConditions: '',
      notes: '',
    },
  },
  incident: {
    id: 'incident',
    label: 'Incident',
    title: 'Incident / Near Miss',
    checklist: INCIDENT_CHECKLIST,
    emptyFields: {
      date: TODAY(),
      time: '',
      reportedBy: '',
      siteLocation: '',
      reportType: '',
      personInvolved: '',
      whatHappened: '',
      immediateActionTaken: '',
      possibleCause: '',
      correctiveActionRequired: '',
      correctiveActionPerson: '',
      followUpDate: '',
      notes: '',
    },
  },
  timesheet: {
    id: 'timesheet',
    label: 'Timesheet',
    title: 'Timesheet / Daily Work Record',
    checklist: [],
    emptyFields: {
      date: TODAY(),
      employeeName: '',
      jobProjectName: '',
      siteLocation: '',
      customerName: '',
      machineUsed: '',
      startTime: '',
      finishTime: '',
      breakMinutes: '',
      totalHoursWorked: '',
      chargeableHours: '',
      nonChargeableHours: '',
      nonChargeableReason: '',
      workCompleted: '',
      materialsUsed: '',
      docketNumber: '',
      delaysOrIssues: '',
      safetyIssues: '',
      notes: '',
    },
  },
}

export const ACTION_STATUS_LABELS = {
  open: 'Open',
  'in-progress': 'In Progress',
  completed: 'Completed',
}

export const ACTION_PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export const DEFAULT_ACTION_PRIORITY = 'medium'

export const ACTION_PRIORITIES = ['low', 'medium', 'high', 'critical']

export const ACTION_REGISTER_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'critical', label: 'Critical' },
]

export const SOURCE_TYPE_LABELS = {
  'pre-start': 'Machine Pre-Start',
  toolbox: 'Toolbox Meeting',
  incident: 'Incident / Near Miss',
  manual: 'Manual entry',
}

export const BACKUP_APP_NAME = 'Monrad Earthworx H&S App'
export const BACKUP_VERSION = 1

export const APP_STORAGE_KEYS = [
  { key: STORAGE_KEY, label: 'Job records (all forms including timesheet)', dataKey: 'jobRecords' },
  { key: ACTIONS_STORAGE_KEY, label: 'Action register', dataKey: 'actions' },
  { key: SETTINGS_STORAGE_KEY, label: 'Settings (operators, machines, sites)', dataKey: 'settings' },
]

export const FIELD_LABELS = {
  jobName: 'Job name',
  siteLocation: 'Site location',
  employeeName: 'Employee / operator',
  machineUsed: 'Machine used',
  machine: 'Machine',
  machineNameId: 'Machine name / ID',
  hourMeter: 'Hour meter',
  machineHours: 'Machine hours',
  operator: 'Operator',
  operatorName: 'Operator name',
  topic: 'Topic',
  jobProjectName: 'Job / project name',
  facilitator: 'Facilitator',
  meetingLedBy: 'Meeting led by',
  attendees: 'Attendees',
  workPlannedToday: 'Work planned today',
  hazardsDiscussed: 'Hazards discussed',
  mainHazardsDiscussed: 'Main hazards discussed',
  controlsAgreed: 'Controls agreed',
  weatherGroundConditions: 'Weather / ground conditions',
  reportType: 'Type of report',
  description: 'Description',
  whatHappened: 'What happened?',
  location: 'Location',
  peopleInvolved: 'People involved',
  personInvolved: 'Person involved',
  actionsTaken: 'Actions taken',
  immediateActionTaken: 'Immediate action taken',
  possibleCause: 'Possible cause',
  correctiveActionRequired: 'Corrective action required',
  correctiveActionPerson: 'Person responsible for corrective action',
  followUpDate: 'Follow-up date',
  incidentTime: 'Time',
  time: 'Time',
  reportedBy: 'Reported by',
  date: 'Date',
  notes: 'Notes',
  defectsFound: 'Any defects found?',
  defectDescription: 'Defect description',
  defectSeverity: 'Severity',
  machineOperableSafely: 'Can the machine still be operated safely?',
  actionRequired: 'Action required',
  reportedTo: 'Reported to',
  customerName: 'Customer / client',
  startTime: 'Start time',
  finishTime: 'Finish time',
  breakMinutes: 'Break time (minutes)',
  totalHoursWorked: 'Total hours worked',
  workCompleted: 'Work completed',
  materialsUsed: 'Materials used or delivered',
  docketNumber: 'Docket / reference number',
  delaysOrIssues: 'Delays or issues',
  safetyIssues: 'Safety issues or hazards noticed',
  chargeableHours: 'Chargeable hours',
  nonChargeableHours: 'Non-chargeable hours',
  nonChargeableReason: 'Reason for non-chargeable time',
}

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

export const WEEKLY_TIMESHEET_SUMMARY_LABEL = 'Weekly Timesheet Summary'

export const DASHBOARD_GROUPS = [
  {
    id: 'site-safety',
    title: 'Site Safety',
    cardIds: ['job-start', 'pre-start', 'toolbox', 'incident'],
  },
  {
    id: 'records-actions',
    title: 'Records & Actions',
    cardIds: ['action-register', 'safety-alerts', 'records-dashboard'],
  },
  {
    id: 'timesheets',
    title: 'Timesheets',
    cardIds: ['timesheet', 'weekly-timesheet-summary'],
  },
  {
    id: 'setup-backup',
    title: 'Setup & Backup',
    cardIds: ['settings', 'staff-management', 'admin-reports', 'backup-restore', 'help-app-setup'],
  },
]

export const DASHBOARD_CARDS = [
  {
    id: 'job-start',
    title: 'Job Start',
    group: 'site-safety',
    available: true,
  },
  {
    id: 'pre-start',
    title: 'Machine Pre-Start',
    group: 'site-safety',
    available: true,
  },
  {
    id: 'toolbox',
    title: 'Toolbox Meeting',
    group: 'site-safety',
    available: true,
  },
  {
    id: 'incident',
    title: 'Incident / Near Miss',
    group: 'site-safety',
    available: true,
  },
  {
    id: 'action-register',
    title: 'Action Register',
    group: 'records-actions',
    available: true,
  },
  {
    id: 'safety-alerts',
    title: 'Safety Alerts',
    group: 'records-actions',
    available: true,
  },
  {
    id: 'records-dashboard',
    title: 'Records',
    group: 'records-actions',
    available: true,
  },
  {
    id: 'timesheet',
    title: 'Timesheet',
    group: 'timesheets',
    available: true,
  },
  {
    id: 'weekly-timesheet-summary',
    title: 'Weekly Summary',
    group: 'timesheets',
    available: true,
  },
  {
    id: 'settings',
    title: 'Settings',
    group: 'setup-backup',
    available: true,
  },
  {
    id: 'staff-management',
    title: 'Staff Management',
    group: 'setup-backup',
    available: true,
    adminOnly: true,
  },
  {
    id: 'admin-reports',
    title: 'Admin Reports',
    group: 'setup-backup',
    available: true,
    adminOnly: true,
  },
  {
    id: 'backup-restore',
    title: 'Backup / Restore',
    group: 'setup-backup',
    available: true,
  },
  {
    id: 'help-app-setup',
    title: 'Help / App Setup',
    group: 'setup-backup',
    available: true,
  },
]
