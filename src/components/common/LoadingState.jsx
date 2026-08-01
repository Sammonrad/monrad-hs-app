/**
 * Inline loading indicator — prevents empty-state flash before data arrives.
 */
export function LoadingState({ label = 'Loading…', className = '' }) {
  return (
    <div className={`loading-state ${className}`.trim()} role="status" aria-live="polite">
      <span className="loading-state__spinner" aria-hidden="true" />
      <p className="loading-state__label">{label}</p>
    </div>
  )
}
