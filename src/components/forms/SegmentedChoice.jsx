const CHOICE_STYLES = {
  yes: 'segmented-choice__btn--yes',
  no: 'segmented-choice__btn--no',
  na: 'segmented-choice__btn--na',
  none: 'segmented-choice__btn--na',
  found: 'segmented-choice__btn--no',
}

export function SegmentedChoice({
  label,
  name,
  value,
  onChange,
  options,
  required = false,
  error,
  fieldId,
}) {
  const groupId = fieldId || name

  return (
    <fieldset
      className={`segmented-choice${error ? ' segmented-choice--error' : ''}`}
      data-field-id={groupId}
    >
      <legend className="segmented-choice__legend">
        {label}
        {required && (
          <span className="form-field__required" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </legend>
      <div className="segmented-choice__options" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const isSelected = value === option.value
          const styleClass = CHOICE_STYLES[option.value] || 'segmented-choice__btn--neutral'

          return (
            <label
              key={option.value}
              className={`segmented-choice__btn ${styleClass}${isSelected ? ' segmented-choice__btn--selected' : ''}`}
            >
              <input
                type="radio"
                className="segmented-choice__input"
                name={name}
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value)}
              />
              <span className="segmented-choice__text">{option.label}</span>
            </label>
          )
        })}
      </div>
      {error && <p className="validation-message" role="alert">{error}</p>}
    </fieldset>
  )
}
