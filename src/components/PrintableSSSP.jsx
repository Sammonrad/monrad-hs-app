import { MonradLogo } from './MonradLogo.jsx'
import { formatNzDate } from '../utils/formatting.js'
import { SSSP_SECTIONS } from '../constants/ssspSections.js'
import { getSsspStatusLabel } from '../constants/ssspStatuses.js'
import { getActiveHazards } from '../utils/storage/ssspStorage.js'
import { getRiskBandClass, getRiskBandLabel } from '../constants/ssspRiskMatrix.js'
import { isSectionNotApplicable } from '../utils/storage/ssspValidation.js'

const PRINT_TEXT_REPLACEMENTS = [
  [/Experianced and competant/gi, 'Experienced and competent'],
  [/Licensed and competant/gi, 'Licensed and competent'],
  [/Iron man oncrete/gi, 'Iron Man Concrete'],
  [/\bHigh vis\b/gi, 'High-visibility'],
  [/\bhigh-vis\b/gi, 'high-visibility'],
]

/** Display-only cleanup for print/PDF output — does not mutate stored record data. */
export function formatPrintText(value) {
  if (value == null || value === '') return value
  let text = String(value)
  for (const [pattern, replacement] of PRINT_TEXT_REPLACEMENTS) {
    text = text.replace(pattern, replacement)
  }
  text = text.replace(
    /\b(0\d{1,2})[\s.\-()/]*(\d{3,4})[\s.\-()/]*(\d{3,4})\b/g,
    (_, area, part1, part2) => `${area} ${part1} ${part2}`,
  )
  return text
}

function formatFieldValue(value, type) {
  if (value == null || value === '') return '—'
  if (type === 'date') return formatNzDate(value)
  return formatPrintText(String(value))
}

function formatSectionNumber(number) {
  return String(number).padStart(2, '0')
}

function PrintSection({ number, title, children, className = '', sectionId }) {
  const sectionClass = sectionId ? ` print-sssp__section--${sectionId}` : ''
  return (
    <section className={`print-sssp__section${sectionClass}${className ? ` ${className}` : ''}`}>
      <h2 className="print-sssp__section-title">
        <span className="print-sssp__section-number">{formatSectionNumber(number)}</span>{' '}
        <span className="print-sssp__section-name">{title}</span>
      </h2>
      <div className="print-sssp__section-body">{children}</div>
    </section>
  )
}

function PrintFieldTable({ fields, data, showEmpty = false }) {
  const rows = fields.filter((field) => showEmpty || data?.[field.key])
  if (rows.length === 0) {
    return <p className="print-sssp__empty">No details recorded.</p>
  }

  return (
    <table className="print-sssp__field-table">
      <tbody>
        {rows.map((field) => (
          <tr key={field.key}>
            <th scope="row">{field.label}</th>
            <td>{formatFieldValue(data?.[field.key], field.type)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PrintRiskBadge({ score }) {
  if (score == null) return '—'
  const band = getRiskBandClass(score)
  return (
    <span className={`print-sssp__risk print-sssp__risk--${band}`}>
      <span className="print-sssp__risk-score">{score}</span>
      <span className="print-sssp__risk-label">{getRiskBandLabel(score)}</span>
    </span>
  )
}

function PrintRepeatableBlock({ section, item }) {
  return (
    <div className="print-sssp__repeatable-block">
      <table className="print-sssp__field-table">
        <tbody>
          {section.itemFields.map((field) => {
            const value = item[field.key]
            if (value == null || value === '') return null
            return (
              <tr key={field.key}>
                <th scope="row">{field.label}</th>
                <td>{formatFieldValue(value, field.type)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PrintRepeatableBlocks({ section, items, continuationNumber, continuationTitle }) {
  if (items.length === 0) {
    return <p className="print-sssp__empty">None recorded.</p>
  }

  const showContinuation = continuationNumber != null && continuationTitle && items.length > 1

  if (!showContinuation) {
    return (
      <div className="print-sssp__repeatable-blocks">
        {items.map((item, index) => (
          <PrintRepeatableBlock key={item.id ?? index} section={section} item={item} />
        ))}
      </div>
    )
  }

  return (
    <div className="print-sssp__repeatable-blocks">
      <PrintRepeatableBlock section={section} item={items[0]} />
      <div className="print-sssp__section-continued">
        <h2 className="print-sssp__section-title">
          <span className="print-sssp__section-number">{formatSectionNumber(continuationNumber)}</span>{' '}
          <span className="print-sssp__section-name">{continuationTitle} - CONTINUED</span>
        </h2>
        {items.slice(1).map((item, index) => (
          <PrintRepeatableBlock key={item.id ?? index + 1} section={section} item={item} />
        ))}
      </div>
    </div>
  )
}

function PrintHazardTableHead() {
  return (
    <thead>
      <tr>
        <th className="print-sssp__table-index">#</th>
        <th className="print-sssp__col-activity">Activity</th>
        <th className="print-sssp__col-hazard">Hazard</th>
        <th className="print-sssp__col-harm">Potential harm</th>
        <th className="print-sssp__col-risk">Initial</th>
        <th className="print-sssp__col-controls">Controls</th>
        <th className="print-sssp__col-risk">Residual</th>
      </tr>
    </thead>
  )
}

function PrintHazardRow({ hazard, index }) {
  return (
    <tr className="print-sssp__hazard-row">
      <td className="print-sssp__table-index">{index + 1}</td>
      <td className="print-sssp__cell-muted">
        {hazard.activity ? formatPrintText(hazard.activity) : '—'}
      </td>
      <td className="print-sssp__cell-emphasis">
        {hazard.hazard ? formatPrintText(hazard.hazard) : '—'}
      </td>
      <td className="print-sssp__col-harm">
        {hazard.potentialHarm ? formatPrintText(hazard.potentialHarm) : '—'}
      </td>
      <td>
        <PrintRiskBadge score={hazard.initialRisk} />
      </td>
      <td>{hazard.controls ? formatPrintText(hazard.controls) : '—'}</td>
      <td>
        <PrintRiskBadge score={hazard.residualRisk} />
        {hazard.residualRiskExplanation ? (
          <div className="print-sssp__note">
            {formatPrintText(hazard.residualRiskExplanation)}
          </div>
        ) : null}
      </td>
    </tr>
  )
}

function PrintRiskRegisterTables({ hazards }) {
  const firstBatch = hazards.slice(0, 4)
  const secondBatch = hazards.slice(4, 8)

  return (
    <>
      <div className="print-sssp__table-wrap print-sssp__risk-table-wrap">
        <table className="print-sssp__table print-sssp__table--hazards">
          <PrintHazardTableHead />
          <tbody>
            {firstBatch.map((hazard, index) => (
              <PrintHazardRow key={hazard.id} hazard={hazard} index={index} />
            ))}
          </tbody>
        </table>
      </div>
      {secondBatch.length > 0 ? (
        <div className="print-sssp__table-wrap print-sssp__risk-table-wrap print-sssp__risk-table-wrap--second">
          <table className="print-sssp__table print-sssp__table--hazards">
            <PrintHazardTableHead />
            <tbody>
              {secondBatch.map((hazard, index) => (
                <PrintHazardRow key={hazard.id} hazard={hazard} index={index + 4} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  )
}

function PrintRiskLegend() {
  return (
    <div className="print-sssp__risk-legend" aria-label="Risk matrix legend">
      <span className="print-sssp__risk-legend-title">Risk matrix legend</span>
      <div className="print-sssp__risk-legend-items">
        <span className="print-sssp__risk-legend-item print-sssp__risk-legend-item--low">Low 1–4</span>
        <span className="print-sssp__risk-legend-item print-sssp__risk-legend-item--medium">
          Medium 5–9
        </span>
        <span className="print-sssp__risk-legend-item print-sssp__risk-legend-item--high">High 10–16</span>
        <span className="print-sssp__risk-legend-item print-sssp__risk-legend-item--extreme">
          Extreme 17–25
        </span>
      </div>
    </div>
  )
}

function PrintDeclaration({ data }) {
  const declarationFields = [
    { key: 'preparedByName', label: 'Prepared by' },
    { key: 'preparedByTitle', label: 'Title / role' },
    { key: 'preparedDate', label: 'Date prepared', type: 'date' },
    { key: 'approvedByName', label: 'Approved by' },
    { key: 'approvedDate', label: 'Date approved', type: 'date' },
  ]

  return (
    <div className="print-sssp__declaration">
      <PrintFieldTable fields={declarationFields} data={data} showEmpty />
      <div className="print-sssp__signature-row">
        <div className="print-sssp__signature-item">
          <span className="print-sssp__signature-label">Prepared by</span>
          <span className="print-sssp__signature-name">{data?.preparedByName || '—'}</span>
          <span className="print-sssp__signature-prompt">Signature</span>
          <span className="print-sssp__signature-line" aria-hidden="true" />
        </div>
        <div className="print-sssp__signature-item">
          <span className="print-sssp__signature-label">Approved by</span>
          <span className="print-sssp__signature-name">{data?.approvedByName || '—'}</span>
          <span className="print-sssp__signature-prompt">Date</span>
          <span className="print-sssp__signature-date">
            {data?.approvedDate ? formatNzDate(data.approvedDate) : '________________'}
          </span>
        </div>
      </div>
    </div>
  )
}

function CoverMetaRow({ label, value, type, showEmpty = false, className = '' }) {
  if (!showEmpty && (value == null || value === '')) return null
  return (
    <div className={`sssp-print-meta-row${className ? ` ${className}` : ''}`}>
      <dt>{label}</dt>
      <dd>{formatFieldValue(value, type)}</dd>
    </div>
  )
}

function CoverFieldList({ fields }) {
  return (
    <dl className="sssp-print-field-list">
      {fields.map((field) => (
        <CoverMetaRow
          key={field.label}
          label={field.label}
          value={field.value}
          type={field.type}
          showEmpty={field.showEmpty}
        />
      ))}
    </dl>
  )
}

const COVER_SECTION_IDS = new Set(['documentControl', 'projectDetails'])

export function PrintableSSSP({ record, includeAcknowledgements = false }) {
  if (!record) return null

  const recordData = record.recordData ?? {}
  const hazards = getActiveHazards(record.hazards ?? recordData.hazards ?? [])
  const projectDetails = recordData.projectDetails ?? {}
  const documentControl = recordData.documentControl ?? {}
  const declarationData = recordData.declaration ?? {}

  const projectDisplay = record.project || projectDetails.projectName
  const siteDisplay = record.site || projectDetails.siteAddress
  const clientDisplay = record.client || projectDetails.client
  const principalDisplay = record.principalContractor || projectDetails.principalContractor
  const preparedByDisplay =
    record.preparedBy || declarationData.preparedByName || documentControl.documentOwner
  const startDate = projectDetails.startDate || record.effectiveDate
  const contractRef = record.contractRef || projectDetails.contractRef
  const revisionNumber = record.revision ?? 1
  const effectiveDate = record.effectiveDate || startDate || declarationData.preparedDate
  const statusLabel = getSsspStatusLabel(record.status)

  const projectFieldsLeft = [
    { label: 'Project', value: projectDisplay, showEmpty: true },
    { label: 'Client', value: clientDisplay, showEmpty: true },
    { label: 'Principal contractor', value: principalDisplay, showEmpty: true },
    { label: 'Site', value: siteDisplay, showEmpty: true },
  ]

  const projectFieldsRight = [
    { label: 'Contract reference', value: contractRef, showEmpty: true },
    { label: 'Prepared by', value: preparedByDisplay, showEmpty: true },
    { label: 'Effective date', value: effectiveDate, type: 'date', showEmpty: true },
    { label: 'Status', value: statusLabel, showEmpty: true },
  ]

  const controlFields = [
    {
      label: 'Document title',
      value: documentControl.documentTitle || 'Site-Specific Safety Plan',
      showEmpty: true,
    },
    {
      label: 'Document owner',
      value: documentControl.documentOwner || 'Monrad Earthworx',
      showEmpty: true,
    },
    {
      label: 'Distribution list',
      value: documentControl.distributionList,
      showEmpty: true,
      className: 'sssp-print-meta-row--full',
    },
    { label: 'Review frequency', value: documentControl.reviewFrequency, showEmpty: true },
    {
      label: 'Related documents',
      value: documentControl.relatedDocuments,
      showEmpty: true,
      className: 'sssp-print-meta-row--full',
    },
  ]

  const printableSections = SSSP_SECTIONS.filter((section) => !COVER_SECTION_IDS.has(section.id))
  let sectionNumber = 0

  return (
    <article className="print-sssp sssp-print-root">
      <header className="sssp-print-cover">
        <div className="sssp-print-header">
          <div className="sssp-print-header-brand">
            <MonradLogo variant="print" className="sssp-print-logo" />
          </div>
          <div className="sssp-print-header-doc">
            <h1 className="sssp-print-title">Site-Specific Safety Plan</h1>
            <div className="sssp-print-header-meta">
              {record.ssspNumber ? (
                <p className="sssp-print-ref">{record.ssspNumber}</p>
              ) : (
                <p className="sssp-print-ref sssp-print-ref--draft">Draft reference pending</p>
              )}
              <span className="sssp-print-revision">Revision {revisionNumber}</span>
            </div>
          </div>
        </div>

        <div className="sssp-print-header-accent" aria-hidden="true" />

        <section className="sssp-print-project">
          <h2 className="sssp-print-panel-title">Project Information</h2>
          <div className="sssp-print-grid">
            <CoverFieldList fields={projectFieldsLeft} />
            <CoverFieldList fields={projectFieldsRight} />
          </div>
        </section>

        <section className="sssp-print-document-control">
          <h2 className="sssp-print-panel-title">Document Control</h2>
          <dl className="sssp-print-control-grid">
            {controlFields.map((field) => (
              <CoverMetaRow
                key={field.label}
                label={field.label}
                value={field.value}
                type={field.type}
                showEmpty={field.showEmpty}
                className={field.className}
              />
            ))}
          </dl>
        </section>

        <p className="sssp-print-cover-status">{statusLabel}</p>
      </header>

      <div className="print-sssp__content">
        {printableSections.map((section) => {
          sectionNumber += 1
          const currentNumber = sectionNumber

          if (isSectionNotApplicable(recordData, section)) {
            return (
              <PrintSection
                key={section.id}
                number={currentNumber}
                title={section.title}
                sectionId={section.id}
              >
                <p className="print-sssp__na">Not applicable for this project.</p>
              </PrintSection>
            )
          }

          if (section.isRiskRegister) {
            return (
              <PrintSection
                key={section.id}
                number={currentNumber}
                title={section.title}
                sectionId={section.id}
              >
                {hazards.length === 0 ? (
                  <p className="print-sssp__empty">No hazards recorded.</p>
                ) : (
                  <PrintRiskRegisterTables hazards={hazards} />
                )}
                <PrintRiskLegend />
              </PrintSection>
            )
          }

          const data = recordData[section.id]

          if (section.id === 'declaration') {
            return (
              <PrintSection
                key={section.id}
                number={currentNumber}
                title={section.title}
                sectionId={section.id}
                className="print-sssp__section--declaration"
              >
                <PrintDeclaration data={data} />
              </PrintSection>
            )
          }

          if (section.repeatable) {
            const items = Array.isArray(data) ? data : []
            const useContinuation = section.id === 'subcontractors' && items.length > 1
            return (
              <PrintSection
                key={section.id}
                number={currentNumber}
                title={section.title}
                sectionId={section.id}
              >
                <PrintRepeatableBlocks
                  section={section}
                  items={items}
                  continuationNumber={useContinuation ? currentNumber : undefined}
                  continuationTitle={useContinuation ? section.title : undefined}
                />
              </PrintSection>
            )
          }

          return (
            <PrintSection
              key={section.id}
              number={currentNumber}
              title={section.title}
              sectionId={section.id}
            >
              <PrintFieldTable fields={section.fields} data={data} />
            </PrintSection>
          )
        })}

        {recordData.changeLog?.length > 0 && (
          <PrintSection number={++sectionNumber} title="Change Log">
            <div className="print-sssp__table-wrap">
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
                      <td>{entry.at ? formatNzDate(entry.at) : '—'}</td>
                      <td>{entry.action ? formatPrintText(entry.action) : '—'}</td>
                      <td>{entry.detail ? formatPrintText(entry.detail) : '—'}</td>
                      <td>{entry.userName ? formatPrintText(entry.userName) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PrintSection>
        )}

        {includeAcknowledgements && record.acknowledgements?.length > 0 && (
          <PrintSection number={++sectionNumber} title="Staff Acknowledgements">
            <div className="print-sssp__table-wrap">
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
                      <td>{ack.userName ? formatPrintText(ack.userName) : '—'}</td>
                      <td>{ack.revision ?? '—'}</td>
                      <td>{ack.acknowledgedAt ? formatNzDate(ack.acknowledgedAt) : '—'}</td>
                      <td>{ack.notes ? formatPrintText(ack.notes) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PrintSection>
        )}
      </div>
    </article>
  )
}
