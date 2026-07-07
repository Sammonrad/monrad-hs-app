import { exportRecordJson, exportRecordText } from '../utils/export.js'

export function RecordActions({ record, onPrint, variant = 'full' }) {
  return (
    <div className={`record__actions no-print record__actions--${variant}`}>
      <button type="button" className="print-record-btn" onClick={() => onPrint(record)}>
        Print Record
      </button>
      {variant === 'full' && (
        <>
          <button type="button" className="action-btn" onClick={() => exportRecordJson(record)}>
            Export JSON
          </button>
          <button type="button" className="action-btn" onClick={() => exportRecordText(record)}>
            Export text
          </button>
        </>
      )}
    </div>
  )
}
