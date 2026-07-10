export function ValidationMessage({ message, variant = 'inline', messages = [], id }) {
  if (variant === 'summary') {
    const items = messages.length > 0 ? messages : message ? [message] : []
    if (items.length === 0) return null

    return (
      <div className="validation-summary" role="alert" id={id}>
        <p className="validation-summary__title">Please fix the following:</p>
        <ul className="validation-summary__list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    )
  }

  if (!message) return null

  return (
    <p className="validation-message" role="alert" id={id}>
      {message}
    </p>
  )
}
