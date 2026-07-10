import { useMemo, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { MonradLogo } from '../MonradLogo.jsx'
import { APP_VERSION } from '../../constants/index.js'
import { DESKTOP_SIDEBAR_GROUPS, getNavGroups } from '../../constants/navigation.js'
import { NavGroupList } from './NavGroupList.jsx'

export function DesktopSidebar({
  currentView,
  onNavigate,
  profile,
  userEmail,
  roleLabel,
  statusLabel,
  profileStatus,
  onSignOut,
  authLoading,
  openActionCount = 0,
  isAdmin,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const groups = useMemo(
    () => getNavGroups(isAdmin, DESKTOP_SIDEBAR_GROUPS),
    [isAdmin],
  )

  return (
    <aside
      className={`desktop-sidebar${collapsed ? ' desktop-sidebar--collapsed' : ''}`}
      aria-label="Main navigation"
    >
      <div className="desktop-sidebar__brand">
        <MonradLogo variant="header" />
        {!collapsed && (
          <p className="desktop-sidebar__tagline">Health &amp; Safety</p>
        )}
      </div>

      <nav className="desktop-sidebar__nav" aria-label="Application sections">
        <NavGroupList
          groups={groups}
          currentView={currentView}
          onNavigate={onNavigate}
          openActionCount={openActionCount}
          variant="sidebar"
          collapsed={collapsed}
        />
      </nav>

      <div className="desktop-sidebar__footer">
        <button
          type="button"
          className="desktop-sidebar__collapse-btn"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={18} aria-hidden="true" />
          )}
        </button>

        <div className="desktop-sidebar__account">
          {!collapsed && userEmail && (
            <p className="desktop-sidebar__email" title={userEmail}>
              {userEmail}
            </p>
          )}
          {!collapsed && (roleLabel || statusLabel) && (
            <div className="desktop-sidebar__badges">
              {roleLabel && (
                <span
                  className={`type-badge type-badge--footer type-badge--role-${profile?.role ?? 'staff'}`}
                >
                  {roleLabel}
                </span>
              )}
              {statusLabel && (
                <span
                  className={`profile-status profile-status--${profileStatus} profile-status--footer`}
                >
                  {statusLabel}
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            className="desktop-sidebar__sign-out"
            onClick={onSignOut}
            disabled={authLoading}
          >
            {authLoading ? 'Signing out…' : 'Sign out'}
          </button>
        </div>

        {!collapsed && (
          <p className="desktop-sidebar__version">v{APP_VERSION}</p>
        )}
      </div>
    </aside>
  )
}
