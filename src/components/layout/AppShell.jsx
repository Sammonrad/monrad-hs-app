import { useMemo, useState } from 'react'
import { SideMenu } from '../SideMenu.jsx'
import { isAdminProfile } from '../../utils/storage/userProfileStorage.js'
import { FORM_VIEW_IDS, getPageMeta } from '../../constants/navigation.js'
import { APP_VERSION } from '../../constants/index.js'
import { DesktopSidebar } from './DesktopSidebar.jsx'
import { MobileHeader } from './MobileHeader.jsx'
import { PageContainer } from './PageContainer.jsx'
import { PageHeader } from './PageHeader.jsx'

export function AppShell({
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
  children,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isAdmin = isAdminProfile(profile)
  const pageMeta = useMemo(() => getPageMeta(currentView), [currentView])

  const containerVariant = FORM_VIEW_IDS.has(currentView) ? 'form' : 'default'

  function handleNavigate(viewId) {
    onNavigate(viewId)
    setMenuOpen(false)
  }

  return (
    <div className="app-shell">
      <div className="app-shell__layout">
        <DesktopSidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          profile={profile}
          userEmail={userEmail}
          roleLabel={roleLabel}
          statusLabel={statusLabel}
          profileStatus={profileStatus}
          onSignOut={onSignOut}
          authLoading={authLoading}
          openActionCount={openActionCount}
          isAdmin={isAdmin}
        />

        <div className="app-shell__main">
          <MobileHeader
            onMenuOpen={() => setMenuOpen(true)}
            menuOpen={menuOpen}
            pageTitle={currentView !== 'dashboard' ? pageMeta.title : null}
          />

          {!pageMeta.hideHeader && (
            <PageHeader
              title={pageMeta.title}
              description={pageMeta.description}
              className="page-header--desktop"
            />
          )}

          <PageContainer variant={containerVariant} className="app-shell__content">
            {children}
          </PageContainer>

          <footer className="app-footer app-footer--mobile no-print" aria-label="Account">
            <div className="app-footer__account">
              <div className="app-footer__details">
                {userEmail && (
                  <p className="app-footer__email" title={userEmail}>
                    {userEmail}
                  </p>
                )}
                {(roleLabel || statusLabel) && (
                  <div className="app-footer__badges">
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
              </div>
              <button
                type="button"
                className="app-footer__sign-out"
                onClick={onSignOut}
                disabled={authLoading}
              >
                {authLoading ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
            <p className="app-version">Monrad Earthworx H&amp;S v{APP_VERSION}</p>
          </footer>
        </div>
      </div>

      <SideMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={handleNavigate}
        profile={profile}
        openActionCount={openActionCount}
        currentView={currentView}
      />
    </div>
  )
}
