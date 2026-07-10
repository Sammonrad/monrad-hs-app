import { useEffect, useMemo } from 'react'
import { DESKTOP_SIDEBAR_GROUPS, getNavGroups } from '../constants/navigation.js'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import { NavGroupList } from './layout/NavGroupList.jsx'

export function SideMenu({
  isOpen,
  onClose,
  onNavigate,
  profile,
  openActionCount = 0,
  currentView = null,
}) {
  const isAdmin = isAdminProfile(profile)
  const groups = useMemo(
    () => getNavGroups(isAdmin, DESKTOP_SIDEBAR_GROUPS),
    [isAdmin],
  )

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  function handleNavigate(viewId) {
    onNavigate(viewId)
    onClose()
  }

  return (
    <>
      <div
        className={`side-menu__overlay${isOpen ? ' side-menu__overlay--visible' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
        tabIndex={-1}
      />

      <aside
        id="app-side-menu"
        className={`side-menu${isOpen ? ' side-menu--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!isOpen}
      >
        <div className="side-menu__header">
          <h2 className="side-menu__title">Menu</h2>
          <button
            type="button"
            className="side-menu__close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <nav className="side-menu__nav" aria-label="Application navigation">
          <NavGroupList
            groups={groups}
            currentView={currentView}
            onNavigate={handleNavigate}
            openActionCount={openActionCount}
            variant="drawer"
          />
        </nav>
      </aside>
    </>
  )
}
