export function BackButton({ onClick }) {
  return (
    <button
      type="button"
      className="back-btn no-print"
      onClick={onClick}
      aria-label="Back to Dashboard"
    >
      ← Back to Dashboard
    </button>
  )
}
