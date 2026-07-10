import { formatDashboardDate } from '../../utils/dashboardOverview.js'

export function PageHeader({ title, description, date, className = '' }) {
  if (!title) return null

  return (
    <header className={`page-header ${className}`.trim()} aria-labelledby="page-header-title">
      <div className="page-header__content">
        <h1 id="page-header-title" className="page-header__title">
          {title}
        </h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {date !== false && (
        <p className="page-header__date">{date ?? formatDashboardDate()}</p>
      )}
    </header>
  )
}
