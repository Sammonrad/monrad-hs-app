import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Mobile-first collapsible filter panel.
 * Search / primary controls stay outside; secondary filters go in children.
 * Closing does not reset filter values. Children render once (no duplicate IDs).
 */
export function FilterDisclosure({
  activeCount = 0,
  onReset,
  resetLabel = 'Reset',
  label = 'Filters',
  defaultOpen = false,
  children,
  className = '',
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div className={`filter-disclosure ${className}`.trim()}>
      <div className="filter-disclosure__bar">
        <button
          type="button"
          className={`filter-disclosure__toggle${open ? ' filter-disclosure__toggle--open' : ''}${
            activeCount > 0 ? ' filter-disclosure__toggle--active' : ''
          }`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span>
            {label}
            {activeCount > 0 ? ` (${activeCount})` : ''}
          </span>
          <ChevronDown
            className="filter-disclosure__chevron"
            size={18}
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>
        {onReset && activeCount > 0 ? (
          <button type="button" className="filter-disclosure__reset" onClick={onReset}>
            {resetLabel}
          </button>
        ) : null}
      </div>
      <div
        id={panelId}
        className={`filter-disclosure__panel${open ? ' filter-disclosure__panel--open' : ''}`}
      >
        {children}
      </div>
    </div>
  )
}
