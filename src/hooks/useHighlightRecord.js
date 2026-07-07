import { useEffect } from 'react'

export function useHighlightRecord(highlightRecordId, onClearHighlight, deps = []) {
  useEffect(() => {
    if (!highlightRecordId) return undefined

    const timer = window.setTimeout(() => {
      const el = document.querySelector(`[data-record-id="${highlightRecordId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('saved-record--highlight')
        window.setTimeout(() => {
          el.classList.remove('saved-record--highlight')
          onClearHighlight?.()
        }, 2500)
      } else {
        onClearHighlight?.()
      }
    }, 350)

    return () => window.clearTimeout(timer)
  }, [highlightRecordId, onClearHighlight, ...deps])
}
