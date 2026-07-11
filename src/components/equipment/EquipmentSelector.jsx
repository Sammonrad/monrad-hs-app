import { getEquipmentReadableName, isPreStartSelectable } from '../../constants/equipmentConfig.js'

export function EquipmentSelector({
  equipment,
  value,
  onChange,
  includeManual = true,
  manualValue = '',
  onManualChange,
  preStartOnly = false,
  placeholder = 'Select equipment',
  id = 'equipment-selector',
  allowEmpty = false,
  emptyLabel = 'All equipment',
}) {
  const list = preStartOnly
    ? equipment.filter(isPreStartSelectable)
    : equipment.filter((item) => !item.archived)

  return (
    <div className="equipment-selector">
      <select
        id={id}
        className="form-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {!allowEmpty && <option value="">{placeholder}</option>}
        {list.map((item) => (
          <option key={item.cloudId ?? item.id} value={item.cloudId ?? item.id}>
            {getEquipmentReadableName(item)}
            {item.operationalStatus === 'Out of Service' ? ' (Out of Service)' : ''}
          </option>
        ))}
      </select>
      {includeManual && onManualChange && (
        <div className="equipment-selector__manual">
          <label htmlFor={`${id}-manual`} className="equipment-selector__manual-label">
            Or enter manually
          </label>
          <input
            id={`${id}-manual`}
            type="text"
            className="form-input"
            value={manualValue}
            onChange={(event) => onManualChange(event.target.value)}
            placeholder="Manual machine entry"
          />
        </div>
      )}
    </div>
  )
}

export function getSelectedEquipmentName(equipment, selectedId, manualValue) {
  if (manualValue?.trim()) return manualValue.trim()
  const item = equipment.find((e) => (e.cloudId ?? e.id) === selectedId)
  return item ? getEquipmentReadableName(item) : ''
}
