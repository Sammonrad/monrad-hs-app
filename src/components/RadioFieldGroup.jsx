export function RadioFieldGroup({ label, name, value, onChange, options }) {
  return (
    <fieldset className="radio-group">
      <legend className="field__label">{label}</legend>
      <div className="radio-group__options">
        {options.map((option) => (
          <label key={option.value} className="radio-group__option">
            <input
              type="radio"
              name={name}
              className="radio-group__input"
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value)}
            />
            <span className="radio-group__text">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
