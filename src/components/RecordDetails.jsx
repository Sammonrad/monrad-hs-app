import { getRecordDetailRows } from '../utils/recordDetails.js'
import { DefectDetailsDisplay } from './DefectDetailsDisplay.jsx'
import { RecordSignatureDisplay } from './RecordSignatureDisplay.jsx'

export function RecordDetails({ record }) {
  const detailRows = getRecordDetailRows(record)

  return (
    <>
      <dl className="record__details">
        {detailRows.map(({ key, label, value }) => (
          <div key={key} className="record__row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {record.completedItems?.length > 0 && (
        <div className="record__checklist">
          <h3 className="record__subtitle">Completed checklist items</h3>
          <ul className="record__list">
            {record.completedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <DefectDetailsDisplay record={record} />

      <RecordSignatureDisplay record={record} />

      {record.photos?.length > 0 && (
        <div className="record__photos">
          <h3 className="record__subtitle">Photos</h3>
          <ul className="photos__thumbs photos__thumbs--record">
            {record.photos.map((photo) => (
              <li key={photo.id} className="photos__thumb">
                <img src={photo.dataUrl} alt={photo.name} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
