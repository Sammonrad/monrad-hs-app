import { MonradLogo } from '../MonradLogo.jsx'
import { EquipmentStatusBadge } from './EquipmentStatusBadge.jsx'
import { getEquipmentMakeModel, getEquipmentReadableName } from '../../constants/equipmentConfig.js'

export function PrintableEquipmentProfile({
  equipment,
  defects = [],
  services = [],
  documents = [],
  preStarts = [],
}) {
  const generated = new Date().toLocaleString('en-NZ')
  const openDefects = defects.filter((d) => d.status !== 'Resolved')

  return (
    <article className="print-equipment">
      <header className="print-equipment__header">
        <MonradLogo variant="print" />
        <h1 className="print-equipment__title">Equipment Profile</h1>
        <p className="print-equipment__asset">{getEquipmentReadableName(equipment)}</p>
        <p className="print-equipment__meta">Generated: {generated}</p>
      </header>

      <section className="print-equipment__section">
        <h2>Asset details</h2>
        <dl className="print-equipment__dl">
          <div><dt>Asset number</dt><dd>{equipment.assetNumber}</dd></div>
          <div><dt>Asset name</dt><dd>{equipment.assetName}</dd></div>
          <div><dt>Type</dt><dd>{equipment.assetType || '—'}</dd></div>
          <div><dt>Make / model</dt><dd>{getEquipmentMakeModel(equipment)}</dd></div>
          <div><dt>Status</dt><dd><EquipmentStatusBadge status={equipment.operationalStatus} /></dd></div>
          <div><dt>Registration</dt><dd>{equipment.registrationNumber || '—'}</dd></div>
          <div><dt>Serial number</dt><dd>{equipment.serialNumber || '—'}</dd></div>
          <div><dt>Assigned operator</dt><dd>{equipment.assignedOperator || '—'}</dd></div>
          <div><dt>Location</dt><dd>{equipment.normalLocation || '—'}</dd></div>
          <div><dt>Hours / Odometer</dt><dd>{equipment.currentHours || '—'} / {equipment.currentOdometer || '—'}</dd></div>
          <div><dt>Pre-start required</dt><dd>{equipment.prestartRequired ? 'Yes' : 'No'}</dd></div>
          <div><dt>Road legal</dt><dd>{equipment.roadLegal ? 'Yes' : 'No'}</dd></div>
        </dl>
        {equipment.notes && (
          <div className="print-equipment__notes">
            <strong>Notes:</strong> {equipment.notes}
          </div>
        )}
      </section>

      {openDefects.length > 0 && (
        <section className="print-equipment__section">
          <h2>Open defects ({openDefects.length})</h2>
          <ul>
            {openDefects.map((d) => (
              <li key={d.id}>
                [{d.severity}] {d.description} — {d.status}
              </li>
            ))}
          </ul>
        </section>
      )}

      {services.length > 0 && (
        <section className="print-equipment__section">
          <h2>Service history</h2>
          <ul>
            {services.map((s) => (
              <li key={s.id}>
                {s.serviceDate}: {s.serviceType} — {s.workCompleted || 'No details'}
              </li>
            ))}
          </ul>
        </section>
      )}

      {documents.length > 0 && (
        <section className="print-equipment__section">
          <h2>Compliance documents</h2>
          <ul>
            {documents.map((d) => (
              <li key={d.id}>
                {d.documentTitle} ({d.documentType}) — expires {d.expiryDate || 'N/A'}
              </li>
            ))}
          </ul>
        </section>
      )}

      {preStarts.length > 0 && (
        <section className="print-equipment__section">
          <h2>Pre-start history</h2>
          <ul>
            {preStarts.map((p) => (
              <li key={p.id}>
                {p.fields?.date}: {p.fields?.operatorName} — {p.defectsFound === 'found' ? 'Defects found' : 'OK'}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}

export function PrintableDefectReport({ defect, equipment }) {
  const generated = new Date().toLocaleString('en-NZ')
  return (
    <article className="print-equipment">
      <header className="print-equipment__header">
        <MonradLogo variant="print" />
        <h1 className="print-equipment__title">Equipment Defect Report</h1>
        <p className="print-equipment__asset">{defect.equipmentName || getEquipmentReadableName(equipment)}</p>
        <p className="print-equipment__meta">Generated: {generated}</p>
      </header>
      <section className="print-equipment__section">
        <dl className="print-equipment__dl">
          <div><dt>Reported</dt><dd>{new Date(defect.reportedAt).toLocaleString('en-NZ')}</dd></div>
          <div><dt>Severity</dt><dd>{defect.severity}</dd></div>
          <div><dt>Status</dt><dd>{defect.status}</dd></div>
          <div><dt>Description</dt><dd>{defect.description}</dd></div>
          <div><dt>Immediate action</dt><dd>{defect.immediateAction || '—'}</dd></div>
          <div><dt>Machine isolated</dt><dd>{defect.machineIsolated ? 'Yes' : 'No'}</dd></div>
          <div><dt>Safe to operate</dt><dd>{defect.safeToOperate ? 'Yes' : 'No'}</dd></div>
          <div><dt>Assigned to</dt><dd>{defect.assignedPerson || '—'}</dd></div>
          <div><dt>Target date</dt><dd>{defect.targetDate || '—'}</dd></div>
          <div><dt>Reported by</dt><dd>{defect.reportedByName || '—'}</dd></div>
          {defect.status === 'Resolved' && (
            <>
              <div><dt>Resolution</dt><dd>{defect.resolutionDetails}</dd></div>
              <div><dt>Resolved</dt><dd>{defect.resolvedAt ? new Date(defect.resolvedAt).toLocaleString('en-NZ') : '—'}</dd></div>
              <div><dt>Resolved by</dt><dd>{defect.resolvedByName || '—'}</dd></div>
            </>
          )}
        </dl>
      </section>
    </article>
  )
}

export function PrintableMaintenanceHistory({ equipment, services }) {
  const generated = new Date().toLocaleString('en-NZ')
  return (
    <article className="print-equipment">
      <header className="print-equipment__header">
        <MonradLogo variant="print" />
        <h1 className="print-equipment__title">Maintenance History</h1>
        <p className="print-equipment__asset">{getEquipmentReadableName(equipment)}</p>
        <p className="print-equipment__meta">Generated: {generated}</p>
      </header>
      <section className="print-equipment__section">
        {services.length === 0 ? (
          <p>No service records.</p>
        ) : (
          <table className="print-equipment__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Provider</th>
                <th>Work completed</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>{s.serviceDate}</td>
                  <td>{s.serviceType}</td>
                  <td>{s.serviceProvider || '—'}</td>
                  <td>{s.workCompleted || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </article>
  )
}

export function PrintableComplianceSummary({ equipment, documents }) {
  const generated = new Date().toLocaleString('en-NZ')
  return (
    <article className="print-equipment">
      <header className="print-equipment__header">
        <MonradLogo variant="print" />
        <h1 className="print-equipment__title">Compliance Summary</h1>
        <p className="print-equipment__asset">{getEquipmentReadableName(equipment)}</p>
        <p className="print-equipment__meta">Generated: {generated}</p>
      </header>
      <section className="print-equipment__section">
        {documents.length === 0 ? (
          <p>No compliance documents recorded.</p>
        ) : (
          <table className="print-equipment__table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Reference</th>
                <th>Expiry</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td>{d.documentType}</td>
                  <td>{d.documentTitle}</td>
                  <td>{d.referenceNumber || '—'}</td>
                  <td>{d.expiryDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </article>
  )
}
