export function ResponsiveGrid({
  children,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  className = '',
  as: Component = 'div',
}) {
  const style = {
    '--grid-cols-mobile': columns.mobile ?? 1,
    '--grid-cols-tablet': columns.tablet ?? columns.mobile ?? 2,
    '--grid-cols-desktop': columns.desktop ?? columns.tablet ?? 3,
  }

  return (
    <Component className={`responsive-grid ${className}`.trim()} style={style}>
      {children}
    </Component>
  )
}
