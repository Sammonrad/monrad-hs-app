import { useMemo } from 'react'
import {
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_LABELS,
  DEFECT_SEVERITY_LABELS,
  SOURCE_TYPE_LABELS,
} from '../constants/index.js'
import { BackButton } from '../components/BackButton.jsx'
import { isOverdue } from '../utils/storage/actionsStorage.js'
import {
  getSafetyAlerts,
  isCriticalAction,
  isOpenAction,
  listUnresolvedIncidentActions,
  listUnresolvedMachineDefects,
} from '../utils/safetyAlerts.js'
import { formatNzDate } from '../utils/formatting.js'

function actionLabel(action) {
  const parts = [
    action.description?.trim() || 'Untitled action',
    action.site?.trim() || null,
    action.dueDate ? `Due ${formatNzDate(action.dueDate)}` : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

function actionMeta(action) {
  const bits = [
    SOURCE_TYPE_LABELS[action.sourceType] ?? action.sourceType,
    ACTION_STATUS_LABELS[action.status] ?? action.status,
    ACTION_PRIORITY_LABELS[action.priority] ?? action.priority,
  ].filter(Boolean)
  return bits.join(' · ')
}

function defectLabel(record) {
  const machine = record.machineNameId || record.machine || 'Machine'
  const severity =
    DEFECT_SEVERITY_LABELS[record.defectSeverity] ?? record.defectSeverity ?? null
  const description = record.defectDescription?.trim() || 'Unresolved defect'
  return [machine, severity, description].filter(Boolean).join(' · ')
}

export function SafetyAlertsView({ onBack, onNavigate, savedRecords, actions }) {
  const records = savedRecords ?? []
  const actionList = actions ?? []
  const alerts = getSafetyAlerts(records, actionList)

  const sections = useMemo(() => {
    const openActions = actionList.filter(isOpenAction)
    const overdueActions = actionList.filter(isOverdue)
    const criticalActions = actionList.filter(isCriticalAction)
    const machineDefects = listUnresolvedMachineDefects(records, actionList)
    const incidentActions = listUnresolvedIncidentActions(actionList)

    return [
      {
        id: 'open-actions',
        title: 'Open actions',
        count: alerts.openActions,
        alertWhenPositive: false,
        linkLabel: 'View action',
        items: openActions.map((action) => ({
          id: action.id,
          primary: actionLabel(action),
          secondary: actionMeta(action),
          onClick: () =>
            onNavigate?.('action-register', {
              highlightActionId: action.id,
              actionFilter: 'all',
            }),
        })),
      },
      {
        id: 'overdue-actions',
        title: 'Overdue actions',
        count: alerts.overdueActions,
        alertWhenPositive: true,
        linkLabel: 'View action',
        items: overdueActions.map((action) => ({
          id: action.id,
          primary: actionLabel(action),
          secondary: actionMeta(action),
          onClick: () =>
            onNavigate?.('action-register', {
              highlightActionId: action.id,
              actionFilter: 'overdue',
            }),
        })),
      },
      {
        id: 'critical-actions',
        title: 'Critical actions',
        count: alerts.criticalActions,
        alertWhenPositive: true,
        linkLabel: 'View action',
        items: criticalActions.map((action) => ({
          id: action.id,
          primary: actionLabel(action),
          secondary: actionMeta(action),
          onClick: () =>
            onNavigate?.('action-register', {
              highlightActionId: action.id,
              actionFilter: 'critical',
            }),
        })),
      },
      {
        id: 'machine-defects',
        title: 'Unresolved machine defects',
        count: alerts.unresolvedMachineDefects,
        alertWhenPositive: true,
        linkLabel: 'View defect',
        items: machineDefects.map((record) => ({
          id: record.id,
          primary: defectLabel(record),
          secondary: [record.date ? formatNzDate(record.date) : null, record.siteLocation || record.operatorName]
            .filter(Boolean)
            .join(' · '),
          onClick: () =>
            onNavigate?.('pre-start', {
              highlightRecordId: record.id,
              recordFocus: 'defects',
            }),
        })),
      },
      {
        id: 'incident-actions',
        title: 'Unresolved incident corrective actions',
        count: alerts.unresolvedIncidentActions,
        alertWhenPositive: true,
        linkLabel: 'View incident',
        items: incidentActions.map((action) => ({
          id: action.id,
          primary: actionLabel(action),
          secondary: actionMeta(action),
          onClick: () =>
            onNavigate?.('incident', {
              highlightRecordId: action.sourceRecordId || undefined,
              recordFocus: 'corrective',
            }),
        })),
      },
    ]
  }, [actionList, alerts, onNavigate, records])

  return (
    <>
      <BackButton onClick={onBack} />

      <header className="header">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">Safety Alerts</h1>
        <p className="progress">Open, overdue, and unresolved safety items</p>
      </header>

      <div className="safety-alerts-view">
        {sections.map((section) => {
          const isAlert = section.alertWhenPositive && section.count > 0
          const isClear = section.count === 0
          const cardClass = [
            'safety-alert-card',
            isAlert ? 'safety-alert-card--alert' : '',
            isClear ? 'safety-alert-card--clear' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <section key={section.id} className={cardClass} aria-labelledby={`${section.id}-heading`}>
              <div className="safety-alert-card__header">
                <h2 id={`${section.id}-heading`} className="safety-alert-card__title">
                  {section.title}
                </h2>
                <p className="safety-alert-card__count" aria-label={`${section.count} items`}>
                  {section.count}
                </p>
              </div>

              {section.items.length === 0 ? (
                <p className="safety-alert-card__empty">No alerts</p>
              ) : (
                <ul className="safety-alert-card__list">
                  {section.items.map((item) => (
                    <li key={item.id} className="safety-alert-card__item">
                      <button
                        type="button"
                        className="safety-alert-card__link"
                        onClick={item.onClick}
                      >
                        <span className="safety-alert-card__item-primary">{item.primary}</span>
                        {item.secondary ? (
                          <span className="safety-alert-card__item-secondary">{item.secondary}</span>
                        ) : null}
                        <span className="safety-alert-card__item-action">{section.linkLabel}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}
