export function SavedRecordSignature({ record }) {
  if (record.signatureConfirmation) {
    return <p className="saved-record__signature-text">{record.signatureConfirmation}</p>
  }

  if (record.signature) {
    return <img src={record.signature} alt="Signature" className="saved-record__signature" />
  }

  return null
}
