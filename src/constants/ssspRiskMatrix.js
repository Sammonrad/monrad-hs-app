export const LIKELIHOOD_LABELS = [
  { value: 1, label: 'Rare', short: 'R' },
  { value: 2, label: 'Unlikely', short: 'U' },
  { value: 3, label: 'Possible', short: 'P' },
  { value: 4, label: 'Likely', short: 'L' },
  { value: 5, label: 'Almost Certain', short: 'AC' },
]

export const CONSEQUENCE_LABELS = [
  { value: 1, label: 'Insignificant', short: '1' },
  { value: 2, label: 'Minor', short: '2' },
  { value: 3, label: 'Moderate', short: '3' },
  { value: 4, label: 'Major', short: '4' },
  { value: 5, label: 'Catastrophic', short: '5' },
]

export const RISK_BANDS = [
  { min: 1, max: 4, label: 'Low', className: 'low' },
  { min: 5, max: 9, label: 'Medium', className: 'medium' },
  { min: 10, max: 16, label: 'High', className: 'high' },
  { min: 17, max: 25, label: 'Extreme', className: 'extreme' },
]

export const CONTROL_HIERARCHY = [
  { id: 'elimination', label: 'Elimination' },
  { id: 'substitution', label: 'Substitution' },
  { id: 'engineering', label: 'Engineering controls' },
  { id: 'administrative', label: 'Administrative controls' },
  { id: 'ppe', label: 'PPE' },
]

export const RISK_MATRIX_DISCLAIMER =
  'Risk ratings are indicative and must be reviewed by a competent person. Residual risk must be as low as reasonably practicable (ALARP). High and extreme residual risks require documented justification and additional controls.'

export function calculateRiskScore(likelihood, consequence) {
  const l = Number(likelihood)
  const c = Number(consequence)
  if (!l || !c || l < 1 || l > 5 || c < 1 || c > 5) return null
  return l * c
}

export function getRiskBand(score) {
  if (score == null || score < 1) return null
  return RISK_BANDS.find((band) => score >= band.min && score <= band.max) ?? null
}

export function getRiskBandClass(score) {
  return getRiskBand(score)?.className ?? 'unknown'
}

export function getRiskBandLabel(score) {
  return getRiskBand(score)?.label ?? '—'
}

export function isHighOrExtremeRisk(score) {
  const band = getRiskBand(score)
  return band?.className === 'high' || band?.className === 'extreme'
}

export function buildMatrixCells() {
  const cells = []
  for (let l = 5; l >= 1; l -= 1) {
    for (let c = 1; c <= 5; c += 1) {
      const score = l * c
      cells.push({ likelihood: l, consequence: c, score, band: getRiskBand(score) })
    }
  }
  return cells
}
