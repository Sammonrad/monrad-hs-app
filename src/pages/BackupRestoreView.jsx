import { useRef, useState } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import {
  APP_STORAGE_KEYS,
  collectBackupData,
  exportAppBackup,
  getBackupFilename,
  restoreBackupPayload,
} from '../utils/backup.js'

export function BackupRestoreView({ onBack }) {
  const [statusMessage, setStatusMessage] = useState(null)
  const [statusType, setStatusType] = useState('success')
  const fileInputRef = useRef(null)

  const backupData = collectBackupData()

  function showStatus(message, type = 'success') {
    setStatusMessage(message)
    setStatusType(type)
  }

  function handleExport() {
    try {
      const payload = exportAppBackup()
      showStatus(
        `Backup downloaded — ${payload.data.jobRecords.length} record${payload.data.jobRecords.length === 1 ? '' : 's'}, ${payload.data.actions.length} action${payload.data.actions.length === 1 ? '' : 's'}, ${payload.data.visitorSignInRecords.length} visitor record${payload.data.visitorSignInRecords.length === 1 ? '' : 's'}, and settings saved to ${getBackupFilename()}.`,
      )
    } catch {
      showStatus('Export failed. Please try again.', 'error')
    }
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const confirmed = window.confirm(
      'Importing a backup may replace existing saved app data.\n\nAre you sure you want to continue?',
    )
    if (!confirmed) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const result = restoreBackupPayload(parsed)
      if (!result.valid) {
        showStatus(result.error, 'error')
        return
      }
      showStatus('Backup restored successfully. Reloading app…')
      window.setTimeout(() => window.location.reload(), 800)
    } catch {
      showStatus('Invalid backup file — could not parse JSON.', 'error')
    }
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">Backup / Restore</h1>
        <p className="progress">Export or import all saved app data</p>
      </header>

      <p className="backup-intro">
        All app data is stored on this device and browser only — it is not synced to the cloud.
        Export backups regularly so you do not lose records if browser data is cleared or you change
        devices.
      </p>

      <p className="backup-note" role="note">
        Recommended: download a backup after important entries and at least once per week.
      </p>

      <section className="backup-section" aria-labelledby="backup-export-heading">
        <h2 id="backup-export-heading" className="backup-section__title">
          1. Export all app data
        </h2>
        <p className="backup-section__text">
          Download a JSON backup of everything stored on this device and browser.
        </p>
        <ul className="backup-keys">
          {APP_STORAGE_KEYS.map((item) => (
            <li key={item.key}>
              <code className="backup-keys__code">{item.key}</code>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
        <p className="backup-section__summary">
          Current data: {backupData.jobRecords.length} record
          {backupData.jobRecords.length === 1 ? '' : 's'},{' '}
          {backupData.actions.length} action{backupData.actions.length === 1 ? '' : 's'},{' '}
          {backupData.visitorSignInRecords.length} visitor record
          {backupData.visitorSignInRecords.length === 1 ? '' : 's'},{' '}
          {backupData.settings.operators.length} operator
          {backupData.settings.operators.length === 1 ? '' : 's'},{' '}
          {backupData.settings.machines.length} machine
          {backupData.settings.machines.length === 1 ? '' : 's'},{' '}
          {backupData.settings.sites.length} site
          {backupData.settings.sites.length === 1 ? '' : 's'}
        </p>
        <button type="button" className="submit-btn" onClick={handleExport}>
          Download backup
        </button>
      </section>

      <section className="backup-section" aria-labelledby="backup-import-heading">
        <h2 id="backup-import-heading" className="backup-section__title">
          2. Import backup
        </h2>
        <p className="backup-warning" role="note">
          Importing a backup may replace existing saved app data.
        </p>
        <p className="backup-section__text">
          Choose a <code className="backup-keys__code">.json</code> file previously exported from
          this app.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="backup-file-input"
          onChange={handleImportFile}
        />
        <button
          type="button"
          className="action-btn action-btn--primary"
          onClick={() => fileInputRef.current?.click()}
        >
          Choose backup file
        </button>
      </section>

      {statusMessage && (
        <p
          className={statusType === 'error' ? 'validation-message' : 'complete-message'}
          role="status"
        >
          {statusMessage}
        </p>
      )}
    </>
  )
}
