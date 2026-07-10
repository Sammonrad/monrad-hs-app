export function scrollToFirstInvalid(errors) {
  const firstKey = Object.keys(errors).find((key) => errors[key])
  if (!firstKey) return

  const el =
    document.querySelector(`[data-field-id="${firstKey}"]`) ||
    document.querySelector(`[name="${firstKey}"]`) ||
    document.getElementById(firstKey)

  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const focusable = el.querySelector('input, select, textarea, button')
    if (focusable && typeof focusable.focus === 'function') {
      focusable.focus({ preventScroll: true })
    }
  }
}

export function hasValidationErrors(errors) {
  return Object.values(errors).some(Boolean)
}

export function getValidationSummary(errors) {
  return Object.values(errors).filter(Boolean)
}
