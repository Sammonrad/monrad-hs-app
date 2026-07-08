import { useEffect, useState } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import {
  ROLES,
  fetchAllProfiles,
  getProfileRole,
  isAdminProfile,
  updateProfile,
} from '../utils/storage/userProfileStorage.js'

function formatCreatedDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function buildEditsFromProfiles(profiles) {
  return Object.fromEntries(
    profiles.map((item) => [
      item.id,
      {
        full_name: item.full_name ?? '',
        role: getProfileRole(item),
      },
    ]),
  )
}

export function StaffManagementView({ onBack, profile, onProfileUpdated }) {
  const isAdmin = isAdminProfile(profile)
  const [profiles, setProfiles] = useState([])
  const [edits, setEdits] = useState({})
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [rowMessages, setRowMessages] = useState({})
  const [savingId, setSavingId] = useState(null)

  useEffect(() => {
    if (!isAdmin) return undefined

    let isMounted = true
    setLoading(true)
    setFetchError('')

    fetchAllProfiles().then(({ profiles: nextProfiles, error }) => {
      if (!isMounted) return
      setLoading(false)
      if (error) {
        setFetchError(error.message || 'Could not load staff profiles.')
        return
      }
      setProfiles(nextProfiles)
      setEdits(buildEditsFromProfiles(nextProfiles))
    })

    return () => {
      isMounted = false
    }
  }, [isAdmin])

  function setRowMessage(userId, type, message) {
    setRowMessages((prev) => ({ ...prev, [userId]: { type, message } }))
  }

  function clearRowMessage(userId) {
    setRowMessages((prev) => {
      if (!prev[userId]) return prev
      const next = { ...prev }
      delete next[userId]
      return next
    })
  }

  function handleEditChange(userId, field, value) {
    clearRowMessage(userId)
    setEdits((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      },
    }))
  }

  async function handleSave(userId) {
    const draft = edits[userId]
    if (!draft) return

    const fullName = draft.full_name.trim()
    if (!fullName) {
      setRowMessage(userId, 'error', 'Full name is required.')
      return
    }

    const isSelfDemotion =
      profile?.id === userId &&
      getProfileRole(profile) === ROLES.ADMIN &&
      draft.role === ROLES.STAFF

    if (isSelfDemotion) {
      const confirmed = window.confirm(
        'You are about to change your own role from Admin to Staff. You may lose access to admin features, including this page. Continue?',
      )
      if (!confirmed) return
    }

    setSavingId(userId)
    clearRowMessage(userId)

    const { profile: updated, error } = await updateProfile(userId, {
      full_name: fullName,
      role: draft.role,
    })

    setSavingId(null)

    if (error) {
      setRowMessage(userId, 'error', error.message || 'Could not save profile.')
      return
    }

    setProfiles((prev) => prev.map((item) => (item.id === userId ? updated : item)))
    setEdits((prev) => ({
      ...prev,
      [userId]: {
        full_name: updated.full_name ?? '',
        role: getProfileRole(updated),
      },
    }))
    setRowMessage(userId, 'success', 'Profile saved.')

    if (profile?.id === userId && onProfileUpdated) {
      onProfileUpdated(updated)
    }
  }

  if (!isAdmin) {
    return (
      <>
        <BackButton onClick={onBack} />
        <p className="staff-management__access-denied" role="alert">
          Access denied — admin only.
        </p>
      </>
    )
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">Staff Management</h1>
        <p className="progress">View and update staff profiles and roles</p>
      </header>

      {loading && <p className="progress">Loading staff profiles…</p>}

      {fetchError && (
        <p className="validation-message" role="alert">
          {fetchError}
        </p>
      )}

      {!loading && !fetchError && profiles.length === 0 && (
        <p className="staff-management__empty">No staff profiles found.</p>
      )}

      {!loading && !fetchError && profiles.length > 0 && (
        <div className="staff-management__table-wrap">
          <table className="staff-management__table">
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Full name</th>
                <th scope="col">Role</th>
                <th scope="col">Created</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((item) => {
                const draft = edits[item.id] ?? {
                  full_name: item.full_name ?? '',
                  role: getProfileRole(item),
                }
                const rowMessage = rowMessages[item.id]
                const isSaving = savingId === item.id

                return (
                  <tr key={item.id}>
                    <td className="staff-management__email" data-label="Email">
                      {item.email}
                    </td>
                    <td data-label="Full name">
                      <input
                        type="text"
                        className="staff-management__input"
                        value={draft.full_name}
                        onChange={(event) =>
                          handleEditChange(item.id, 'full_name', event.target.value)
                        }
                        disabled={isSaving}
                        aria-label={`Full name for ${item.email}`}
                      />
                    </td>
                    <td data-label="Role">
                      <select
                        className="staff-management__select"
                        value={draft.role}
                        onChange={(event) =>
                          handleEditChange(item.id, 'role', event.target.value)
                        }
                        disabled={isSaving}
                        aria-label={`Role for ${item.email}`}
                      >
                        <option value={ROLES.STAFF}>Staff</option>
                        <option value={ROLES.ADMIN}>Admin</option>
                      </select>
                    </td>
                    <td className="staff-management__created" data-label="Created">
                      {formatCreatedDate(item.created_at)}
                    </td>
                    <td className="staff-management__actions" data-label="Save">
                      <button
                        type="button"
                        className="action-btn action-btn--primary staff-management__save"
                        onClick={() => handleSave(item.id)}
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                      {rowMessage && (
                        <p
                          className={
                            rowMessage.type === 'error'
                              ? 'validation-message staff-management__row-message'
                              : 'complete-message staff-management__row-message'
                          }
                          role="status"
                        >
                          {rowMessage.message}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
