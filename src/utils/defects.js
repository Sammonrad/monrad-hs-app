export function isSeriousDefect(record) {
  return (
    record.defectsFound === 'found' &&
    (record.defectSeverity === 'critical' || record.machineOperableSafely === 'no')
  )
}

export function createEmptyDefectState() {
  return {
    defectsFound: 'none',
    defectDescription: '',
    defectSeverity: '',
    machineOperableSafely: '',
    actionRequired: '',
    reportedTo: '',
    defectPhotos: [],
  }
}

export function normalizePreStartDefects(record) {
  return {
    defectsFound: record.defectsFound ?? '',
    defectDescription: record.defectDescription ?? '',
    defectSeverity: record.defectSeverity ?? '',
    machineOperableSafely: record.machineOperableSafely ?? '',
    actionRequired: record.actionRequired ?? '',
    reportedTo: record.reportedTo ?? '',
    defectPhotos: record.defectPhotos ?? [],
  }
}
