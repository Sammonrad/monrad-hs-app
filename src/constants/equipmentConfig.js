export const ASSET_TYPES = [
  'Excavator',
  'Loader',
  'Bulldozer',
  'Grader',
  'Compactor',
  'Roller',
  'Truck',
  'Transporter',
  'Trailer',
  'Ute',
  'Generator',
  'Pump',
  'Attachment',
  'Small Plant',
  'Other',
]

export const OPERATIONAL_STATUSES = ['Available', 'In Use', 'Maintenance', 'Out of Service']

export const OWNERSHIP_STATUSES = ['Owned', 'Leased', 'Hired', 'Other']

export const DEFECT_SEVERITIES = ['Minor', 'Major', 'Critical']

export const DEFECT_STATUSES = ['Open', 'In Progress', 'Deferred', 'Resolved']

export const DEFECT_SOURCES = ['Manual', 'Machine Pre-Start', 'Inspection', 'Other']

export function getEquipmentReadableName(equipment) {
  if (!equipment) return ''
  const number = equipment.assetNumber?.trim() ?? ''
  const name = equipment.assetName?.trim() ?? ''
  if (number && name) return `${number} — ${name}`
  return number || name
}

export function getEquipmentMakeModel(equipment) {
  const make = equipment.make?.trim() ?? ''
  const model = equipment.model?.trim() ?? ''
  if (make && model) return `${make} ${model}`
  return make || model || '—'
}

export function matchesEquipmentSearch(equipment, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const fields = [
    equipment.assetNumber,
    equipment.assetName,
    equipment.assetType,
    equipment.make,
    equipment.model,
    equipment.registrationNumber,
    equipment.serialNumber,
    equipment.assignedOperator,
    getEquipmentReadableName(equipment),
  ]
  return fields.some((value) => value?.toLowerCase().includes(q))
}

export function isActiveEquipment(equipment) {
  return equipment && !equipment.archived
}

export function isPreStartSelectable(equipment) {
  return isActiveEquipment(equipment) && equipment.prestartRequired
}
