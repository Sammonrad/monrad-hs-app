export function SsspInput({ value, onChange, type = 'text', placeholder, disabled }) {
  return (
    <input
      type={type}
      className="field__input"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}

export function SsspTextarea({ value, onChange, rows = 3, placeholder, disabled }) {
  return (
    <textarea
      className="field__input field__textarea"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}
