export function ComboField({ label, field, value, onChange, placeholder, options = [], listId }) {
  const datalistId = listId || `combo-${field}`
  const hasOptions = options.length > 0

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        type="text"
        className="field__input"
        list={hasOptions ? datalistId : undefined}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {hasOptions && (
        <datalist id={datalistId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
      {hasOptions && (
        <span className="field__hint">Pick from saved list or type manually</span>
      )}
    </label>
  )
}

export function TextField({ label, field, value, onChange, placeholder }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        type="text"
        className="field__input"
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

export function DateField({ value, onChange, field = 'date', label = 'Date' }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        type="date"
        className="field__input"
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
      />
    </label>
  )
}

export function TimeField({ value, onChange, field, label }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        type="time"
        className="field__input"
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
      />
    </label>
  )
}

export function SelectField({ label, field, value, onChange, options }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select
        className="field__input"
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value || 'empty'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function NotesField({ value, onChange }) {
  return (
    <label className="field">
      <span className="field__label">Notes</span>
      <textarea
        className="field__input field__textarea"
        value={value}
        onChange={(e) => onChange('notes', e.target.value)}
        placeholder="Any additional notes..."
        rows={3}
      />
    </label>
  )
}

export function SummaryRow({ label, value }) {
  return (
    <div className="saved-record__row">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  )
}
