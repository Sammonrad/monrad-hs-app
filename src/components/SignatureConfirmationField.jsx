export function SignatureConfirmationField({ value, onChange }) {
  return (
    <label className="field">
      <span className="field__label">Signature / Name Confirmation</span>
      <input
        type="text"
        className="field__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your full name to confirm"
      />
    </label>
  )
}
