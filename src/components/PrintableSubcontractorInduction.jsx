import { PrintHeader } from './common/PrintHeader.jsx'
import { INDUCTION_TOPICS } from '../utils/storage/subcontractorInductionStorage.js'
import { formatNzDate, formatSubmittedAt } from '../utils/formatting.js'
import { formatTime12Hour } from '../utils/time12Hour.js'

const value = (text) => text || '—'
export function PrintableSubcontractorInduction({ record }) {
  return <article className="print-general-meeting">
    <PrintHeader title="Subcontractor Induction" subtitle={`${value(record.companyName)} · ${value(record.subcontractorName)}`} meta={`Generated: ${formatSubmittedAt(new Date())}`} />
    <section className="print-general-meeting__section"><h2>Induction details</h2><dl className="print-general-meeting__dl">
      <div><dt>Date / time</dt><dd>{formatNzDate(record.inductionDate)} {formatTime12Hour(record.inductionTime)}</dd></div><div><dt>Site</dt><dd>{value(record.siteName)}</dd></div>
      <div><dt>Address</dt><dd>{value(record.siteAddress)}</dd></div><div><dt>Inducted by</dt><dd>{value(record.inductedBy)}</dd></div>
      <div><dt>Subcontractor</dt><dd>{value(record.subcontractorName)}</dd></div><div><dt>Company</dt><dd>{value(record.companyName)}</dd></div>
      <div><dt>Trade / role</dt><dd>{value(record.roleTrade)}</dd></div><div><dt>Phone</dt><dd>{value(record.phone)}</dd></div>
    </dl></section>
    <section className="print-general-meeting__section"><h2>Work, competency and emergency details</h2><p><strong>Work:</strong> {value(record.workDescription)}</p><p><strong>Licences / competencies:</strong> {value(record.licencesCompetencies)}</p><p><strong>Plant / equipment:</strong> {value(record.plantEquipment)}</p><p><strong>Emergency contact:</strong> {value(record.emergencyContactName)} · {value(record.emergencyContactPhone)}</p></section>
    <section className="print-general-meeting__section"><h2>Topics covered</h2><ul>{INDUCTION_TOPICS.map(([key, label]) => <li key={key}>{record.topics?.[key] ? '✓' : '○'} {label}</li>)}</ul></section>
    <section className="print-general-meeting__section"><h2>Site-specific matters</h2><p><strong>Hazards:</strong> {value(record.siteSpecificHazards)}</p><p><strong>Agreed controls:</strong> {value(record.agreedControls)}</p><p><strong>Questions / notes:</strong> {value(record.questionsNotes)}</p></section>
    <section className="print-general-meeting__section"><h2>Declaration and sign-off</h2><p>{record.subcontractorDeclaration ? 'The subcontractor confirmed the induction was understood and agreed to follow the stated controls.' : 'Declaration not yet confirmed.'}</p><dl className="print-general-meeting__dl"><div><dt>Subcontractor</dt><dd>{value(record.subcontractorSignature)}</dd></div><div><dt>Inducted by</dt><dd>{value(record.inducerSignature)}</dd></div></dl></section>
  </article>
}

