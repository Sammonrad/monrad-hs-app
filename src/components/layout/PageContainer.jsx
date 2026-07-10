export function PageContainer({ children, variant = 'default', className = '' }) {
  const variantClass =
    variant === 'form'
      ? 'page-container--form'
      : variant === 'wide'
        ? 'page-container--wide'
        : ''

  return (
    <div className={`page-container ${variantClass} ${className}`.trim()}>{children}</div>
  )
}
