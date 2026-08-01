import { MonradLogo } from './MonradLogo.jsx'
import { formatSubmittedAt } from '../utils/formatting.js'
import { SSSP_SECTIONS } from '../constants/ssspSections.js'
import { getSsspStatusLabel } from '../constants/ssspStatuses.js'
import { getActiveHazards } from '../utils/storage/ssspStorage.js'
import { getRiskBandLabel } from '../constants/ssspRiskMatrix.js'
import { RiskMatrix } from './sssp/RiskMatrix.jsx'

function PrintSection({ title, children }) {
  return (
    <section className="print-sssp__section">
      <h2 className="print-sssp__section-title">{title}</h2>
      {children}
    </section>
  )
}

function PrintField({ label, value }) {
  if (!value) return null
  return (
    <div className="print-sssp__field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function PrintableSSSP({ record, includeAcknowledgements = false }) {
  if (!record) return null

  const recordData = record.recordData ?? {}
  const hazards = getActiveHazards(record.hazards ?? recordData.hazards ?? [])

  return (
    <article className="print-sssp">
      <header className="print-sssp__cover print-header">
        <MonradLogo variant="print" />
        <p className="print-header__company">Monrad Earthworx</p>
        <h1 className="print-sssp__title print-header__title">Site-Specific Safety Plan</h1>
        <p className="print-sssp__number">{record.ssspNumber}</p>
        <dl className="print-sssp__cover-meta">
          <PrintField label="Project" value={record.project} />
          <PrintField label="Client" value={record.client} />
          <PrintField label="Principal contractor" value={record.principalContractor} />
          <PrintField label="Site" value={record.site} />
          <PrintField label="Contract ref" value={record.contractRef} />
          <PrintField label="Revision" value={String(record.revision ?? 1)} />
          <PrintField label="Status" value={getSsspStatusLabel(record.status)} />
          <PrintField label="Prepared by" value={record.preparedBy} />
          <PrintField label="Effective date" value={record.effectiveDate} />
          <PrintField label="Printed" value={formatSubmittedAt(new Date().toISOString())} />
        </dl>
      </header>

      {SSSP_SECTIONS.map((section) => {
        if (section.isRiskRegister) {
          return (
            <PrintSection key={section.id} title={section.title}>
              {hazards.length === 0 ? (
                <p>No hazards recorded.</p>
              ) : (
                <table className="print-sssp__table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Activity</th>
                      <th>Hazard</th>
                      <th>Potential harm</th>
                      <th>Initial</th>
                      <th>Controls</th>
                      <th>Residual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hazards.map((h, i) => (
                      <tr key={h.id}>
                        <td>{i + 1}</td>
                        <td>{h.activity}</td>
                        <td>{h.hazard}</td>
                        <td>{h.potentialHarm || '—'}</td>
                        <td>
                          {h.initialRisk != null
                            ? `${h.initialRisk} (${getRiskBandLabel(h.initialRisk)})`
                            : '—'}
                        </td>
                        <td>{h.controls}</td>
                        <td>
                          {h.residualRisk != null
                            ? `${h.residualRisk} (${getRiskBandLabel(h.residualRisk)})`
                            : '—'}
                          {h.residualRiskExplanation ? (
                            <div className="print-sssp__note">{h.residualRiskExplanation}</div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="print-sssp__matrix-wrap">
                <h3>Risk matrix legend</h3>
                <RiskMatrix compact />
              </div>
            </PrintSection>
          )
        }

        const data = recordData[section.id]
        if (section.repeatable) {
          const items = Array.isArray(data) ? data : []
          return (
            <PrintSection key={section.id} title={section.title}>
              {items.length === 0 ? (
                <p>None recorded.</p>
              ) : (
                items.map((item, index) => (
                  <div key={item.id ?? index} className="print-sssp__repeat-block">
                    <h3 className="print-sssp__repeat-title">Entry {index + 1}</h3>
                    <dl className="print-sssp__fields">
                      {section.itemFields.map((field) => (
                        <PrintField key={field.key} label={field.label} value={item[field.key]} />
                      ))}
                    </dl>
                  </div>
                ))
              )}
            </PrintSection>
          )
        }

        return (
          <PrintSection key={section.id} title={section.title}>
            <dl className="print-sssp__fields">
              {section.fields.map((field) => (
                <PrintField key={field.key} label={field.label} value={data?.[field.key]} />
              ))}
            </dl>
          </PrintSection>
        )
      })}

      {recordData.changeLog?.length > 0 && (
        <PrintSection title="Change Log">
          <table className="print-sssp__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Detail</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {recordData.changeLog.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.at ? formatSubmittedAt(entry.at) : '—'}</td>
                  <td>{entry.action}</td>
                  <td>{entry.detail}</td>
                  <td>{entry.userName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSection>
      )}

      {includeAcknowledgements && record.acknowledgements?.length > 0 && (
        <PrintSection title="Staff Acknowledgements">
          <table className="print-sssp__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Revision</th>
                <th>Acknowledged</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {record.acknowledgements.map((ack) => (
                <tr key={ack.id}>
                  <td>{ack.userName}</td>
                  <td>{ack.revision}</td>
                  <td>{ack.acknowledgedAt ? formatSubmittedAt(ack.acknowledgedAt) : '—'}</td>
                  <td>{ack.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSection>
      )}

      <footer className="print-sssp__footer">
        <p>Monrad Earthworx — Site-Specific Safety Plan — {record.ssspNumber} Rev {record.revision}</p>
      </footer>
    </article>
  )
}
