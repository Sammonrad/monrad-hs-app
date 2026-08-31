export {
  STORAGE_KEY,
  ACTIONS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  VISITOR_SIGN_IN_STORAGE_KEY,
  VISITOR_SIGN_IN_DRAFT_KEY,
  SSSP_EDITOR_DRAFT_KEY,
  GENERAL_MEETING_STORAGE_KEY,
  MAX_PHOTOS,
} from './storageKeys.js'

import {
  STORAGE_KEY,
  ACTIONS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  VISITOR_SIGN_IN_STORAGE_KEY,
  SSSP_EDITOR_DRAFT_KEY,
  GENERAL_MEETING_STORAGE_KEY,
} from './storageKeys.js'

export const MACHINE_TYPES = ['Excavator', 'Truck', 'Loader', 'Roller', 'Other']
export const NZ_TIME_ZONE = 'Pacific/Auckland'
export const TODAY = () => {
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: NZ_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

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
  'general-meeting': 'H&S General Meeting',
  manual: 'Manual entry',
}

export const BACKUP_APP_NAME = 'Monrad Earthworx H&S App'
export const BACKUP_VERSION = 1

export const VISITOR_ACKNOWLEDGEMENT_ITEMS = [
  {
    key: 'siteRules',
    label: 'I have read and understand the site safety rules and will follow all instructions.',
  },
  {
    key: 'ppeRequired',
    label: 'I will wear all required PPE at all times while on site.',
  },
  {
    key: 'emergencyProcedures',
    label: 'I know the emergency procedures and assembly point for this site.',
  },
  {
    key: 'criticalRisksReviewed',
    label: 'I have reviewed (or been briefed on) the critical site risks before entering.',
  },
]

export const VISITOR_DECLARATION_TEXT =
  'I confirm the information provided is accurate and I accept responsibility for my safety and the safety of others while on site.'

export const VISITOR_PRIVACY_NOTE =
  'Visitor details are stored securely for health and safety purposes and may be shared with site management in an emergency.'

export const APP_STORAGE_KEYS = [
  { key: STORAGE_KEY, label: 'Job records (all forms including timesheet)', dataKey: 'jobRecords' },
  { key: ACTIONS_STORAGE_KEY, label: 'Action register', dataKey: 'actions' },
  { key: SETTINGS_STORAGE_KEY, label: 'Settings (operators, machines, sites)', dataKey: 'settings' },
  {
    key: VISITOR_SIGN_IN_STORAGE_KEY,
    label: 'Visitor sign-in records',
    dataKey: 'visitorSignInRecords',
  },
  {
    key: GENERAL_MEETING_STORAGE_KEY,
    label: 'H&S General Meeting records',
    dataKey: 'generalMeetingRecords',
  },
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

export {
  NAV_ITEMS,
  DESKTOP_SIDEBAR_GROUPS,
  SIDEBAR_GROUPS,
  DASHBOARD_GROUPS,
  DASHBOARD_CARDS,
  FORM_VIEW_IDS,
  getNavItem,
  getPageMeta,
  getVisibleNavItems,
  getNavGroups,
} from './navigation.js'
