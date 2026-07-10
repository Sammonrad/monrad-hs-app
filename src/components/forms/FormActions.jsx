export function FormActions({ children, className = '' }) {
  return (
    <div className={`form-actions${className ? ` ${className}` : ''}`}>
      <div className="form-actions__inner">{children}</div>
    </div>
  )
}
