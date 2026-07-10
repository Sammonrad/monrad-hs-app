import { FormField } from '../forms/FormField.jsx'
import { SsspInput, SsspTextarea } from './SsspFields.jsx'
import { createRecordId } from '../../utils/ids.js'

export function RepeatableList({ items, itemFields, onChange, readOnly = false, addLabel = 'Add row' }) {
  const list = Array.isArray(items) ? items : []

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

  function removeItem(index) {
    onChange(list.filter((_, i) => i !== index))
  }

  function moveItem(index, direction) {
    const swap = direction === 'up' ? index - 1 : index + 1
    if (swap < 0 || swap >= list.length) return
    const next = [...list]
    ;[next[index], next[swap]] = [next[swap], next[index]]
    onChange(next)
  }

  if (readOnly) {
    return (
      <div className="sssp-repeatable">
        {list.length === 0 && <p className="sssp-repeatable__empty">None recorded.</p>}
        {list.map((item, index) => (
          <div key={item.id ?? index} className="sssp-repeatable__item sssp-repeatable__item--readonly">
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
      {list.map((item, index) => (
        <div key={item.id ?? index} className="sssp-repeatable__item">
          <div className="sssp-repeatable__item-header">
            <span>Row {index + 1}</span>
            <div className="sssp-repeatable__item-actions">
              <button type="button" onClick={() => moveItem(index, 'up')} disabled={index === 0}>↑</button>
              <button type="button" onClick={() => moveItem(index, 'down')} disabled={index === list.length - 1}>↓</button>
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
        {addLabel}
      </button>
    </div>
  )
}
