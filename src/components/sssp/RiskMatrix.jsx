import {
  LIKELIHOOD_LABELS,
  CONSEQUENCE_LABELS,
  RISK_MATRIX_DISCLAIMER,
  buildMatrixCells,
  getRiskBandClass,
} from '../../constants/ssspRiskMatrix.js'

export function RiskMatrix({ compact = false }) {
  const cells = buildMatrixCells()

  return (
    <div className={`sssp-risk-matrix${compact ? ' sssp-risk-matrix--compact' : ''}`}>
      <div className="sssp-risk-matrix__grid" role="grid" aria-label="5 by 5 risk matrix">
        <div className="sssp-risk-matrix__corner" aria-hidden="true" />
        {CONSEQUENCE_LABELS.map((c) => (
          <div key={c.value} className="sssp-risk-matrix__header-col" role="columnheader">
            {compact ? c.short : c.label}
          </div>
        ))}
        {LIKELIHOOD_LABELS.slice()
          .reverse()
          .map((l) => (
            <div key={l.value} className="sssp-risk-matrix__row">
              <div className="sssp-risk-matrix__header-row" role="rowheader">
                {compact ? l.short : l.label}
              </div>
              {CONSEQUENCE_LABELS.map((c) => {
                const cell = cells.find(
                  (item) => item.likelihood === l.value && item.consequence === c.value,
                )
                const bandClass = getRiskBandClass(cell?.score)
                return (
                  <div
                    key={`${l.value}-${c.value}`}
                    className={`sssp-risk-matrix__cell sssp-risk-matrix__cell--${bandClass}`}
                    role="gridcell"
                    title={`${l.label} × ${c.label} = ${cell?.score}`}
                  >
                    {cell?.score}
                  </div>
                )
              })}
            </div>
          ))}
      </div>
      <div className="sssp-risk-matrix__legend">
        <span className="sssp-risk-matrix__legend-item sssp-risk-matrix__legend-item--low">Low (1–4)</span>
        <span className="sssp-risk-matrix__legend-item sssp-risk-matrix__legend-item--medium">Medium (5–9)</span>
        <span className="sssp-risk-matrix__legend-item sssp-risk-matrix__legend-item--high">High (10–16)</span>
        <span className="sssp-risk-matrix__legend-item sssp-risk-matrix__legend-item--extreme">Extreme (17–25)</span>
      </div>
      {!compact && <p className="sssp-risk-matrix__disclaimer">{RISK_MATRIX_DISCLAIMER}</p>}
    </div>
  )
}
