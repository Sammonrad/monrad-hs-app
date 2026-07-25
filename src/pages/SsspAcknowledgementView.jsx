import { useEffect, useState } from 'react'
import { BackButton } from '../components/BackButton.jsx'
import { FormPageHeader } from '../components/forms/FormPageHeader.jsx'
import { FormField } from '../components/forms/FormField.jsx'
import { FormActions } from '../components/forms/FormActions.jsx'
import { SsspTextarea } from '../components/sssp/SsspFields.jsx'
import { ValidationMessage } from '../components/forms/ValidationMessage.jsx'
import { getSsspStatusLabel } from '../constants/ssspStatuses.js'
import {
  fetchSsspById,
  fetchUserAcknowledgementForSssp,
  saveSsspAcknowledgement,
} from '../utils/storage/ssspCloudStorage.js'

export function SsspAcknowledgementView({
  onBack,
  user,
  profile,
  ssspCloudId,
}) {
  const [record, setRecord] = useState(null)
  const [existingAck, setExistingAck] = useState(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const userName = profile?.full_name?.trim() || user?.email || ''

  useEffect(() => {
    let isMounted = true

    async function load() {
      if (!ssspCloudId || !user?.id) {
        setLoading(false)
        return
      }

      const { record: sssp, error: loadErr } = await fetchSsspById(ssspCloudId)
      if (!isMounted) return

      if (loadErr || !sssp) {
        setError(loadErr?.message ?? 'Could not load SSSP.')
        setLoading(false)
        return
      }

      setRecord(sssp)

      const { acknowledgement } = await fetchUserAcknowledgementForSssp(
        user.id,
        ssspCloudId,
        sssp.revision,
      )
      if (!isMounted) return

      setExistingAck(acknowledgement)
      setLoading(false)
    }

    load()
    return () => {
      isMounted = false
    }
  }, [ssspCloudId, user?.id])

  const outdatedAck =
    existingAck && existingAck.revision < (record?.revision ?? 1)

  async function handleAcknowledge() {
    if (!record?.cloudId || !user?.id) return
    setSubmitting(true)
    setError('')

    const { error: saveError } = await saveSsspAcknowledgement(user, {
      ssspId: record.cloudId,
      revision: record.revision,
      userName,
      notes,
    })

    setSubmitting(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    setSuccess(true)
    setExistingAck({
      revision: record.revision,
      acknowledgedAt: new Date().toISOString(),
      userName,
      notes,
    })
  }

  return (
    <>
      <BackButton onClick={onBack} />

      <FormPageHeader
        title="Acknowledge SSSP"
        subtitle="Confirm you have read and understood the current site safety plan"
      />

      {loading && <p className="progress">Loading…</p>}

      {error && <ValidationMessage message={error} />}

      {record && (
        <section className="sssp-acknowledge">
          <header className="sssp-acknowledge__header">
            <span className="sssp-acknowledge__eyebrow">Current plan</span>
            <h2>{record.project || 'Site-Specific Safety Plan'}</h2>
            <p>Review the plan details and confirm the current revision below.</p>
          </header>
          <dl className="sssp-acknowledge__summary">
            <div><dt>SSSP</dt><dd>{record.ssspNumber}</dd></div>
            <div><dt>Project</dt><dd>{record.project}</dd></div>
            <div><dt>Site</dt><dd>{record.site}</dd></div>
            <div><dt>Revision</dt><dd>{record.revision}</dd></div>
            <div><dt>Status</dt><dd>{getSsspStatusLabel(record.status)}</dd></div>
          </dl>

          {outdatedAck && (
            <p className="sssp-acknowledge__warning" role="alert">
              You previously acknowledged revision {existingAck.revision}. The current revision is{' '}
              {record.revision}. Please review the updated SSSP and acknowledge again.
            </p>
          )}

          {existingAck && !outdatedAck && (
            <p className="sssp-acknowledge__success">
              You acknowledged revision {existingAck.revision} on{' '}
              {existingAck.acknowledgedAt
                ? new Date(existingAck.acknowledgedAt).toLocaleString()
                : 'record'}
              .
            </p>
          )}

          {!success && (!existingAck || outdatedAck) && (
            <>
              <p className="sssp-acknowledge__declaration">
                I confirm I have read and understood the Site-Specific Safety Plan for this site,
                including the risk register and emergency procedures. I will follow all controls and
                report any new hazards or incidents immediately.
              </p>

              <FormField label="Optional notes">
                <SsspTextarea value={notes} onChange={setNotes} rows={3} />
              </FormField>

              <FormActions>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleAcknowledge}
                  disabled={submitting}
                >
                  {submitting ? 'Saving…' : `Acknowledge Rev ${record.revision}`}
                </button>
              </FormActions>
            </>
          )}

          {success && (
            <p className="sssp-acknowledge__success" role="status">
              Acknowledgement recorded for revision {record.revision}.
            </p>
          )}
        </section>
      )}
    </>
  )
}
