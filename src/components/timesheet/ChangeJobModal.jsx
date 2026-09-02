import { useState } from 'react'
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  QUICK_ACTIVITIES,
} from '../../utils/driverDaySegments.js'
import { getRecentJobs } from '../../utils/driverLocalPrefs.js'
import { getSettingsOptions } from '../../utils/storage/settingsStorage.js'

export function ChangeJobModal({
  open,
  onClose,
  onConfirm,
  settings,
  saving = false,
}) {
  const [customJob, setCustomJob] = useState('')

  if (!open) return null

  const comboOptions = getSettingsOptions(settings)
  const siteJobs = comboOptions.sites ?? []
  const recentJobs = getRecentJobs()
  const jobOptions = [...new Set([...recentJobs, ...siteJobs])]

  function handleQuickActivity(activityType) {
    onConfirm({ activityType, jobName: ACTIVITY_LABELS[activityType] || activityType })
  }

  function handleJobSelect(jobName) {
    onConfirm({ activityType: ACTIVITY_TYPES.JOB, jobName })
  }

  function handleCustomJob() {
    const name = customJob.trim()
    if (!name) return
    onConfirm({ activityType: ACTIVITY_TYPES.JOB, jobName: name })
  }

  return (
    <div className="driver-modal" role="dialog" aria-modal="true" aria-labelledby="change-job-title">
      <div className="driver-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="driver-modal__panel">
        <h2 id="change-job-title" className="driver-modal__title">Change job</h2>

        <div className="driver-change-job__quick">
          {QUICK_ACTIVITIES.map((type) => (
            <button
              key={type}
              type="button"
              className="driver-day-btn driver-day-btn--secondary"
              disabled={saving}
              onClick={() => handleQuickActivity(type)}
            >
              {ACTIVITY_LABELS[type]}
            </button>
          ))}
        </div>

        <p className="driver-change-job__section-label">Active jobs</p>
        <div className="driver-change-job__jobs">
          {jobOptions.map((job) => (
            <button
              key={job}
              type="button"
              className="driver-day-btn driver-day-btn--job"
              disabled={saving}
              onClick={() => handleJobSelect(job)}
            >
              {job}
            </button>
          ))}
        </div>

        <label className="driver-day-field">
          <span className="driver-day-field__label">Other job name</span>
          <input
            type="text"
            className="driver-day-field__input"
            value={customJob}
            onChange={(e) => setCustomJob(e.target.value)}
            placeholder="Job / project name"
          />
        </label>
        <button
          type="button"
          className="driver-day-btn driver-day-btn--secondary driver-day-btn--block"
          disabled={saving || !customJob.trim()}
          onClick={handleCustomJob}
        >
          Start other job
        </button>

        <button type="button" className="driver-modal__cancel" onClick={onClose} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  )
}
