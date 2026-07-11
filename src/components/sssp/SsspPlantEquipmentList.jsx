import { FormField } from '../forms/FormField.jsx'
import { SsspInput, SsspTextarea } from './SsspFields.jsx'
import { createRecordId } from '../../utils/ids.js'
import { getEquipmentReadableName, getEquipmentMakeModel } from '../../constants/equipmentConfig.js'

function buildPlantRowFromEquipment(equipment) {
  return {
    id: createRecordId(),
    plantType: equipment.assetType || '',
    registration: equipment.registrationNumber || equipment.assetNumber || '',
    operator: equipment.assignedOperator || '',
    inspections: [
      equipment.nextServiceDate ? `Next service: ${equipment.nextServiceDate}` : '',
      equipment.prestartRequired ? 'Pre-start required' : '',
    ].filter(Boolean).join('; ') || '',
    hazards: '',
    registerSnapshot: getEquipmentReadableName(equipment),
    makeModel: getEquipmentMakeModel(equipment),
  }
}

export function SsspPlantEquipmentList({
  items,
  itemFields,
  onChange,
  readOnly = false,
  equipment = [],
  isAdmin = false,
}) {
  const list = Array.isArray(items) ? items : []
  const activeEquipment = equipment.filter((item) => !item.archived)

  function updateItem(index, key, value) {
    const next = list.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    onChange(next)
  }

  function addItem() {
    const empty = {}
    itemFields.forEach((field) => {
      empty[field.key] = ''
    })
    empty.id = createRecordId()
    onChange([...list, empty])
  }

  function addFromRegister(equipmentId) {
    const item = activeEquipment.find((e) => e.cloudId === equipmentId)
    if (!item) return
    onChange([...list, buildPlantRowFromEquipment(item)])
  }

  function removeItem(index) {
    onChange(list.filter((_, i) => i !== index))
  }

  if (readOnly) {
    return (
      <div className="sssp-repeatable">
        {list.length === 0 && <p className="sssp-repeatable__empty">None recorded.</p>}
        {list.map((item, index) => (
          <div key={item.id ?? index} className="sssp-repeatable__item sssp-repeatable__item--readonly">
            {item.registerSnapshot && (
              <p><strong>Register snapshot:</strong> {item.registerSnapshot}</p>
            )}
            {itemFields.map((field) => (
              <p key={field.key}>
                <strong>{field.label}:</strong> {item[field.key] || '—'}
              </p>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="sssp-repeatable">
      {isAdmin && activeEquipment.length > 0 && (
        <div className="sssp-plant-register-picker">
          <label className="field">
            <span className="field__label">Add from equipment register</span>
            <select
              className="field__input"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) {
                  addFromRegister(event.target.value)
                  event.target.value = ''
                }
              }}
            >
              <option value="">Select equipment…</option>
              {activeEquipment.map((item) => (
                <option key={item.cloudId} value={item.cloudId}>
                  {getEquipmentReadableName(item)}
                </option>
              ))}
            </select>
          </label>
          <p className="field__hint">Copies readable asset information into this SSSP. You can still edit fields or add manual rows.</p>
        </div>
      )}

      {list.map((item, index) => (
        <div key={item.id ?? index} className="sssp-repeatable__item">
          <div className="sssp-repeatable__item-header">
            <span>Row {index + 1}{item.registerSnapshot ? ` — ${item.registerSnapshot}` : ''}</span>
            <div className="sssp-repeatable__item-actions">
              <button type="button" onClick={() => removeItem(index)}>Remove</button>
            </div>
          </div>
          {itemFields.map((field) => (
            <FormField key={field.key} label={field.label} required={field.required}>
              {field.type === 'textarea' ? (
                <SsspTextarea
                  value={item[field.key] ?? ''}
                  onChange={(v) => updateItem(index, field.key, v)}
                  rows={3}
                />
              ) : (
                <SsspInput
                  value={item[field.key] ?? ''}
                  onChange={(v) => updateItem(index, field.key, v)}
                />
              )}
            </FormField>
          ))}
        </div>
      ))}
      <button type="button" className="btn btn--secondary" onClick={addItem}>
        Add Plant row (manual)
      </button>
    </div>
  )
}
