import { useState } from 'react'
import { ArchiveRecordModal } from './ArchiveRecordModal.jsx'
import { isAdminProfile } from '../utils/storage/userProfileStorage.js'
import { isArchived } from '../utils/storage/archiveFilter.js'
import { archiveRecord } from '../utils/storage/archiveActions.js'

/**
 * Compact admin-only Archive Record control with confirmation modal.
 *
 * @param {object} props
 * @param {string} props.recordType ARCHIVE_RECORD_TYPES value
 * @param {object} props.record
 * @param {object|null} props.user
 * @param {object|null} props.profile
 * @param {(archived: object, meta: { localOnly?: boolean }) => void} [props.onArchived]
 * @param {string} [props.preparedByName] SSSP change-log name
 * @param {string} [props.buttonClassName]
 * @param {string} [props.label]
 */
export function AdminArchiveAction({
  recordType,
  record,
  user,
  profile,
  onArchived,
  preparedByName,
  buttonClassName = 'action-btn archive-record-action',
  label = 'Archive Record',
}) {
  const isAdmin = isAdminProfile(profile)
  const [open, setOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState('')

  if (!isAdmin || !record || isArchived(record, recordType)) {
    return null
  }

  async function handleConfirm() {
    if (archiving) return
    setArchiving(true)
    setError('')

    const { record: archived, error: archiveError, localOnly } = await archiveRecord(
      recordType,
      record,
      user,
      profile,
      { preparedByName },
    )

    setArchiving(false)

    if (archiveError || !archived) {
      setError(archiveError?.message || 'Archive failed.')
      return
    }

    setOpen(false)
    onArchived?.(archived, { localOnly: Boolean(localOnly) })
  }

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => {
          setError('')
          setOpen(true)
        }}
      >
        {label}
      </button>
      <ArchiveRecordModal
        open={open}
        onCancel={() => {
          if (archiving) return
          setOpen(false)
          setError('')
        }}
        onConfirm={handleConfirm}
        archiving={archiving}
        error={error}
      />
    </>
  )
}
