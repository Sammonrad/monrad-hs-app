import { useEffect } from 'react'

export function useHighlightAction(highlightActionId, onClearHighlight, deps = []) {
  useEffect(() => {
    if (!highlightActionId) return undefined

    const timer = window.setTimeout(() => {
      const el = document.querySelector(`[data-action-id="${highlightActionId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('action-card--highlight')
        window.setTimeout(() => {
          el.classList.remove('action-card--highlight')
          onClearHighlight?.()
        }, 2500)
      } else {
        onClearHighlight?.()
      }
    }, 350)

    return () => window.clearTimeout(timer)
  }, [highlightActionId, onClearHighlight, ...deps])
}
