import { FormField } from '../forms/FormField.jsx'
import { SsspInput, SsspTextarea } from './SsspFields.jsx'
import {
  LIKELIHOOD_LABELS,
  CONSEQUENCE_LABELS,
  CONTROL_HIERARCHY,
  calculateRiskScore,
  getRiskBandLabel,
  isHighOrExtremeRisk,
} from '../../constants/ssspRiskMatrix.js'
import { CRITICAL_RISK_CATEGORIES } from '../../constants/criticalRisks.js'
import { SSSP_HAZARD_LIBRARY } from '../../constants/ssspHazardLibrary.js'
import { createEmptyHazard, normalizeHazard } from '../../utils/storage/ssspStorage.js'
import { createRecordId } from '../../utils/ids.js'

function RiskScoreBadge({ score }) {
  if (score == null) return <span className="sssp-risk-badge sssp-risk-badge--unknown">—</span>
  const band = getRiskBandLabel(score).toLowerCase()
  return (
    <span className={`sssp-risk-badge sssp-risk-badge--${band}`}>
      {score} ({getRiskBandLabel(score)})
    </span>
  )
}

function LikelihoodConsequenceSelect({ label, value, options, onChange, disabled }) {
  return (
    <FormField label={label}>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.value} — {opt.label}
          </option>
        ))}
      </select>
    </FormField>
  )
}

export function RiskRegister({
  hazards,
  onChange,
  readOnly = false,
  onNavigateCriticalRisks,
}) {
  const activeHazards = (hazards ?? []).filter((h) => !h.archived)

  function updateHazard(id, patch) {
    const next = (hazards ?? []).map((h) => {
      if (h.id !== id) return h
      const updated = normalizeHazard({ ...h, ...patch })
      updated.initialRisk = calculateRiskScore(updated.initialLikelihood, updated.initialConsequence)
      updated.residualRisk = calculateRiskScore(
        updated.residualLikelihood,
        updated.residualConsequence,
      )
      return updated
    })
    onChange(next)
  }

  function addHazard(source) {
    const base = source ? { ...createEmptyHazard(), ...source } : createEmptyHazard()
    if (source?.initialLikelihood) {
      base.initialRisk = calculateRiskScore(source.initialLikelihood, source.initialConsequence)
    }
    if (source?.residualLikelihood) {
      base.residualRisk = calculateRiskScore(source.residualLikelihood, source.residualConsequence)
    } else if (base.initialLikelihood) {
      base.residualLikelihood = source?.initialLikelihood ?? ''
      base.residualConsequence = source?.initialConsequence ?? ''
      base.residualRisk = base.initialRisk
    }
    base.sortOrder = activeHazards.length
    onChange([...(hazards ?? []), normalizeHazard(base)])
  }

  function duplicateHazard(hazard) {
    addHazard({
      ...hazard,
      id: createRecordId(),
      activity: `${hazard.activity} (copy)`.trim(),
    })
  }

  function archiveHazard(id) {
    onChange((hazards ?? []).map((h) => (h.id === id ? { ...h, archived: true } : h)))
  }

  function moveHazard(id, direction) {
    const active = activeHazards.map((h) => h.id)
    const index = active.indexOf(id)
    if (index < 0) return
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= active.length) return

    const reordered = [...active]
    ;[reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]]

    const orderMap = Object.fromEntries(reordered.map((hid, i) => [hid, i]))
    onChange(
      (hazards ?? []).map((h) =>
        orderMap[h.id] != null ? { ...h, sortOrder: orderMap[h.id] } : h,
      ),
    )
  }

  return (
    <div className="sssp-risk-register">
      {!readOnly && (
        <div className="sssp-risk-register__toolbar">
          <button type="button" className="btn btn--secondary" onClick={() => addHazard()}>
            Add Custom Hazard
          </button>
          <details className="sssp-risk-register__template-menu">
            <summary className="btn btn--secondary">Add from Hazard Library</summary>
            <ul className="sssp-risk-register__template-list">
              {SSSP_HAZARD_LIBRARY.map((template) => (
                <li key={template.id}>
                  <button type="button" onClick={() => addHazard({ ...template, templateId: template.id })}>
                    {template.activity} — {template.hazard}
                  </button>
                </li>
              ))}
            </ul>
          </details>
          <details className="sssp-risk-register__template-menu">
            <summary className="btn btn--secondary">Add from Critical Risks</summary>
            <ul className="sssp-risk-register__template-list">
              {CRITICAL_RISK_CATEGORIES.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() =>
                      addHazard({
                        activity: cat.title,
                        hazard: cat.title,
                        potentialHarm: cat.stopWork?.[0] ?? '',
                        controls: cat.controls?.join('; ') ?? '',
                        criticalRiskId: cat.id,
                        templateId: `critical-${cat.id}`,
                      })
                    }
                  >
                    {cat.title}
                  </button>
                </li>
              ))}
            </ul>
          </details>
          {onNavigateCriticalRisks && (
            <button type="button" className="btn btn--link" onClick={onNavigateCriticalRisks}>
              View Critical Risks reference
            </button>
          )}
        </div>
      )}

      {activeHazards.length === 0 && (
        <p className="sssp-risk-register__empty">No hazards in the risk register yet.</p>
      )}

      <div className="sssp-risk-register__desktop">
        <table className="sssp-risk-register__table">
          <thead>
            <tr>
              <th>Activity</th>
              <th>Hazard</th>
              <th>Initial</th>
              <th>Controls</th>
              <th>Residual</th>
              {!readOnly && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {activeHazards.map((hazard, index) => (
              <tr key={hazard.id}>
                <td>{readOnly ? hazard.activity : (
                  <SsspInput value={hazard.activity} onChange={(v) => updateHazard(hazard.id, { activity: v })} />
                )}</td>
                <td>{readOnly ? hazard.hazard : (
                  <SsspInput value={hazard.hazard} onChange={(v) => updateHazard(hazard.id, { hazard: v })} />
                )}</td>
                <td><RiskScoreBadge score={hazard.initialRisk} /></td>
                <td>{readOnly ? hazard.controls : (
                  <SsspTextarea value={hazard.controls} onChange={(v) => updateHazard(hazard.id, { controls: v })} rows={2} />
                )}</td>
                <td><RiskScoreBadge score={hazard.residualRisk} /></td>
                {!readOnly && (
                  <td className="sssp-risk-register__row-actions">
                    <button type="button" onClick={() => moveHazard(hazard.id, 'up')} disabled={index === 0}>↑</button>
                    <button type="button" onClick={() => moveHazard(hazard.id, 'down')} disabled={index === activeHazards.length - 1}>↓</button>
                    <button type="button" onClick={() => duplicateHazard(hazard)}>Dup</button>
                    <button type="button" onClick={() => archiveHazard(hazard.id)}>Archive</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sssp-risk-register__mobile">
        {activeHazards.map((hazard, index) => (
          <article key={hazard.id} className="sssp-risk-register__card">
            <header className="sssp-risk-register__card-header">
              <h4>Hazard {index + 1}</h4>
              {!readOnly && (
                <div className="sssp-risk-register__row-actions">
                  <button type="button" onClick={() => moveHazard(hazard.id, 'up')} disabled={index === 0}>↑</button>
                  <button type="button" onClick={() => moveHazard(hazard.id, 'down')} disabled={index === activeHazards.length - 1}>↓</button>
                  <button type="button" onClick={() => duplicateHazard(hazard)}>Duplicate</button>
                  <button type="button" onClick={() => archiveHazard(hazard.id)}>Archive</button>
                </div>
              )}
            </header>

            {readOnly ? (
              <>
                <p><strong>Activity:</strong> {hazard.activity}</p>
                <p><strong>Hazard:</strong> {hazard.hazard}</p>
                <p><strong>Potential harm:</strong> {hazard.potentialHarm || '—'}</p>
                <p><strong>Initial risk:</strong> <RiskScoreBadge score={hazard.initialRisk} /></p>
                <p><strong>Controls:</strong> {hazard.controls}</p>
                <p><strong>Residual risk:</strong> <RiskScoreBadge score={hazard.residualRisk} /></p>
              </>
            ) : (
              <>
                <FormField label="Activity" required>
                  <SsspInput value={hazard.activity} onChange={(v) => updateHazard(hazard.id, { activity: v })} />
                </FormField>
                <FormField label="Hazard" required>
                  <SsspInput value={hazard.hazard} onChange={(v) => updateHazard(hazard.id, { hazard: v })} />
                </FormField>
                <FormField label="Potential harm">
                  <SsspTextarea value={hazard.potentialHarm} onChange={(v) => updateHazard(hazard.id, { potentialHarm: v })} rows={2} />
                </FormField>
                <div className="sssp-risk-register__scores">
                  <LikelihoodConsequenceSelect
                    label="Initial likelihood"
                    value={hazard.initialLikelihood}
                    options={LIKELIHOOD_LABELS}
                    onChange={(v) => updateHazard(hazard.id, { initialLikelihood: v })}
                  />
                  <LikelihoodConsequenceSelect
                    label="Initial consequence"
                    value={hazard.initialConsequence}
                    options={CONSEQUENCE_LABELS}
                    onChange={(v) => updateHazard(hazard.id, { initialConsequence: v })}
                  />
                  <div className="sssp-risk-register__score-display">
                    <span className="form-field__label">Initial risk</span>
                    <RiskScoreBadge score={hazard.initialRisk} />
                  </div>
                </div>
                <FormField label="Controls" required>
                  <SsspTextarea value={hazard.controls} onChange={(v) => updateHazard(hazard.id, { controls: v })} rows={3} />
                </FormField>
                <FormField label="Control hierarchy">
                  <select
                    value={hazard.controlHierarchy ?? ''}
                    onChange={(e) => updateHazard(hazard.id, { controlHierarchy: e.target.value })}
                  >
                    <option value="">—</option>
                    {CONTROL_HIERARCHY.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </FormField>
                <div className="sssp-risk-register__scores">
                  <LikelihoodConsequenceSelect
                    label="Residual likelihood"
                    value={hazard.residualLikelihood}
                    options={LIKELIHOOD_LABELS}
                    onChange={(v) => updateHazard(hazard.id, { residualLikelihood: v })}
                  />
                  <LikelihoodConsequenceSelect
                    label="Residual consequence"
                    value={hazard.residualConsequence}
                    options={CONSEQUENCE_LABELS}
                    onChange={(v) => updateHazard(hazard.id, { residualConsequence: v })}
                  />
                  <div className="sssp-risk-register__score-display">
                    <span className="form-field__label">Residual risk</span>
                    <RiskScoreBadge score={hazard.residualRisk} />
                  </div>
                </div>
                {hazard.criticalRiskId && (
                  <p className="sssp-risk-register__critical-warning">
                    Linked to critical risk category — ensure stop-work triggers are understood.
                  </p>
                )}
                {isHighOrExtremeRisk(hazard.residualRisk) && (
                  <FormField label="High/extreme residual risk — explanation required" required>
                    <SsspTextarea
                      value={hazard.residualRiskExplanation}
                      onChange={(v) => updateHazard(hazard.id, { residualRiskExplanation: v })}
                      rows={2}
                    />
                  </FormField>
                )}
              </>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
