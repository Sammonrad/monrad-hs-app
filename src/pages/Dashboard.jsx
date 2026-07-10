import { useMemo, useState } from 'react'
import {
  BriefcaseBusiness,
  ClipboardCheck,
  ClipboardSignature,
  Clock,
  ShieldCheck,
  HelpCircle,
  OctagonAlert,
  ShieldAlert,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import { DASHBOARD_GROUPS, DASHBOARD_CARDS } from '../constants/index.js'
import { MonradLogo } from '../components/MonradLogo.jsx'
import { SideMenu } from '../components/SideMenu.jsx'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import {
  formatDashboardDate,
  getDashboardOverview,
  getFirstName,
  getTimeGreeting,
} from '../utils/dashboardOverview.js'
import { getMergedVisitorRecords } from '../utils/storage/visitorSignInCloudStorage.js'
import { countVisitorsOnSite } from '../utils/storage/visitorSignInStorage.js'
import { countSsspByStatus } from '../utils/storage/ssspStorage.js'

const CARD_ICONS = {
  'job-start': ClipboardCheck,
  'pre-start': Wrench,
  toolbox: BriefcaseBusiness,
  incident: TriangleAlert,
  'critical-risks': OctagonAlert,
  'visitor-sign-in': ClipboardSignature,
  sssp: ShieldCheck,
  timesheet: Clock,
  'safety-alerts': ShieldAlert,
  'help-app-setup': HelpCircle,
}

function getDashboardCardClass(card) {
  const classes = ['dashboard-card']
  if (card.fullWidth) classes.push('dashboard-card--full-width')
  switch (card.id) {
    case 'safety-alerts':
      classes.push('dashboard-card--alerts')
      break
    case 'help-app-setup':
      classes.push('dashboard-card--help')
      break
    case 'critical-risks':
      classes.push('dashboard-card--critical-risks')
      break
    case 'visitor-sign-in':
      classes.push('dashboard-card--visitor-sign-in')
      break
    case 'sssp':
      classes.push('dashboard-card--sssp')
      break
    default:
      break
  }
  return classes.join(' ')
}

function OverviewStat({ label, value, variant }) {
  return (
    <div className={`dashboard-overview__stat${variant ? ` dashboard-overview__stat--${variant}` : ''}`}>
      <span className="dashboard-overview__stat-value">{value}</span>
      <span className="dashboard-overview__stat-label">{label}</span>
    </div>
  )
}

export function Dashboard({
  onNavigate,
  recordCount,
  openActionCount,
  profile,
  userEmail,
  actions,
  savedRecords,
  cloudJobStarts,
  cloudPreStarts,
  cloudTimesheets,
  visitorRecords,
  cloudVisitorRecords,
  cloudSsspRecords,
  ssspLoading,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isAdmin = isAdminProfile(profile)

  const cardsById = useMemo(
    () =>
      Object.fromEntries(
        DASHBOARD_CARDS.filter((card) => card.placement === 'mainDashboard')
          .filter((card) => !card.adminOnly || isAdmin)
          .map((card) => [card.id, card]),
      ),
    [isAdmin],
  )

  const overview = useMemo(
    () =>
      getDashboardOverview({
        savedRecords,
        actions,
        cloudJobStarts,
        cloudPreStarts,
        cloudTimesheets,
      }),
    [savedRecords, actions, cloudJobStarts, cloudPreStarts, cloudTimesheets],
  )

  const visitorsOnSiteCount = useMemo(() => {
    const merged = getMergedVisitorRecords(visitorRecords, cloudVisitorRecords)
    return countVisitorsOnSite(merged)
  }, [visitorRecords, cloudVisitorRecords])

  const ssspCounts = useMemo(
    () => countSsspByStatus(cloudSsspRecords),
    [cloudSsspRecords],
  )

  const firstName = getFirstName(profile, userEmail)
  const greeting = getTimeGreeting()
  const greetingLine = firstName ? `${greeting}, ${firstName}` : greeting

  const warnings = []
  if (overview.overdueActions > 0) {
    warnings.push({
      id: 'overdue',
      text: `${overview.overdueActions} overdue action${overview.overdueActions === 1 ? '' : 's'}`,
      severity: 'critical',
    })
  }
  if (overview.criticalActions > 0) {
    warnings.push({
      id: 'critical',
      text: `${overview.criticalActions} critical action${overview.criticalActions === 1 ? '' : 's'}`,
      severity: 'critical',
    })
  }
  if (overview.preStartsToday === 0) {
    warnings.push({
      id: 'no-prestart',
      text: 'No machine pre-start recorded today.',
      severity: 'subtle',
    })
  }
  if (overview.timesheetsToday === 0) {
    warnings.push({
      id: 'no-timesheet',
      text: 'No timesheet recorded today.',
      severity: 'subtle',
    })
  }

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div className="dashboard__header-bar">
          <button
            type="button"
            className="dashboard__menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="app-side-menu"
          >
            <span className="dashboard__menu-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>

          <div className="dashboard__header-brand">
            <MonradLogo variant="header" />
            <p className="dashboard__tagline">Health &amp; Safety App</p>
          </div>

          <div className="dashboard__header-spacer" aria-hidden="true" />
        </div>
      </header>

      <section className="dashboard-greeting" aria-label="Greeting">
        <h2 className="dashboard-greeting__title">{greetingLine}</h2>
        <p className="dashboard-greeting__date">{formatDashboardDate()}</p>
      </section>

      <SideMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={onNavigate}
        profile={profile}
        openActionCount={openActionCount}
      />

      <nav className="dashboard__nav" aria-label="Form types">
        {DASHBOARD_GROUPS.map((group) => {
          const visibleCards = group.cardIds.map((cardId) => cardsById[cardId]).filter(Boolean)

          if (visibleCards.length === 0) return null

          return (
            <div key={group.id} className="dashboard-group-block">
              <section className="dashboard-group" aria-labelledby={`group-${group.id}`}>
                <h2 id={`group-${group.id}`} className="dashboard-group__title">
                  {group.title}
                </h2>
                <div className="dashboard-group__grid">
                  {visibleCards.map((card) => {
                    const Icon = CARD_ICONS[card.id]
                    const showAlertBadge =
                      card.id === 'safety-alerts' && overview.safetyAlertCount > 0
                    const showVisitorBadge =
                      card.id === 'visitor-sign-in' && visitorsOnSiteCount > 0
                    const showSsspStatus =
                      card.id === 'sssp' && !ssspLoading

                    return (
                      <button
                        key={card.id}
                        type="button"
                        className={getDashboardCardClass(card)}
                        onClick={() => onNavigate(card.id)}
                      >
                        {Icon ? (
                          <Icon
                            className="dashboard-card__icon"
                            size={18}
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="dashboard-card__title">{card.title}</span>
                        {card.subtitle && (
                          <span className="dashboard-card__subtitle">{card.subtitle}</span>
                        )}
                        {showSsspStatus && (
                          <span className="dashboard-card__sssp-status">
                            {ssspCounts.active} active
                            {ssspCounts.awaitingReview > 0
                              ? ` · ${ssspCounts.awaitingReview} awaiting review`
                              : ''}
                          </span>
                        )}
                        {showAlertBadge ? (
                          <span className="dashboard-card__count" aria-label={`${overview.safetyAlertCount} alerts`}>
                            {overview.safetyAlertCount}
                          </span>
                        ) : null}
                        {showVisitorBadge ? (
                          <span
                            className="dashboard-card__visitor-badge"
                            aria-label={`${visitorsOnSiteCount} visitor${visitorsOnSiteCount === 1 ? '' : 's'} currently on site`}
                          >
                            {visitorsOnSiteCount} visitor{visitorsOnSiteCount === 1 ? '' : 's'} on site
                          </span>
                        ) : null}
                        {!card.available && (
                          <span className="dashboard-card__badge">Coming soon</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>
          )
        })}
      </nav>

      <section className="dashboard-overview" aria-label="Today's site safety overview">
        <h2 className="dashboard-overview__title">Today&apos;s site safety overview</h2>
        <div className="dashboard-overview__stats">
          <OverviewStat label="Open actions" value={overview.openActions} />
          <OverviewStat
            label="Overdue"
            value={overview.overdueActions}
            variant={overview.overdueActions > 0 ? 'alert' : undefined}
          />
          <OverviewStat
            label="Critical"
            value={overview.criticalActions}
            variant={overview.criticalActions > 0 ? 'alert' : undefined}
          />
          <OverviewStat label="Incident follow-up" value={overview.incidentFollowUp} />
          <OverviewStat label="Timesheets today" value={overview.timesheetsToday} />
          <OverviewStat label="Job starts today" value={overview.jobStartsToday} />
          <OverviewStat label="Pre-starts today" value={overview.preStartsToday} />
        </div>

        {warnings.length > 0 && (
          <ul className="dashboard-overview__warnings" aria-label="Warnings">
            {warnings.map((warning) => (
              <li
                key={warning.id}
                className={`dashboard-overview__warning dashboard-overview__warning--${warning.severity}`}
              >
                {warning.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      {recordCount > 0 && (
        <p className="dashboard__records-hint">
          {recordCount} saved record{recordCount === 1 ? '' : 's'} on this device
        </p>
      )}

      <p className="dashboard__cloud-note">Cloud records are linked to the signed-in user.</p>
    </div>
  )
}
