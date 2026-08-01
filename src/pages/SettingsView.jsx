import { useState } from 'react'
import { MACHINE_TYPES } from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { SettingsListItem } from '../components/SettingsListItem.jsx'
import { ConfirmModal } from '../components/common/ConfirmModal.jsx'
import { EmptyState } from '../components/common/EmptyState.jsx'
import { createRecordId } from '../utils/ids.js'
import { persistSettings } from '../utils/storage/settingsStorage.js'

export function SettingsView({ onBack, settings, setSettings }) {
  const [operatorName, setOperatorName] = useState('')
  const [machineName, setMachineName] = useState('')
  const [machineType, setMachineType] = useState('Excavator')
  const [siteName, setSiteName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  function updateSettings(next) {
    if (!persistSettings(next)) return false
    setSettings(next)
    return true
  }

  function handleAddOperator(event) {
    event.preventDefault()
    const name = operatorName.trim()
    if (!name) return
    if (settings.operators.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      window.alert('This operator is already in the list.')
      return
    }
    updateSettings({
      ...settings,
      operators: [...settings.operators, { id: createRecordId(), name }],
    })
    setOperatorName('')
  }

  function handleAddMachine(event) {
    event.preventDefault()
    const name = machineName.trim()
    if (!name) return
    if (settings.machines.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      window.alert('This machine is already in the list.')
      return
    }
    updateSettings({
      ...settings,
      machines: [...settings.machines, { id: createRecordId(), name, type: machineType }],
    })
    setMachineName('')
    setMachineType('Excavator')
  }

  function handleAddSite(event) {
    event.preventDefault()
    const name = siteName.trim()
    if (!name) return
    if (settings.sites.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      window.alert('This site is already in the list.')
      return
    }
    updateSettings({
      ...settings,
      sites: [...settings.sites, { id: createRecordId(), name }],
    })
    setSiteName('')
  }

  function requestDelete(kind, item) {
    setDeleteTarget({ kind, id: item.id, name: item.name })
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (deleteTarget.kind === 'operator') {
        updateSettings({
          ...settings,
          operators: settings.operators.filter((item) => item.id !== deleteTarget.id),
        })
      } else if (deleteTarget.kind === 'machine') {
        updateSettings({
          ...settings,
          machines: settings.machines.filter((item) => item.id !== deleteTarget.id),
        })
      } else if (deleteTarget.kind === 'site') {
        updateSettings({
          ...settings,
          sites: settings.sites.filter((item) => item.id !== deleteTarget.id),
        })
      }
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header form-page-header form-page-header--mobile-compact">
        <p className="company form-page-header__company">Monrad Earthworx</p>
        <h1 className="title form-page-header__title">Settings / Setup</h1>
        <p className="progress">Operators, machines, and sites for quick form entry</p>
      </header>

      <section className="settings-section" aria-labelledby="settings-operators-heading">
        <h2 id="settings-operators-heading" className="settings-section__title">
          1. Operators / staff
        </h2>
        <form className="settings-form" onSubmit={handleAddOperator}>
          <label className="field">
            <span className="field__label">Add operator name</span>
            <input
              type="text"
              className="field__input"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="e.g. John Smith"
            />
          </label>
          <button type="submit" className="action-btn action-btn--primary">
            Add operator
          </button>
        </form>
        {settings.operators.length === 0 ? (
          <EmptyState
            title="No operators yet"
            description="Add staff names for quick selection on forms."
          />
        ) : (
          <ul className="settings-list">
            {settings.operators.map((item) => (
              <SettingsListItem
                key={item.id}
                title={item.name}
                onDelete={() => requestDelete('operator', item)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="settings-section" aria-labelledby="settings-machines-heading">
        <h2 id="settings-machines-heading" className="settings-section__title">
          2. Machines
        </h2>
        <form className="settings-form" onSubmit={handleAddMachine}>
          <label className="field">
            <span className="field__label">Machine name / ID</span>
            <input
              type="text"
              className="field__input"
              value={machineName}
              onChange={(e) => setMachineName(e.target.value)}
              placeholder="e.g. EX-01"
            />
          </label>
          <label className="field">
            <span className="field__label">Machine type</span>
            <select
              className="field__input"
              value={machineType}
              onChange={(e) => setMachineType(e.target.value)}
            >
              {MACHINE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="action-btn action-btn--primary">
            Add machine
          </button>
        </form>
        {settings.machines.length === 0 ? (
          <EmptyState
            title="No machines yet"
            description="Add machines for quick selection on pre-starts and timesheets."
          />
        ) : (
          <ul className="settings-list">
            {settings.machines.map((item) => (
              <SettingsListItem
                key={item.id}
                title={item.name}
                subtitle={item.type}
                onDelete={() => requestDelete('machine', item)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="settings-section" aria-labelledby="settings-sites-heading">
        <h2 id="settings-sites-heading" className="settings-section__title">
          3. Common sites / locations
        </h2>
        <form className="settings-form" onSubmit={handleAddSite}>
          <label className="field">
            <span className="field__label">Add site name</span>
            <input
              type="text"
              className="field__input"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="e.g. Riverside subdivision"
            />
          </label>
          <button type="submit" className="action-btn action-btn--primary">
            Add site
          </button>
        </form>
        {settings.sites.length === 0 ? (
          <EmptyState
            title="No sites yet"
            description="Add common locations for faster form entry."
          />
        ) : (
          <ul className="settings-list">
            {settings.sites.map((item) => (
              <SettingsListItem
                key={item.id}
                title={item.name}
                onDelete={() => requestDelete('site', item)}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="form-hint">
        Saved lists appear as suggestions on forms. You can still type any value manually.
      </p>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete settings item?"
        message={
          deleteTarget
            ? `“${deleteTarget.name}” will be removed from Settings. Forms can still accept typed values.`
            : ''
        }
        confirmLabel="Delete"
        processingLabel="Deleting…"
        processing={deleting}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
