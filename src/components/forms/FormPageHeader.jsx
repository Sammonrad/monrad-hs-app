import { formatDashboardDate } from '../../utils/dashboardOverview.js'

export function FormPageHeader({ title, subtitle, progress, hideMobileChrome = true }) {
  return (
    <header
      className={`header no-print form-page-header${hideMobileChrome ? ' form-page-header--mobile-compact' : ''}`}
    >
      <p className="company form-page-header__company">Monrad Earthworx</p>
      <h1 className="title form-page-header__title">{title}</h1>
      {subtitle && <p className="form-page-header__subtitle">{subtitle}</p>}
      {progress && (
        <p className="progress" aria-live="polite">
          {progress}
        </p>
      )}
      <p className="form-page-header__date">{formatDashboardDate()}</p>
    </header>
  )
}
