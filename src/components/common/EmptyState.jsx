/**
 * Reusable empty list / empty filter result presentation.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = '',
}) {
  return (
    <div className={`empty-state ${className}`.trim()} role="status">
      {Icon ? (
        <div className="empty-state__icon" aria-hidden="true">
          <Icon size={28} strokeWidth={1.75} />
        </div>
      ) : null}
      <h3 className="empty-state__title">{title}</h3>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {(primaryAction || secondaryAction) && (
        <div className="empty-state__actions">
          {primaryAction ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
            >
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
