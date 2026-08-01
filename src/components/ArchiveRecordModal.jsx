import { useEffect } from 'react'

/**
 * In-app confirmation for archiving a record (no window.confirm).
 */
export function ArchiveRecordModal({
  open,
  onCancel,
  onConfirm,
  archiving = false,
  error = '',
}) {
  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="equipment-modal-overlay archive-record-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-record-title"
    >
      <div className="equipment-modal archive-record-modal">
        <button
          type="button"
          className="equipment-modal__close"
          onClick={onCancel}
          disabled={archiving}
          aria-label="Close"
        >
          ×
        </button>
        <h2 id="archive-record-title" className="archive-record-modal__title">
          Archive record?
        </h2>
        <p className="archive-record-modal__message">
          This record will be removed from normal lists and moved to Archived Records. It can be
          restored later.
        </p>
        {error ? (
          <p className="validation-message validation-message--error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="archive-record-modal__actions modal-footer-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onCancel}
            disabled={archiving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onConfirm}
            disabled={archiving}
          >
            {archiving ? 'Archiving…' : 'Archive Record'}
          </button>
        </div>
      </div>
    </div>
  )
}
