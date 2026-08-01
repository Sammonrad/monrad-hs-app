export function BackButton({ onClick, label = 'Back' }) {
  return (
    <button
      type="button"
      className="back-btn no-print"
      onClick={onClick}
      aria-label={label === 'Back' ? 'Back to Dashboard' : label}
    >
      <span className="back-btn__icon" aria-hidden="true">
        ←
      </span>
      <span className="back-btn__label">{label}</span>
    </button>
  )
}
