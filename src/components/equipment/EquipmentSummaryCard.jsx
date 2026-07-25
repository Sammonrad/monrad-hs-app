import { EquipmentStatusBadge } from './EquipmentStatusBadge.jsx'
import { MaintenanceDueBadge } from './MaintenanceDueBadge.jsx'
import { CloudSyncBadge } from '../CloudSyncBadge.jsx'
import { getEquipmentMakeModel, getEquipmentReadableName } from '../../constants/equipmentConfig.js'
import { getOpenDefectCountForEquipment } from '../../utils/storage/equipmentDefectStorage.js'

export function EquipmentSummaryCard({ equipment, defectRecords = [], onView, onAction }) {
  const openDefects = getOpenDefectCountForEquipment(defectRecords, equipment.cloudId ?? equipment.id)
  const readableName = getEquipmentReadableName(equipment)

  return (
    <article className="equipment-summary-card">
      <header className="equipment-summary-card__header">
        <div>
          <h3 className="equipment-summary-card__title">{readableName}</h3>
          <p className="equipment-summary-card__meta">
            {equipment.assetType || '—'} · {getEquipmentMakeModel(equipment)}
          </p>
        </div>
        <div className="equipment-summary-card__badge-row">
          <EquipmentStatusBadge status={equipment.operationalStatus} />
          <CloudSyncBadge syncStatus={equipment.syncStatus} size="small" />
        </div>
      </header>

      <dl className="equipment-summary-card__details">
        {equipment.registrationNumber && (
          <>
            <dt>Registration</dt>
            <dd>{equipment.registrationNumber}</dd>
          </>
        )}
        {(equipment.currentHours || equipment.currentOdometer) && (
          <>
            <dt>Hours / Odometer</dt>
            <dd>
              {equipment.currentHours ? `${equipment.currentHours} hrs` : '—'}
              {equipment.currentOdometer ? ` · ${equipment.currentOdometer} km` : ''}
            </dd>
          </>
        )}
        <dt>Next service</dt>
        <dd>
          {equipment.nextServiceDate || equipment.nextServiceHours || equipment.nextServiceOdometer ? (
            <>
              {equipment.nextServiceDate && <span>{equipment.nextServiceDate}</span>}
              {equipment.nextServiceHours && <span> · {equipment.nextServiceHours} hrs</span>}
              {equipment.nextServiceOdometer && <span> · {equipment.nextServiceOdometer} km</span>}
              <div className="equipment-summary-card__badge-row">
                <MaintenanceDueBadge equipment={equipment} />
              </div>
            </>
          ) : (
            '—'
          )}
        </dd>
        <dt>Open defects</dt>
        <dd>{openDefects}</dd>
        <dt>Pre-start</dt>
        <dd>{equipment.prestartRequired ? 'Required' : 'Not required'}</dd>
      </dl>

      <div className="equipment-summary-card__actions">
        {onView && (
          <button type="button" className="btn btn--secondary" onClick={() => onView(equipment)}>
            View
          </button>
        )}
        {onAction && (
          <button type="button" className="btn btn--primary" onClick={() => onAction(equipment)}>
            Actions
          </button>
        )}
      </div>
    </article>
  )
}
