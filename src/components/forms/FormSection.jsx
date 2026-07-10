export function FormSection({
  title,
  description,
  children,
  className = '',
  variant,
  id,
}) {
  const variantClass = variant ? ` form-section--${variant}` : ''

  return (
    <section
      className={`form-section${variantClass}${className ? ` ${className}` : ''}`}
      aria-labelledby={id ? `${id}-title` : undefined}
      id={id}
    >
      {title && (
        <h2 className="form-section__title" id={id ? `${id}-title` : undefined}>
          {title}
        </h2>
      )}
      {description && <p className="form-section__desc">{description}</p>}
      <div className="form-section__body">{children}</div>
    </section>
  )
}
