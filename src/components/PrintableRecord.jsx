import { formatSubmittedAt } from '../utils/formatting.js'
import { getRecordDetailRows } from '../utils/recordDetails.js'
import { isSeriousDefect } from '../utils/defects.js'
import { DefectWarning } from './DefectWarning.jsx'
import { PrintHeader } from './common/PrintHeader.jsx'

export function PrintableRecord({ record }) {
  const detailRows = getRecordDetailRows(record)

  return (
    <article className="print-record">
      <PrintHeader
        title={record.formTypeLabel}
        meta={`Record saved: ${formatSubmittedAt(record.submittedAt)}`}
      />

      <section className="print-record__section">
        <h2 className="print-record__section-title">Record details</h2>
        <dl className="print-record__details">
          {detailRows.map(({ key, label, value }) => (
            <div key={key} className="print-record__row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {record.totalCount > 0 && (
        <section className="print-record__section">
          <h2 className="print-record__section-title">Completed checklist items</h2>
          <p className="print-record__progress">
            {record.completedCount ?? 0} of {record.totalCount} completed
          </p>
          {record.completedItems?.length > 0 ? (
            <ul className="print-record__checklist">
              {record.completedItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="print-record__empty">No checklist items were completed.</p>
          )}
        </section>
      )}

      {record.formType === 'pre-start' && isSeriousDefect(record) && (
        <section className="print-record__section">
          <DefectWarning />
        </section>
      )}

      {record.formType === 'pre-start' &&
        record.defectsFound === 'found' &&
        record.defectPhotos?.length > 0 && (
          <section className="print-record__section">
            <h2 className="print-record__section-title">Defect photos</h2>
            <div className="print-record__photos">
              {record.defectPhotos.map((photo) => (
                <figure key={photo.id} className="print-record__photo">
                  <img src={photo.dataUrl} alt={photo.name} />
                </figure>
              ))}
            </div>
          </section>
        )}

      {(record.signatureConfirmation || record.signature) && (
        <section className="print-record__section">
          <h2 className="print-record__section-title">
            {record.signatureConfirmation ? 'Signature / Name Confirmation' : 'Signature'}
          </h2>
          {record.signatureConfirmation ? (
            <p className="print-record__signature-text">{record.signatureConfirmation}</p>
          ) : (
            <img src={record.signature} alt="Signature" className="print-record__signature" />
          )}
        </section>
      )}

      {record.photos?.length > 0 && (
        <section className="print-record__section">
          <h2 className="print-record__section-title">Photos</h2>
          <div className="print-record__photos">
            {record.photos.map((photo) => (
              <figure key={photo.id} className="print-record__photo">
                <img src={photo.dataUrl} alt={photo.name} />
              </figure>
            ))}
          </div>
        </section>
      )}

      <footer className="print-record__footer">
        Monrad Earthworx — {record.formTypeLabel} — saved {formatSubmittedAt(record.submittedAt)}
      </footer>
    </article>
  )
}
