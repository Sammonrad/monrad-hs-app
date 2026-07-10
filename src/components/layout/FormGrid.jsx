export function FormGrid({ children, className = '' }) {
  return <div className={`form-grid ${className}`.trim()}>{children}</div>
}

/** Span both columns on desktop (notes, textareas, full sections). */
export function FormGridFull({ children, className = '' }) {
  return <div className={`form-grid__full ${className}`.trim()}>{children}</div>
}
