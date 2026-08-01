import { useState } from 'react'
import { FormField } from '../forms/FormField.jsx'
import { FormSection } from '../forms/FormSection.jsx'
import { FormGrid, FormGridFull } from '../layout/FormGrid.jsx'
import { TextField, SelectField, DateField, TimeField, NotesField } from '../FormFields.jsx'
import {
  isoToLocalDatePart,
  isoToLocalTimePart,
  localDateAndTimeToIso,
} from '../../utils/time12Hour.js'
import { FormActions } from '../forms/FormActions.jsx'
import {
  ASSET_TYPES,
  OPERATIONAL_STATUSES,
  OWNERSHIP_STATUSES,
} from '../../constants/equipmentConfig.js'
import { SERVICE_TYPES } from '../../constants/maintenanceConfig.js'
import { DOCUMENT_TYPES } from '../../constants/complianceConfig.js'
import { createEmptyEquipment } from '../../utils/storage/equipmentCloudStorage.js'
import { createEmptyServiceRecord } from '../../utils/storage/equipmentServiceCloudStorage.js'
import { createEmptyDocumentRecord } from '../../utils/storage/equipmentDocumentCloudStorage.js'
import { createEmptyDefectRecord } from '../../utils/storage/equipmentDefectStorage.js'
import { DEFECT_SEVERITIES, DEFECT_STATUSES } from '../../constants/equipmentConfig.js'
import { EquipmentSelector } from './EquipmentSelector.jsx'

export function EquipmentForm({ initial, onSave, onCancel, saving, saveError, operatorOptions = [] }) {
  const [form, setForm] = useState(() => ({ ...createEmptyEquipment(), ...initial }))

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSave(form)
  }

  return (
    <form className="equipment-form" onSubmit={handleSubmit} noValidate>
      {saveError && <p className="validation-message validation-message--error">{saveError}</p>}
      <FormSection title="Asset identification">
        <FormGrid>
          <TextField label="Asset number" field="assetNumber" value={form.assetNumber} onChange={updateField} />
          <TextField label="Asset name" field="assetName" value={form.assetName} onChange={updateField} />
          <FormField label="Asset type">
            <input
              list="asset-type-options"
              className="form-input"
              value={form.assetType}
              onChange={(e) => updateField('assetType', e.target.value)}
              placeholder="e.g. Excavator"
            />
            <datalist id="asset-type-options">
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </FormField>
          <TextField label="Make" field="make" value={form.make} onChange={updateField} />
          <TextField label="Model" field="model" value={form.model} onChange={updateField} />
          <TextField label="Manufacture year" field="manufactureYear" value={form.manufactureYear} onChange={updateField} />
          <TextField label="Serial number" field="serialNumber" value={form.serialNumber} onChange={updateField} />
          <TextField label="Registration number" field="registrationNumber" value={form.registrationNumber} onChange={updateField} />
        </FormGrid>
      </FormSection>

      <FormSection title="Status and assignment">
        <FormGrid>
          <SelectField label="Ownership status" field="ownershipStatus" value={form.ownershipStatus} onChange={updateField} options={OWNERSHIP_STATUSES.map((v) => ({ value: v, label: v }))} />
          <SelectField label="Operational status" field="operationalStatus" value={form.operationalStatus} onChange={updateField} options={OPERATIONAL_STATUSES.map((v) => ({ value: v, label: v }))} />
          <FormField label="Assigned operator">
            <input
              list="operator-options"
              className="form-input"
              value={form.assignedOperator}
              onChange={(e) => updateField('assignedOperator', e.target.value)}
            />
            <datalist id="operator-options">
              {operatorOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </FormField>
          <TextField label="Normal location" field="normalLocation" value={form.normalLocation} onChange={updateField} />
        </FormGrid>
      </FormSection>

      <FormSection title="Usage and servicing">
        <FormGrid>
          <TextField label="Current operating hours" field="currentHours" value={form.currentHours} onChange={updateField} />
          <TextField label="Current odometer (km)" field="currentOdometer" value={form.currentOdometer} onChange={updateField} />
          <DateField value={form.nextServiceDate} onChange={updateField} label="Next service date" field="nextServiceDate" />
          <TextField label="Next service hours" field="nextServiceHours" value={form.nextServiceHours} onChange={updateField} />
          <TextField label="Next service odometer (km)" field="nextServiceOdometer" value={form.nextServiceOdometer} onChange={updateField} />
        </FormGrid>
      </FormSection>

      <FormSection title="Requirements">
        <FormGrid>
          <FormField label="Pre-start required">
            <label className="checkbox-label">
              <input type="checkbox" checked={form.prestartRequired} onChange={(e) => updateField('prestartRequired', e.target.checked)} />
              Pre-start inspection required
            </label>
          </FormField>
          <FormField label="Road legal">
            <label className="checkbox-label">
              <input type="checkbox" checked={form.roadLegal} onChange={(e) => updateField('roadLegal', e.target.checked)} />
              Road legal / registered for road use
            </label>
          </FormField>
          <FormGridFull>
            <NotesField value={form.notes} onChange={updateField} />
          </FormGridFull>
        </FormGrid>
      </FormSection>

      <FormActions>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save equipment'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </FormActions>
    </form>
  )
}

export function DefectForm({
  initial,
  equipment,
  onSave,
  onCancel,
  saving,
  saveError,
  isAdmin,
  operatorOptions = [],
  readOnlyResolve = false,
}) {
  const [form, setForm] = useState(() => ({ ...createEmptyDefectRecord(), ...initial }))

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (form.status === 'Resolved' && !form.resolutionDetails?.trim()) {
      return
    }
    onSave(form)
  }

  return (
    <form className="equipment-form" onSubmit={handleSubmit} noValidate>
      {saveError && <p className="validation-message validation-message--error">{saveError}</p>}
      {form.severity === 'Critical' && (
        <div className="equipment-critical-warning" role="alert">
          Critical defect — consider marking the machine Out of Service until resolved.
        </div>
      )}

      <FormGrid>
        <FormField label="Machine / equipment" required>
          <EquipmentSelector
            equipment={equipment}
            value={form.equipmentId}
            onChange={(value) => {
              const item = equipment.find((e) => (e.cloudId ?? e.id) === value)
              updateField('equipmentId', value)
              if (item) updateField('equipmentName', `${item.assetNumber} — ${item.assetName}`)
            }}
            includeManual={false}
          />
        </FormField>
        <DateField
          label="Date reported"
          field="reportedAtDate"
          value={isoToLocalDatePart(form.reportedAt)}
          onChange={(_, dateValue) => {
            updateField(
              'reportedAt',
              localDateAndTimeToIso(dateValue, isoToLocalTimePart(form.reportedAt)) || form.reportedAt,
            )
          }}
        />
        <TimeField
          label="Time reported"
          field="reportedAtTime"
          value={isoToLocalTimePart(form.reportedAt)}
          onChange={(_, timeValue) => {
            const datePart = isoToLocalDatePart(form.reportedAt)
            if (!datePart) return
            updateField('reportedAt', localDateAndTimeToIso(datePart, timeValue) || form.reportedAt)
          }}
        />
        <SelectField label="Severity" field="severity" value={form.severity} onChange={updateField} options={DEFECT_SEVERITIES.map((v) => ({ value: v, label: v }))} />
        <FormGridFull>
          <label className="field">
            <span className="field__label">Description</span>
            <textarea
              className="field__input field__textarea"
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              required
            />
          </label>
        </FormGridFull>
        <FormGridFull>
          <label className="field">
            <span className="field__label">Immediate action taken</span>
            <textarea
              className="field__input field__textarea"
              value={form.immediateAction}
              onChange={(e) => updateField('immediateAction', e.target.value)}
              rows={2}
            />
          </label>
        </FormGridFull>
        <FormField label="Machine isolated">
          <label className="checkbox-label">
            <input type="checkbox" checked={form.machineIsolated} onChange={(e) => updateField('machineIsolated', e.target.checked)} />
            Machine has been isolated
          </label>
        </FormField>
        <FormField label="Safe to operate">
          <label className="checkbox-label">
            <input type="checkbox" checked={form.safeToOperate} onChange={(e) => updateField('safeToOperate', e.target.checked)} />
            Reported as safe to operate
          </label>
        </FormField>
        {isAdmin && (
          <>
            <FormField label="Assigned person">
              <input list="defect-operator-options" className="form-input" value={form.assignedPerson} onChange={(e) => updateField('assignedPerson', e.target.value)} />
              <datalist id="defect-operator-options">
                {operatorOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </FormField>
            <DateField value={form.targetDate} onChange={updateField} label="Target date" field="targetDate" />
            <SelectField label="Status" field="status" value={form.status} onChange={updateField} options={DEFECT_STATUSES.map((v) => ({ value: v, label: v }))} />
            {(form.status === 'Resolved' || form.status === 'Deferred') && isAdmin && (
              <FormGridFull>
                <label className="field">
                  <span className="field__label">Resolution details</span>
                  <textarea
                    className="field__input field__textarea"
                    value={form.resolutionDetails}
                    onChange={(e) => updateField('resolutionDetails', e.target.value)}
                    rows={3}
                    required={form.status === 'Resolved'}
                  />
                </label>
              </FormGridFull>
            )}
          </>
        )}
      </FormGrid>

      <FormActions>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save defect'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </FormActions>
    </form>
  )
}

export function ServiceForm({ initial, equipment = [], onSave, onCancel, saving, saveError }) {
  const [form, setForm] = useState(() => ({ ...createEmptyServiceRecord(), ...initial }))

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <form className="equipment-form" onSubmit={(e) => { e.preventDefault(); onSave(form) }} noValidate>
      {saveError && <p className="validation-message validation-message--error">{saveError}</p>}
      <FormGrid>
        <FormField label="Machine / equipment" required>
          <EquipmentSelector
            equipment={equipment}
            value={form.equipmentId}
            onChange={(value) => updateField('equipmentId', value)}
            includeManual={false}
          />
        </FormField>
        <DateField value={form.serviceDate} onChange={updateField} label="Service date" field="serviceDate" />
        <FormField label="Service type">
          <input list="service-type-options" className="form-input" value={form.serviceType} onChange={(e) => updateField('serviceType', e.target.value)} />
          <datalist id="service-type-options">
            {SERVICE_TYPES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </FormField>
        <TextField label="Operating hours" field="operatingHours" value={form.operatingHours} onChange={updateField} />
        <TextField label="Odometer (km)" field="odometer" value={form.odometer} onChange={updateField} />
        <TextField label="Service provider" field="serviceProvider" value={form.serviceProvider} onChange={updateField} />
        <TextField label="Completed by" field="completedBy" value={form.completedBy} onChange={updateField} />
        <TextField label="Invoice / job reference" field="invoiceReference" value={form.invoiceReference} onChange={updateField} />
        <FormGridFull>
          <label className="field">
            <span className="field__label">Work completed</span>
            <textarea className="field__input field__textarea" value={form.workCompleted} onChange={(e) => updateField('workCompleted', e.target.value)} rows={3} />
          </label>
        </FormGridFull>
        <FormGridFull>
          <label className="field">
            <span className="field__label">Parts or fluids</span>
            <textarea className="field__input field__textarea" value={form.partsOrFluids} onChange={(e) => updateField('partsOrFluids', e.target.value)} rows={2} />
          </label>
        </FormGridFull>
        <FormGridFull>
          <label className="field">
            <span className="field__label">Recommendations</span>
            <textarea className="field__input field__textarea" value={form.recommendations} onChange={(e) => updateField('recommendations', e.target.value)} rows={2} />
          </label>
        </FormGridFull>
        <DateField value={form.nextServiceDate} onChange={updateField} label="Next service date" field="nextServiceDate" />
        <TextField label="Next service hours" field="nextServiceHours" value={form.nextServiceHours} onChange={updateField} />
        <TextField label="Next service odometer (km)" field="nextServiceOdometer" value={form.nextServiceOdometer} onChange={updateField} />
      </FormGrid>
      <FormActions>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save service record'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </FormActions>
    </form>
  )
}

export function DocumentForm({ initial, equipment = [], onSave, onCancel, saving, saveError }) {
  const [form, setForm] = useState(() => ({ ...createEmptyDocumentRecord(), ...initial }))

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <form className="equipment-form" onSubmit={(e) => { e.preventDefault(); onSave(form) }} noValidate>
      {saveError && <p className="validation-message validation-message--error">{saveError}</p>}
      <FormGrid>
        <FormField label="Machine / equipment" required>
          <EquipmentSelector
            equipment={equipment}
            value={form.equipmentId}
            onChange={(value) => updateField('equipmentId', value)}
            includeManual={false}
          />
        </FormField>
        <FormField label="Document type">
          <input list="document-type-options" className="form-input" value={form.documentType} onChange={(e) => updateField('documentType', e.target.value)} />
          <datalist id="document-type-options">
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </FormField>
        <TextField label="Document title" field="documentTitle" value={form.documentTitle} onChange={updateField} />
        <TextField label="Reference number" field="referenceNumber" value={form.referenceNumber} onChange={updateField} />
        <TextField label="Issuing organisation" field="issuingOrganisation" value={form.issuingOrganisation} onChange={updateField} />
        <DateField value={form.issueDate} onChange={updateField} label="Issue date" field="issueDate" />
        <DateField value={form.expiryDate} onChange={updateField} label="Expiry date" field="expiryDate" />
        <FormGridFull>
          <TextField label="Document location or link" field="documentLocation" value={form.documentLocation} onChange={updateField} />
        </FormGridFull>
        <FormGridFull>
          <NotesField value={form.notes} onChange={updateField} />
        </FormGridFull>
      </FormGrid>
      <FormActions>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save document'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </FormActions>
    </form>
  )
}

export function StatusUpdateForm({ equipment, onSave, onCancel }) {
  const [status, setStatus] = useState(equipment.operationalStatus)
  const [hours, setHours] = useState(equipment.currentHours ?? '')
  const [odometer, setOdometer] = useState(equipment.currentOdometer ?? '')

  return (
    <form
      className="equipment-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ operationalStatus: status, currentHours: hours, currentOdometer: odometer })
      }}
    >
      <FormGrid>
        <SelectField label="Operational status" field="operationalStatus" value={status} onChange={(_, v) => setStatus(v)} options={OPERATIONAL_STATUSES.map((v) => ({ value: v, label: v }))} />
        <TextField label="Current hours" field="currentHours" value={hours} onChange={(_, v) => setHours(v)} />
        <TextField label="Current odometer (km)" field="currentOdometer" value={odometer} onChange={(_, v) => setOdometer(v)} />
      </FormGrid>
      <FormActions>
        <button type="submit" className="btn btn--primary">Update status</button>
        {onCancel && (
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </FormActions>
    </form>
  )
}

export function ServiceUpdatePrompt({ service, onConfirm, onSkip }) {
  return (
    <div className="equipment-prompt">
      <p>Update asset readings from this service record?</p>
      <ul>
        {service.operatingHours && <li>Set current hours to {service.operatingHours}</li>}
        {service.odometer && <li>Set current odometer to {service.odometer} km</li>}
        {service.nextServiceDate && <li>Set next service date to {service.nextServiceDate}</li>}
        {service.nextServiceHours && <li>Set next service hours to {service.nextServiceHours}</li>}
        {service.nextServiceOdometer && <li>Set next service odometer to {service.nextServiceOdometer} km</li>}
      </ul>
      <div className="equipment-prompt__actions">
        <button type="button" className="btn btn--primary" onClick={onConfirm}>Update asset</button>
        <button type="button" className="btn btn--secondary" onClick={onSkip}>Keep current asset values</button>
      </div>
    </div>
  )
}
