export const SSSP_SECTIONS = [
  {
    id: 'documentControl',
    title: 'Document Control',
    shortTitle: 'Doc Control',
    fields: [
      { key: 'documentTitle', label: 'Document title', type: 'text', default: 'Site-Specific Safety Plan' },
      { key: 'documentOwner', label: 'Document owner', type: 'text' },
      { key: 'distributionList', label: 'Distribution list', type: 'textarea' },
      { key: 'reviewFrequency', label: 'Review frequency', type: 'text', default: 'As required or when scope changes' },
      { key: 'relatedDocuments', label: 'Related documents', type: 'textarea' },
    ],
  },
  {
    id: 'projectDetails',
    title: 'Project Details',
    shortTitle: 'Project',
    fields: [
      { key: 'projectName', label: 'Project name', type: 'text', required: true },
      { key: 'client', label: 'Client', type: 'text', required: true },
      { key: 'principalContractor', label: 'Principal contractor', type: 'text' },
      { key: 'siteAddress', label: 'Site address / location', type: 'text', required: true },
      { key: 'contractRef', label: 'Contract reference', type: 'text' },
      { key: 'startDate', label: 'Planned start date', type: 'date' },
      { key: 'endDate', label: 'Planned end date', type: 'date' },
      { key: 'projectDescription', label: 'Project description', type: 'textarea' },
    ],
  },
  {
    id: 'scope',
    title: 'Scope of Work',
    shortTitle: 'Scope',
    fields: [
      { key: 'workScope', label: 'Scope of work', type: 'textarea', required: true },
      { key: 'exclusions', label: 'Exclusions', type: 'textarea' },
      { key: 'assumptions', label: 'Assumptions', type: 'textarea' },
      { key: 'siteConditions', label: 'Site conditions', type: 'textarea' },
    ],
  },
  {
    id: 'roles',
    title: 'Roles & Responsibilities',
    shortTitle: 'Roles',
    repeatable: true,
    itemFields: [
      { key: 'role', label: 'Role / position', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'contact', label: 'Contact', type: 'text' },
      { key: 'responsibilities', label: 'Responsibilities', type: 'textarea' },
    ],
  },
  {
    id: 'siteArrangements',
    title: 'Site Arrangements',
    shortTitle: 'Site',
    fields: [
      { key: 'siteAccess', label: 'Site access / egress', type: 'textarea' },
      { key: 'parking', label: 'Parking and deliveries', type: 'textarea' },
      { key: 'amenities', label: 'Amenities (welfare, toilets)', type: 'textarea' },
      { key: 'boundaries', label: 'Site boundaries / neighbours', type: 'textarea' },
      { key: 'environmentalControls', label: 'Environmental controls', type: 'textarea' },
    ],
  },
  {
    id: 'riskRegister',
    title: 'Risk Register',
    shortTitle: 'Risks',
    isRiskRegister: true,
  },
  {
    id: 'emergency',
    title: 'Emergency Procedures',
    shortTitle: 'Emergency',
    fields: [
      { key: 'assemblyPoint', label: 'Assembly point', type: 'text', required: true },
      { key: 'emergencyContacts', label: 'Emergency contacts', type: 'textarea', required: true },
      { key: 'firstAid', label: 'First aid arrangements', type: 'textarea' },
      { key: 'firePlan', label: 'Fire / evacuation plan', type: 'textarea' },
      { key: 'nearestHospital', label: 'Nearest hospital / medical facility', type: 'text' },
      { key: 'spillResponse', label: 'Spill / environmental emergency', type: 'textarea' },
    ],
  },
  {
    id: 'plant',
    title: 'Plant & Equipment',
    shortTitle: 'Plant',
    repeatable: true,
    itemFields: [
      { key: 'plantType', label: 'Plant / equipment type', type: 'text', required: true },
      { key: 'registration', label: 'Registration / ID', type: 'text' },
      { key: 'operator', label: 'Operator requirements', type: 'text' },
      { key: 'inspections', label: 'Inspection / maintenance', type: 'textarea' },
      { key: 'hazards', label: 'Associated hazards', type: 'textarea' },
    ],
  },
  {
    id: 'training',
    title: 'Training & Competency',
    shortTitle: 'Training',
    repeatable: true,
    itemFields: [
      { key: 'trainingTopic', label: 'Training / competency topic', type: 'text', required: true },
      { key: 'requiredFor', label: 'Required for', type: 'text' },
      { key: 'evidence', label: 'Evidence / records', type: 'textarea' },
    ],
  },
  {
    id: 'ppe',
    title: 'PPE Requirements',
    shortTitle: 'PPE',
    fields: [
      { key: 'minimumPpe', label: 'Minimum PPE for all personnel', type: 'textarea', required: true },
      { key: 'taskSpecificPpe', label: 'Task-specific PPE', type: 'textarea' },
      { key: 'ppeInspection', label: 'PPE inspection / replacement', type: 'textarea' },
    ],
  },
  {
    id: 'hazardousSubstances',
    title: 'Hazardous Substances',
    shortTitle: 'Haz Subs',
    fields: [
      { key: 'substancesUsed', label: 'Substances used on site', type: 'textarea' },
      { key: 'sdsLocation', label: 'SDS location / access', type: 'textarea' },
      { key: 'storageHandling', label: 'Storage and handling', type: 'textarea' },
      { key: 'spillKit', label: 'Spill kit location', type: 'text' },
    ],
  },
  {
    id: 'permits',
    title: 'Permits & Authorisations',
    shortTitle: 'Permits',
    fields: [
      { key: 'permitsRequired', label: 'Permits required', type: 'textarea' },
      { key: 'permitProcess', label: 'Permit-to-work process', type: 'textarea' },
      { key: 'authorisedPersons', label: 'Authorised persons', type: 'textarea' },
    ],
  },
  {
    id: 'traffic',
    title: 'Traffic Management',
    shortTitle: 'Traffic',
    fields: [
      { key: 'tmpReference', label: 'TMP reference / version', type: 'text' },
      { key: 'vehicleRoutes', label: 'Vehicle routes and parking', type: 'textarea' },
      { key: 'pedestrianSeparation', label: 'Pedestrian separation', type: 'textarea' },
      { key: 'publicInterface', label: 'Public interface controls', type: 'textarea' },
    ],
  },
  {
    id: 'subcontractors',
    title: 'Subcontractors',
    shortTitle: 'Subs',
    repeatable: true,
    itemFields: [
      { key: 'companyName', label: 'Company name', type: 'text', required: true },
      { key: 'scope', label: 'Scope of work', type: 'textarea' },
      { key: 'hsRequirements', label: 'H&S requirements / induction', type: 'textarea' },
      { key: 'contact', label: 'Contact person', type: 'text' },
    ],
  },
  {
    id: 'communication',
    title: 'Communication',
    shortTitle: 'Comms',
    fields: [
      { key: 'toolboxFrequency', label: 'Toolbox / pre-start frequency', type: 'textarea' },
      { key: 'reportingLines', label: 'Reporting lines', type: 'textarea' },
      { key: 'consultation', label: 'Worker consultation', type: 'textarea' },
      { key: 'documentUpdates', label: 'Document update communication', type: 'textarea' },
    ],
  },
  {
    id: 'incidentReporting',
    title: 'Incident Reporting',
    shortTitle: 'Incidents',
    fields: [
      { key: 'reportingProcess', label: 'Incident / near-miss reporting process', type: 'textarea', required: true },
      { key: 'notificationRequirements', label: 'Notification requirements (WorkSafe, client)', type: 'textarea' },
      { key: 'investigationProcess', label: 'Investigation process', type: 'textarea' },
    ],
  },
  {
    id: 'monitoring',
    title: 'Monitoring & Review',
    shortTitle: 'Monitoring',
    fields: [
      { key: 'inspectionSchedule', label: 'Inspection schedule', type: 'textarea' },
      { key: 'auditProcess', label: 'Audit / review process', type: 'textarea' },
      { key: 'performanceIndicators', label: 'Performance indicators', type: 'textarea' },
      { key: 'revisionTriggers', label: 'Triggers for SSSP revision', type: 'textarea' },
    ],
  },
  {
    id: 'supportingDocs',
    title: 'Supporting Documents',
    shortTitle: 'Docs',
    fields: [
      { key: 'referencedDocs', label: 'Referenced documents / drawings', type: 'textarea' },
      { key: 'certificates', label: 'Certificates / SWMS / TMP attachments', type: 'textarea' },
      { key: 'otherReferences', label: 'Other references', type: 'textarea' },
    ],
  },
  {
    id: 'declaration',
    title: 'Declaration',
    shortTitle: 'Declaration',
    fields: [
      { key: 'preparedByName', label: 'Prepared by (name)', type: 'text', required: true },
      { key: 'preparedByTitle', label: 'Title / role', type: 'text' },
      { key: 'preparedDate', label: 'Date prepared', type: 'date' },
      { key: 'approvedByName', label: 'Approved by (name)', type: 'text' },
      { key: 'approvedDate', label: 'Date approved', type: 'date' },
      { key: 'declarationText', label: 'Declaration statement', type: 'textarea', default: 'I confirm this Site-Specific Safety Plan has been prepared in consultation with workers and reflects the hazards and controls for this site.' },
    ],
  },
]

export function getSsspSectionById(id) {
  return SSSP_SECTIONS.find((section) => section.id === id) ?? null
}

export function createEmptySectionData(section) {
  if (section.repeatable) return []
  const data = {}
  section.fields?.forEach((field) => {
    data[field.key] = field.default ?? ''
  })
  return data
}

export function createEmptySsspRecordData() {
  const data = {}
  SSSP_SECTIONS.forEach((section) => {
    if (!section.isRiskRegister) {
      data[section.id] = createEmptySectionData(section)
    }
  })
  data.hazards = []
  data.changeLog = []
  return data
}
