import { ValidationMessage } from './ValidationMessage.jsx'

export function FormField({
  label,
  htmlFor,
  fieldId,
  required = false,
  error,
  hint,
  children,
  className = '',
}) {
  const dataId = fieldId || htmlFor

  return (
    <div
      className={`form-field${error ? ' form-field--error' : ''}${className ? ` ${className}` : ''}`}
      data-field-id={dataId || undefined}
    >
      {label && (
        <label className="form-field__label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="form-field__required" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
      {children}
      {hint && <p className="form-field__hint">{hint}</p>}
      {error && <ValidationMessage message={error} />}
    </div>
  )
}
