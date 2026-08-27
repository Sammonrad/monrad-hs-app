import { SSSP_SECTIONS } from '../../constants/ssspSections.js'
import { SSSP_STATUS } from '../../constants/ssspStatuses.js'
import { isHighOrExtremeRisk } from '../../constants/ssspRiskMatrix.js'
import { getActiveHazards } from './ssspStorage.js'
import { validateSsspNumberFormat } from './ssspNumbering.js'

function isEmpty(value) {
  if (value == null) return true
  if (typeof value === 'string') return !value.trim()
  if (Array.isArray(value)) return value.length === 0
  return false
}

export function getSectionNotApplicableKey(section) {
  if (!section?.allowsNotApplicable) return null
  return section.notApplicableKey ?? `${section.id}NotApplicable`
}

export function isSectionNotApplicable(recordData, section) {
  const key = getSectionNotApplicableKey(section)
  if (!key) return false
  return recordData?.[key] === true
}

function sectionHasAnyContent(section, recordData) {
  const data = recordData?.[section.id]
  if (section.repeatable) {
    return Array.isArray(data) && data.length > 0
  }
  return Boolean(
    section.fields?.some((field) => {
      const value = data?.[field.key]
      return typeof value === 'string' ? Boolean(value.trim()) : !isEmpty(value)
    }),
  )
}

function validateSectionFields(section, data) {
  const errors = []

  if (section.repeatable) {
    const items = Array.isArray(data) ? data : []
    if (section.id === 'roles' && items.length === 0) {
      errors.push('At least one role/responsibility entry is required.')
    }
    items.forEach((item, index) => {
      section.itemFields?.forEach((field) => {
        if (field.required && isEmpty(item?.[field.key])) {
          errors.push(`${section.title}: row ${index + 1} — ${field.label} is required.`)
        }
      })
    })
    return errors
  }

  section.fields?.forEach((field) => {
    if (field.required && isEmpty(data?.[field.key])) {
      errors.push(`${section.title}: ${field.label} is required.`)
    }
  })

  return errors
}

function validateHazards(hazards, gate) {
  const errors = []
  const active = getActiveHazards(hazards)

  if (gate !== 'draft' && active.length === 0) {
    errors.push('Risk register must include at least one active hazard.')
  }

  active.forEach((hazard, index) => {
    const row = index + 1
    if (isEmpty(hazard.activity)) errors.push(`Risk row ${row}: Activity is required.`)
    if (isEmpty(hazard.hazard)) errors.push(`Risk row ${row}: Hazard is required.`)
    if (isEmpty(hazard.controls)) errors.push(`Risk row ${row}: Controls are required.`)

    if (gate === 'approval' || gate === 'submitted') {
      if (!hazard.initialLikelihood || !hazard.initialConsequence) {
        errors.push(`Risk row ${row}: Initial likelihood and consequence are required.`)
      }
      if (!hazard.residualLikelihood || !hazard.residualConsequence) {
        errors.push(`Risk row ${row}: Residual likelihood and consequence are required.`)
      }
      if (isHighOrExtremeRisk(hazard.residualRisk) && isEmpty(hazard.residualRiskExplanation)) {
        errors.push(
          `Risk row ${row}: High/extreme residual risk requires an explanation of additional controls.`,
        )
      }
    }
  })

  return errors
}

function validateEmergency(recordData, gate) {
  if (gate === 'draft') return []
  const emergency = recordData.emergency ?? {}
  const errors = []
  if (isEmpty(emergency.assemblyPoint)) {
    errors.push('Emergency: Assembly point is required.')
  }
  if (isEmpty(emergency.emergencyContacts)) {
    errors.push('Emergency: Emergency contacts are required.')
  }
  return errors
}

/** Existing required-field / risk checks for a section (ignores N/A). */
export function existingRequiredSectionValidationPasses(section, recordData, hazards, gate = 'ready') {
  if (section.isRiskRegister) {
    return validateHazards(hazards ?? recordData?.hazards, gate).length === 0
  }
  return validateSectionFields(section, recordData?.[section.id]).length === 0
}

/**
 * Section complete when marked N/A, or when required validation passes
 * (and N/A-eligible sections also have content if not marked N/A).
 */
export function isSsspSectionComplete(section, recordData, hazards, gate = 'ready') {
  if (isSectionNotApplicable(recordData, section)) return true

  if (section.allowsNotApplicable && !sectionHasAnyContent(section, recordData)) {
    return false
  }

  return existingRequiredSectionValidationPasses(section, recordData, hazards, gate)
}

export function getIncompleteSsspSections(record, gate = 'ready') {
  const recordData = record?.recordData ?? {}
  const hazards = record?.hazards ?? recordData.hazards
  return SSSP_SECTIONS.filter(
    (section) => !isSsspSectionComplete(section, recordData, hazards, gate),
  )
}

export function validateSsspRecord(record, gate = 'draft') {
  const errors = []
  const recordData = record?.recordData ?? {}

  const numberError = validateSsspNumberFormat(record?.ssspNumber)
  if (numberError) errors.push(numberError)

  if (gate !== 'draft') {
    if (isEmpty(record?.project)) errors.push('Project name is required.')
    if (isEmpty(record?.client)) errors.push('Client is required.')
    if (isEmpty(record?.site)) errors.push('Site address is required.')
    if (isEmpty(record?.preparedBy)) errors.push('Prepared by name is required.')
  }

  SSSP_SECTIONS.forEach((section) => {
    if (section.isRiskRegister) return
    if (isSectionNotApplicable(recordData, section)) return

    if (gate === 'ready' || gate === 'approval' || gate === 'submitted') {
      if (section.allowsNotApplicable && !sectionHasAnyContent(section, recordData)) {
        errors.push(
          `${section.title}: mark as “Not applicable for this job” or add section details.`,
        )
        return
      }
      errors.push(...validateSectionFields(section, recordData[section.id]))
    }
  })

  errors.push(...validateEmergency(recordData, gate === 'draft' ? 'draft' : 'ready'))
  errors.push(...validateHazards(record.hazards ?? recordData.hazards, gate))

  if (gate === 'submitted') {
    const declaration = recordData.declaration ?? {}
    if (isEmpty(declaration.approvedByName)) {
      errors.push('Declaration: Approved by name is required before submitting to site.')
    }
    if (record.status !== SSSP_STATUS.APPROVED && record.status !== SSSP_STATUS.SUBMITTED) {
      errors.push('SSSP must be approved before it can be submitted to site.')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function getValidationGateForStatus(targetStatus) {
  switch (targetStatus) {
    case SSSP_STATUS.READY_FOR_REVIEW:
      return 'ready'
    case SSSP_STATUS.APPROVED:
      return 'approval'
    case SSSP_STATUS.SUBMITTED:
      return 'submitted'
    default:
      return 'draft'
  }
}

export function canTransitionStatus(currentStatus, targetStatus, isAdmin) {
  if (!isAdmin) return { allowed: false, reason: 'Only admins can change SSSP workflow status.' }

  const transitions = {
    [SSSP_STATUS.DRAFT]: [SSSP_STATUS.READY_FOR_REVIEW, SSSP_STATUS.ARCHIVED],
    [SSSP_STATUS.READY_FOR_REVIEW]: [SSSP_STATUS.DRAFT, SSSP_STATUS.APPROVED, SSSP_STATUS.ARCHIVED],
    [SSSP_STATUS.APPROVED]: [SSSP_STATUS.SUBMITTED, SSSP_STATUS.CLOSED, SSSP_STATUS.ARCHIVED],
    [SSSP_STATUS.SUBMITTED]: [SSSP_STATUS.CLOSED, SSSP_STATUS.ARCHIVED],
    [SSSP_STATUS.CLOSED]: [SSSP_STATUS.ARCHIVED],
    [SSSP_STATUS.ARCHIVED]: [SSSP_STATUS.DRAFT],
  }

  const allowed = transitions[currentStatus]?.includes(targetStatus)
  return {
    allowed: Boolean(allowed),
    reason: allowed ? null : `Cannot move from ${currentStatus} to ${targetStatus}.`,
  }
}
