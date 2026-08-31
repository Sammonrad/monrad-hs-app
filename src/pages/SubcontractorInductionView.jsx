import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { BackButton } from '../components/BackButton.jsx'
import { CloudSyncBadge } from '../components/CloudSyncBadge.jsx'
import { ConfirmModal } from '../components/common/ConfirmModal.jsx'
import { FormPageHeader } from '../components/forms/FormPageHeader.jsx'
import { FormSection } from '../components/forms/FormSection.jsx'
import { FormActions } from '../components/forms/FormActions.jsx'
import { FormGrid, FormGridFull } from '../components/layout/FormGrid.jsx'
import { TextField, DateField, TimeField } from '../components/FormFields.jsx'
import { PrintableSubcontractorInduction } from '../components/PrintableSubcontractorInduction.jsx'
import { formatNzDate, formatSubmittedAt } from '../utils/formatting.js'
import { formatTime12Hour } from '../utils/time12Hour.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import { createEmptySubcontractorInduction, INDUCTION_TOPICS, mergeSubcontractorInductions, normalizeSubcontractorInduction, persistSubcontractorInductions } from '../utils/storage/subcontractorInductionStorage.js'
import { deleteSubcontractorInduction, fetchSubcontractorInductions, saveSubcontractorInduction, isCloudSaveUnavailable, getUnavailableSyncStatus, formatCloudSaveError, SYNC_STATUS } from '../utils/storage/subcontractorInductionCloudStorage.js'

function TextArea({ label, value, onChange, placeholder }) { return <label className="field"><span className="field__label">{label}</span><textarea className="field__input field__textarea" rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label> }

export function SubcontractorInductionView({ onBack, records, setRecords, cloudRecords, setCloudRecords, user, profile }) {
  const [mode, setMode] = useState('list'), [draft, setDraft] = useState(createEmptySubcontractorInduction), [selectedId, setSelectedId] = useState(null)
  const [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [search, setSearch] = useState(''), [printRecord, setPrintRecord] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null), [deleting, setDeleting] = useState(false), [deleteError, setDeleteError] = useState('')
  const merged = useMemo(() => mergeSubcontractorInductions(records, cloudRecords), [records, cloudRecords])
  const selected = merged.find((item) => item.id === selectedId || item.cloudId === selectedId)
  const filtered = merged.filter((item) => [item.subcontractorName, item.companyName, item.siteName, item.roleTrade, item.inductionDate].join(' ').toLowerCase().includes(search.toLowerCase()))
  useEffect(() => { if (!user?.id) return; let live = true; fetchSubcontractorInductions(user.id, { isAdmin: isAdminProfile(profile) }).then(({ records: found, error }) => { if (!live) return; if (error) setMessage(`Could not load cloud records: ${formatCloudSaveError(error)}. Showing device records only.`); else setCloudRecords(found) }); return () => { live = false } }, [user?.id, profile, setCloudRecords])
  useEffect(() => { if (!printRecord) return; const timer = setTimeout(() => window.print(), 300); const done = () => setPrintRecord(null); addEventListener('afterprint', done); return () => { clearTimeout(timer); removeEventListener('afterprint', done) } }, [printRecord])
  const patch = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }))
  const patchLocal = (record) => setRecords((prev) => { const next = [record, ...prev.filter((item) => item.id !== record.id)]; persistSubcontractorInductions(next); return next })
  const startNew = () => { setDraft(createEmptySubcontractorInduction()); setSelectedId(null); setMessage(''); setMode('edit') }
  const startEdit = (record) => { setDraft(normalizeSubcontractorInduction(record)); setSelectedId(record.id); setMessage(''); setMode('edit') }
  async function save(complete) {
    if (!draft.inductionDate || !draft.subcontractorName.trim() || !draft.companyName.trim() || !draft.siteName.trim()) { setMessage('Date, subcontractor name, company and site are required.'); return }
    if (complete && (!draft.subcontractorDeclaration || !draft.subcontractorSignature.trim() || !draft.inducerSignature.trim())) { setMessage('Both sign-off names and the declaration are required to complete the induction.'); return }
    setSaving(true); setMessage('')
    let payload = normalizeSubcontractorInduction({ ...draft, status: complete ? 'completed' : 'draft', updatedAt: new Date().toISOString(), submittedAt: complete ? new Date().toISOString() : draft.submittedAt })
    patchLocal(payload)
    if (isCloudSaveUnavailable(user)) payload = { ...payload, syncStatus: getUnavailableSyncStatus(user), storageSource: 'local' }
    else { const { record, error } = await saveSubcontractorInduction(user, payload); if (error) { payload = { ...payload, syncStatus: SYNC_STATUS.CLOUD_FAILED }; setMessage(`Cloud save failed — saved on this device. ${formatCloudSaveError(error)}`) } else if (record) { payload = { ...record, id: payload.id }; setCloudRecords((prev) => [record, ...prev.filter((item) => item.cloudId !== record.cloudId)]); } }
    patchLocal(payload); setSaving(false); setSelectedId(payload.id); setMode('detail')
  }
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true); setDeleteError('')
    if (deleteTarget.cloudId) {
      const { ok, error } = await deleteSubcontractorInduction(user, deleteTarget, { isAdmin: isAdminProfile(profile) })
      if (!ok) { setDeleteError(`Delete failed: ${formatCloudSaveError(error)}`); setDeleting(false); return }
    }
    setRecords((prev) => {
      const next = prev.filter((item) => item.id !== deleteTarget.id && item.cloudId !== deleteTarget.cloudId)
      persistSubcontractorInductions(next)
      return next
    })
    setCloudRecords((prev) => prev.filter((item) => item.id !== deleteTarget.id && item.cloudId !== deleteTarget.cloudId))
    setDeleting(false); setDeleteTarget(null); setSelectedId(null); setMode('list'); setMessage('Induction deleted.')
  }
  if (mode === 'edit') return <><BackButton onClick={() => setMode(selectedId ? 'detail' : 'list')} /><FormPageHeader title="Subcontractor Induction" subtitle="Complete with the subcontractor before work begins" />{message && <p className="validation-message validation-message--error" role="alert">{message}</p>}
    <form className="job-form no-print" onSubmit={(e) => e.preventDefault()}>
      <FormSection title="Induction and site details"><FormGrid><DateField label="Induction date" field="inductionDate" value={draft.inductionDate} onChange={patch}/><TimeField label="Time" field="inductionTime" value={draft.inductionTime} onChange={patch}/><TextField label="Site / project name" field="siteName" value={draft.siteName} onChange={patch}/><TextField label="Site address" field="siteAddress" value={draft.siteAddress} onChange={patch}/><TextField label="Principal contractor" field="principalContractor" value={draft.principalContractor} onChange={patch}/><TextField label="Inducted by" field="inductedBy" value={draft.inductedBy} onChange={patch}/></FormGrid></FormSection>
      <FormSection title="Subcontractor details"><FormGrid><TextField label="Full name" field="subcontractorName" value={draft.subcontractorName} onChange={patch}/><TextField label="Company" field="companyName" value={draft.companyName} onChange={patch}/><TextField label="Trade / role" field="roleTrade" value={draft.roleTrade} onChange={patch}/><TextField label="Phone" field="phone" value={draft.phone} onChange={patch} type="tel"/><TextField label="Email" field="email" value={draft.email} onChange={patch} type="email"/><TextField label="Emergency contact" field="emergencyContactName" value={draft.emergencyContactName} onChange={patch}/><TextField label="Emergency contact phone" field="emergencyContactPhone" value={draft.emergencyContactPhone} onChange={patch} type="tel"/><FormGridFull><TextArea label="Work being undertaken" value={draft.workDescription} onChange={(v) => patch('workDescription', v)} /></FormGridFull><FormGridFull><TextArea label="Relevant licences, training and competencies" value={draft.licencesCompetencies} onChange={(v) => patch('licencesCompetencies', v)} /></FormGridFull><FormGridFull><TextArea label="Plant, vehicles or equipment to be used" value={draft.plantEquipment} onChange={(v) => patch('plantEquipment', v)} /></FormGridFull></FormGrid></FormSection>
      <FormSection title="Induction topics covered"><div className="check-grid">{INDUCTION_TOPICS.map(([key, label]) => <label className="check-item" key={key}><input type="checkbox" checked={Boolean(draft.topics[key])} onChange={(e) => patch('topics', { ...draft.topics, [key]: e.target.checked })}/><span>{label}</span></label>)}</div></FormSection>
      <FormSection title="Site-specific hazards and controls"><FormGrid><FormGridFull><TextArea label="Site-specific hazards discussed" value={draft.siteSpecificHazards} onChange={(v) => patch('siteSpecificHazards', v)} /></FormGridFull><FormGridFull><TextArea label="Agreed controls / special conditions" value={draft.agreedControls} onChange={(v) => patch('agreedControls', v)} /></FormGridFull><FormGridFull><TextArea label="Questions, concerns or notes" value={draft.questionsNotes} onChange={(v) => patch('questionsNotes', v)} /></FormGridFull></FormGrid></FormSection>
      <FormSection title="Declaration and sign-off"><label className="check-item"><input type="checkbox" checked={draft.subcontractorDeclaration} onChange={(e) => patch('subcontractorDeclaration', e.target.checked)}/><span>I confirm I have understood this induction, had the opportunity to ask questions, and agree to follow the site rules and controls.</span></label><FormGrid><TextField label="Subcontractor signature / typed full name" field="subcontractorSignature" value={draft.subcontractorSignature} onChange={patch}/><TextField label="Inducted by signature / typed full name" field="inducerSignature" value={draft.inducerSignature} onChange={patch}/></FormGrid></FormSection>
      <FormActions><button className="btn btn--secondary" type="button" disabled={saving} onClick={() => save(false)}>Save draft</button><button className="btn btn--primary" type="button" disabled={saving} onClick={() => save(true)}>{saving ? 'Saving…' : 'Complete induction'}</button></FormActions>
    </form></>
  if (mode === 'detail' && selected) return <>
    {printRecord && <div className="print-area" aria-hidden="true"><PrintableSubcontractorInduction record={printRecord}/></div>}
    <BackButton onClick={() => setMode('list')}/>
    <header className="gm-detail-header"><div><h1 className="page-title">{selected.subcontractorName}</h1><p className="page-description">{selected.companyName} · {formatNzDate(selected.inductionDate)} · {selected.status === 'completed' ? 'Completed' : 'Draft'}</p><CloudSyncBadge syncStatus={selected.syncStatus} className="cloud-sync-status--block"/></div></header>
    <div className="gm-detail-actions no-print"><button className="btn btn--secondary" onClick={() => startEdit(selected)}>Edit</button><button className="btn btn--secondary" onClick={() => setPrintRecord(selected)}>Print / Save PDF</button><button className="btn btn--danger" onClick={() => { setDeleteError(''); setDeleteTarget(selected) }}>Delete</button></div>
    <section className="gm-detail-summary"><dl className="gm-detail-summary__dl"><div><dt>Site</dt><dd>{selected.siteName || '—'}</dd></div><div><dt>Date / time</dt><dd>{formatNzDate(selected.inductionDate)} {formatTime12Hour(selected.inductionTime)}</dd></div><div><dt>Trade / role</dt><dd>{selected.roleTrade || '—'}</dd></div><div><dt>Inducted by</dt><dd>{selected.inductedBy || selected.inducerSignature || '—'}</dd></div><div><dt>Work</dt><dd>{selected.workDescription || '—'}</dd></div><div><dt>Saved</dt><dd>{formatSubmittedAt(selected.submittedAt || selected.updatedAt || selected.createdAt)}</dd></div></dl></section>
    <section className="gm-detail-summary"><h2>Topics covered</h2><ul>{INDUCTION_TOPICS.filter(([key]) => selected.topics[key]).map(([key, label]) => <li key={key}>{label}</li>)}</ul><h2>Hazards and agreed controls</h2><p>{selected.siteSpecificHazards || '—'}</p><p>{selected.agreedControls || '—'}</p></section>
    <ConfirmModal open={Boolean(deleteTarget)} title="Delete subcontractor induction?" message={`Permanently delete the induction for ${deleteTarget?.subcontractorName || 'this subcontractor'}? This cannot be undone.`} confirmLabel="Delete induction" processingLabel="Deleting" processing={deleting} error={deleteError} onCancel={() => { if (!deleting) { setDeleteTarget(null); setDeleteError('') } }} onConfirm={handleDelete}/>
  </>
  return <><BackButton onClick={onBack}/><FormPageHeader title="Subcontractor Induction" subtitle="Create, review and print subcontractor induction records"/>{message && <p className="validation-message validation-message--warning">{message}</p>}<div className="gm-dashboard"><div className="gm-dashboard__toolbar"><button className="btn btn--primary" onClick={startNew}><Plus size={16}/>New induction</button></div><div className="gm-dashboard__filters"><div className="gm-dashboard__search"><Search size={16}/><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, company, site or trade…"/></div></div><section className="gm-history"><h2 className="gm-history__title">Induction history</h2><div className="responsive-data-list__desktop"><table className="equipment-table gm-history-table"><thead><tr><th>Date</th><th>Subcontractor</th><th>Company</th><th>Site</th><th>Status</th><th>Sync</th><th>Actions</th></tr></thead><tbody>{filtered.length ? filtered.map((record) => <tr key={record.id}><td>{formatNzDate(record.inductionDate)}</td><td>{record.subcontractorName}</td><td>{record.companyName}</td><td>{record.siteName}</td><td>{record.status}</td><td><CloudSyncBadge syncStatus={record.syncStatus} size="small"/></td><td><button className="btn btn--secondary btn--small" onClick={() => { setSelectedId(record.id); setMode('detail') }}>Open</button></td></tr>) : <tr><td colSpan="7">No induction records found.</td></tr>}</tbody></table></div><div className="responsive-data-list__mobile">{filtered.map((record) => <article className="gm-history-card" key={record.id}><header className="gm-history-card__header"><div><h3>{record.subcontractorName}</h3><p>{record.companyName} · {record.siteName}</p></div></header><p>{formatNzDate(record.inductionDate)} · {record.status}</p><CloudSyncBadge syncStatus={record.syncStatus} size="small"/><button className="btn btn--secondary" onClick={() => { setSelectedId(record.id); setMode('detail') }}>Open</button></article>)}</div></section></div></>
}
