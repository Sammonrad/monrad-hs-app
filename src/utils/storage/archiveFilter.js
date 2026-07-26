/**
 * Shared archive detection / filtering for record lists.
 *
 * Active = not archived. Missing/undefined `archived` is treated as active
 * (legacy rows before archive columns exist).
 */

export const ARCHIVE_RECORD_TYPES = {
  JOB_START: 'job-start',
  PRE_START: 'pre-start',
  TOOLBOX: 'toolbox',
  INCIDENT: 'incident',
  TIMESHEET: 'timesheet',
  ACTION: 'action',
  VISITOR: 'visitor',
  GENERAL_MEETING: 'general-meeting',
  EQUIPMENT: 'equipment',
  SSSP: 'sssp',
  SSSP_HAZARD: 'sssp-hazard',
}

/**
 * @param {object|null|undefined} record
 * @param {string} [type] ARCHIVE_RECORD_TYPES value or formType string
 * @returns {boolean}
 */
export function isArchived(record, type) {
  if (!record || typeof record !== 'object') return false

  if (type === ARCHIVE_RECORD_TYPES.SSSP || type === 'sssp') {
    return record.status === 'archived' || record.archived === true
  }

  if (type === ARCHIVE_RECORD_TYPES.SSSP_HAZARD || type === 'sssp-hazard') {
    return (
      record.archived === true ||
      record.hazard_data?.archived === true
    )
  }

  // Forms, actions, visitors, GM, equipment, and unknown types:
  // archived only when explicitly true (missing/undefined = active).
  return record.archived === true
}

/**
 * @param {object[]} records
 * @param {string} type
 * @returns {object[]}
 */
export function excludeArchived(records, type) {
  if (!Array.isArray(records)) return []
  return records.filter((record) => !isArchived(record, type))
}

/**
 * @param {object[]} records
 * @param {string} type
 * @param {boolean} [includeArchived=false]
 * @returns {object[]}
 */
export function filterArchived(records, type, includeArchived = false) {
  if (!Array.isArray(records)) return []
  if (includeArchived) return records
  return excludeArchived(records, type)
}
