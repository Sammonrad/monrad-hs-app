import { isSeriousDefect } from '../utils/defects.js'
import { DefectWarning } from './DefectWarning.jsx'
import { DefectPhotosDisplay } from './DefectPhotosDisplay.jsx'

export function DefectDetailsDisplay({ record }) {
  if (record.formType !== 'pre-start') return null

  return (
    <>
      {isSeriousDefect(record) && <DefectWarning />}
      {record.defectsFound === 'found' && record.defectPhotos?.length > 0 && (
        <DefectPhotosDisplay photos={record.defectPhotos} />
      )}
    </>
  )
}
