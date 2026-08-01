import { MonradLogo } from '../MonradLogo.jsx'

/**
 * Compact shared print branding header.
 * Black on white; no app chrome. Keep weekly timesheet landscape layout intact.
 */
export function PrintHeader({ title, meta, subtitle }) {
  return (
    <header className="print-header print-record__header">
      <MonradLogo variant="print" />
      <p className="print-header__company print-record__company">Monrad Earthworx</p>
      <h1 className="print-header__title print-record__title">{title}</h1>
      {subtitle ? <p className="print-header__subtitle">{subtitle}</p> : null}
      {meta ? <p className="print-header__meta print-record__meta">{meta}</p> : null}
    </header>
  )
}
