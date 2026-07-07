export function RecordSignatureDisplay({ record }) {
  if (record.signatureConfirmation) {
    return (
      <div className="record__signature">
        <h3 className="record__subtitle">Signature / Name Confirmation</h3>
        <p className="record__signature-text">{record.signatureConfirmation}</p>
      </div>
    )
  }

  if (record.signature) {
    return (
      <div className="record__signature">
        <h3 className="record__subtitle">Signature</h3>
        <img src={record.signature} alt="Signature" className="record__signature-img" />
      </div>
    )
  }

  return null
}
