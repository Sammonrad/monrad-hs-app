export function SettingsListItem({ title, subtitle, onDelete }) {
  return (
    <li className="settings-list__item">
      <div className="settings-list__content">
        <p className="settings-list__title">{title}</p>
        {subtitle && <p className="settings-list__subtitle">{subtitle}</p>}
      </div>
      <button type="button" className="settings-list__delete" onClick={onDelete}>
        Delete
      </button>
    </li>
  )
}
