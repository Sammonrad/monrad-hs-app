export function NavGroupList({
  groups,
  currentView,
  onNavigate,
  openActionCount = 0,
  variant = 'sidebar',
  collapsed = false,
}) {
  const itemClass =
    variant === 'sidebar' ? 'desktop-sidebar__item' : 'side-menu__item'
  const activeClass =
    variant === 'sidebar'
      ? 'desktop-sidebar__item--active'
      : 'side-menu__item--active'
  const labelClass =
    variant === 'sidebar' ? 'desktop-sidebar__item-label' : 'side-menu__item-label'
  const badgeClass =
    variant === 'sidebar' ? 'desktop-sidebar__badge' : 'side-menu__badge'
  const groupClass =
    variant === 'sidebar' ? 'desktop-sidebar__group' : 'side-menu__group'
  const groupTitleClass =
    variant === 'sidebar' ? 'desktop-sidebar__group-title' : 'side-menu__group-title'
  const listClass =
    variant === 'sidebar' ? 'desktop-sidebar__list' : 'side-menu__list'

  return (
    <>
      {groups.map((group) => (
        <section
          key={group.id}
          className={groupClass}
          aria-labelledby={`nav-group-${variant}-${group.id}`}
        >
          {!collapsed && (
            <h3 id={`nav-group-${variant}-${group.id}`} className={groupTitleClass}>
              {group.title}
            </h3>
          )}
          <ul className={listClass}>
            {group.items.map((item) => {
              const isActive = currentView === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`${itemClass}${isActive ? ` ${activeClass}` : ''}`}
                    onClick={() => onNavigate(item.id)}
                    title={collapsed ? item.title : undefined}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className={labelClass}>{item.title}</span>
                    {!collapsed &&
                      item.id === 'action-register' &&
                      openActionCount > 0 && (
                        <span className={badgeClass}>{openActionCount} open</span>
                      )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}
