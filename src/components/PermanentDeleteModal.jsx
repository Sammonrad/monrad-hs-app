import { useEffect } from 'react'

/**
 * In-app confirmation for permanent delete (no window.confirm).
 * Confirm stays disabled until the user types DELETE exactly.
 */
export function PermanentDeleteModal({
  open,
  onCancel,
  onConfirm,
  deleting = false,
  error = '',
  recordLabel = '',
  confirmText = '',
  onConfirmTextChange,
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

  const canConfirm = confirmText === 'DELETE' && !deleting

  return (
    <div
      className="equipment-modal-overlay archive-record-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="permanent-delete-title"
    >
      <div className="equipment-modal archive-record-modal permanent-delete-modal">
        <button
          type="button"
          className="equipment-modal__close"
          onClick={onCancel}
          disabled={deleting}
          aria-label="Close"
        >
          ×
        </button>
        <h2 id="permanent-delete-title" className="archive-record-modal__title">
          Permanently delete?
        </h2>
        <p className="archive-record-modal__message">
          {recordLabel
            ? `“${recordLabel}” will be permanently deleted.`
            : 'This record will be permanently deleted.'}{' '}
          This action cannot be undone.
        </p>
        <label className="field permanent-delete-modal__confirm-field">
          <span className="field__label">Type DELETE to confirm</span>
          <input
            type="text"
            className="field__input"
            value={confirmText}
            onChange={(e) => onConfirmTextChange?.(e.target.value)}
            disabled={deleting}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby="permanent-delete-hint"
          />
        </label>
        <p id="permanent-delete-hint" className="form-hint permanent-delete-modal__hint">
          This action cannot be undone.
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
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {deleting ? 'Deleting…' : 'Permanently Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
