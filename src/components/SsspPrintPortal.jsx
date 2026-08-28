import { useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { PrintableSSSP } from './PrintableSSSP.jsx'

/**
 * Renders PrintableSSSP at document.body and triggers print after mount.
 * Portal avoids page-container max-width / centering so print CSS always targets the template.
 */
export function SsspPrintPortal({ record, includeAcknowledgements = false, onDone }) {
  useLayoutEffect(() => {
    if (!record) return undefined

    const printClass = 'sssp-print-mode'
    document.body.classList.add(printClass)

    let cancelled = false
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) window.print()
      })
    })

    const handleAfterPrint = () => {
      document.body.classList.remove(printClass)
      onDone?.()
    }
    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
      document.body.classList.remove(printClass)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [record, onDone])

  if (!record) return null

  return createPortal(
    <div className="print-area print-area--sssp" aria-hidden="true">
      <PrintableSSSP record={record} includeAcknowledgements={includeAcknowledgements} />
    </div>,
    document.body,
  )
}
