import { useEffect } from 'react'

/**
 * In-app confirmation modal (replaces window.confirm for destructive UX).
 * Reuses archive/permanent-delete modal patterns and body-scroll lock.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  processing = false,
  processingLabel,
  variant = 'danger',
  error = '',
  children,
}) {
  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape' && !processing) onCancel?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, processing, onCancel])

  if (!open) return null

  const confirmClass =
    variant === 'danger' ? 'btn btn--danger' : variant === 'primary' ? 'btn btn--primary' : 'btn btn--secondary'

  return (
    <div
      className="equipment-modal-overlay confirm-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !processing) onCancel?.()
      }}
    >
      <div className="equipment-modal archive-record-modal confirm-modal">
        <button
          type="button"
          className="equipment-modal__close"
          onClick={onCancel}
          disabled={processing}
          aria-label="Close"
        >
          ×
        </button>
        <h2 id="confirm-modal-title" className="archive-record-modal__title">
          {title}
        </h2>
        {message ? <p className="archive-record-modal__message">{message}</p> : null}
        {children}
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
            disabled={processing}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmClass}
            onClick={onConfirm}
            disabled={processing}
          >
            {processing ? processingLabel || `${confirmLabel}…` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
