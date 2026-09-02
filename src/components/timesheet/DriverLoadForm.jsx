import { useEffect, useMemo, useState } from 'react'
import { Camera, ImagePlus, Loader2 } from 'lucide-react'
import { FormField } from '../forms/FormField.jsx'
import { FormGrid } from '../layout/FormGrid.jsx'
import {
  ComboField,
  TextField,
  DateField,
  NotesField,
  TimeField,
} from '../FormFields.jsx'
import { compressImage } from '../../utils/image.js'
import { extractQuarryTicketFields } from '../../utils/quarryTicketOcr.js'
import {
  calculateNetWeightTonnes,
  createEmptyDriverLoad,
  formatWeightTonnes,
  hasDriverLoadErrors,
  validateDriverLoad,
  validateDriverTicket,
} from '../../utils/driverLoads.js'

export function DriverLoadForm({
  load: initialLoad,
  defaults = {},
  comboOptions = {},
  onSave,
  onCancel,
  saving = false,
  submitLabel = 'Save load',
  ticketOnly = false,
}) {
  const [load, setLoad] = useState(() =>
    createEmptyDriverLoad({
      ...createEmptyDriverLoad(),
      ...defaults,
      ...initialLoad,
    }),
  )
  const [errors, setErrors] = useState({})
  const [ocrMessage, setOcrMessage] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)

  useEffect(() => {
    setLoad(
      createEmptyDriverLoad({
        ...createEmptyDriverLoad(),
        ...defaults,
        ...initialLoad,
      }),
    )
    setErrors({})
    setOcrMessage('')
  }, [initialLoad?.id, defaults, initialLoad])

  const suggestedNet = useMemo(() => {
    if (load.netWeightOverridden) return null
    return calculateNetWeightTonnes(load.grossWeightTonnes, load.tareWeightTonnes)
  }, [load.grossWeightTonnes, load.tareWeightTonnes, load.netWeightOverridden])

  useEffect(() => {
    if (load.netWeightOverridden || suggestedNet == null) return
    setLoad((prev) => ({
      ...prev,
      netWeightTonnes: formatWeightTonnes(suggestedNet),
    }))
  }, [suggestedNet, load.netWeightOverridden])

  function updateField(field, value) {
    setErrors((prev) => ({ ...prev, [field]: undefined, weights: undefined }))
    setLoad((prev) => ({ ...prev, [field]: value }))
  }

  function updateWeightField(field, value) {
    setErrors((prev) => ({ ...prev, [field]: undefined, weights: undefined, netWeightTonnes: undefined }))
    setLoad((prev) => ({
      ...prev,
      [field]: value,
      netWeightOverridden: field === 'netWeightTonnes' ? true : prev.netWeightOverridden,
    }))
  }

  async function handleImageFile(file) {
    if (!file) return
    setUploadProgress(0)
    try {
      const dataUrl = await compressImage(file, 1200, 0.75)
      setLoad((prev) => ({
        ...prev,
        ticketImagePreviewUrl: dataUrl,
      }))
      setUploadProgress(100)

      setOcrLoading(true)
      setOcrMessage('')
      const ocr = await extractQuarryTicketFields(dataUrl)
      setOcrLoading(false)
      setOcrMessage(ocr.message)

      if (ocr.suggested) {
        setLoad((prev) => ({
          ...prev,
          ticketNumber: ocr.suggested.ticketNumber || prev.ticketNumber,
          loadDate: ocr.suggested.date || prev.loadDate,
          tripStartTime: ocr.suggested.time || prev.tripStartTime,
          grossWeightTonnes: ocr.suggested.grossWeightTonnes || prev.grossWeightTonnes,
          tareWeightTonnes: ocr.suggested.tareWeightTonnes || prev.tareWeightTonnes,
          netWeightTonnes: ocr.suggested.netWeightTonnes || prev.netWeightTonnes,
          quarrySupplier: ocr.suggested.quarrySupplier || prev.quarrySupplier,
          materialProduct: ocr.suggested.materialProduct || prev.materialProduct,
          netWeightOverridden: Boolean(ocr.suggested.netWeightTonnes),
        }))
      }
    } catch {
      window.alert('Could not process the image. Try another photo.')
    } finally {
      setUploadProgress(null)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const validateFn = ticketOnly ? validateDriverTicket : validateDriverLoad
    const { errors: validationErrors, netWeightTonnes } = validateFn(load)
    if (hasDriverLoadErrors(validationErrors)) {
      setErrors(validationErrors)
      return
    }
    onSave({
      ...load,
      netWeightTonnes: formatWeightTonnes(netWeightTonnes),
      grossWeightTonnes: formatWeightTonnes(load.grossWeightTonnes) || '',
      tareWeightTonnes: formatWeightTonnes(load.tareWeightTonnes) || '',
    })
  }

  const previewUrl = load.ticketImagePreviewUrl

  return (
    <form className="driver-load-form" onSubmit={handleSubmit} noValidate>
      <div className="driver-load-form__photo">
        <span className="field__label">Weighbridge ticket photo</span>
        {previewUrl ? (
          <div className="driver-load-form__preview">
            <img src={previewUrl} alt="Weighbridge ticket preview" />
            <button
              type="button"
              className="btn btn--secondary btn--small"
              onClick={() =>
                setLoad((prev) => ({
                  ...prev,
                  ticketImagePreviewUrl: '',
                  ticketImagePath: '',
                }))
              }
            >
              Replace photo
            </button>
          </div>
        ) : (
          <div className="driver-load-form__photo-actions">
            <label className="driver-load-form__photo-btn">
              <Camera size={20} aria-hidden="true" />
              Take photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="photos__input"
                onChange={(e) => handleImageFile(e.target.files?.[0])}
              />
            </label>
            <label className="driver-load-form__photo-btn">
              <ImagePlus size={20} aria-hidden="true" />
              Upload image
              <input
                type="file"
                accept="image/*"
                className="photos__input"
                onChange={(e) => handleImageFile(e.target.files?.[0])}
              />
            </label>
          </div>
        )}
        {uploadProgress != null && (
          <p className="form-hint" role="status">
            Processing image… {uploadProgress}%
          </p>
        )}
        {ocrLoading && (
          <p className="form-hint" role="status">
            <Loader2 className="driver-load-form__spinner" size={14} aria-hidden="true" />
            Reading ticket…
          </p>
        )}
        {ocrMessage && !ocrLoading && (
          <p className="form-hint" role="status">
            {ocrMessage}
          </p>
        )}
      </div>

      <FormGrid>
        {!ticketOnly && (
          <FormField label="Date" fieldId="loadDate" required error={errors.loadDate}>
            <DateField
              label=""
              field="loadDate"
              value={load.loadDate}
              onChange={updateField}
            />
          </FormField>
        )}
        {!ticketOnly && (
          <FormField label="Driver" fieldId="driverName" required error={errors.driverName}>
            <ComboField
              label=""
              field="driverName"
              value={load.driverName}
              onChange={updateField}
              placeholder="Driver name"
              options={comboOptions.operators ?? []}
              listId="driver-load-operators"
            />
          </FormField>
        )}
        {!ticketOnly && (
          <FormField label="Job / project" fieldId="jobProjectName" required error={errors.jobProjectName}>
            <TextField
              label=""
              field="jobProjectName"
              value={load.jobProjectName}
              onChange={updateField}
              placeholder="Job or project"
            />
          </FormField>
        )}
        {!ticketOnly && (
          <FormField label="Truck / vehicle" fieldId="truckVehicle" required error={errors.truckVehicle}>
            <ComboField
              label=""
              field="truckVehicle"
              value={load.truckVehicle}
              onChange={updateField}
              placeholder="e.g. Truck 01"
              options={comboOptions.machines ?? []}
              listId="driver-load-trucks"
            />
          </FormField>
        )}
        <FormField label="Quarry / supplier" fieldId="quarrySupplier" required error={errors.quarrySupplier}>
          <TextField
            label=""
            field="quarrySupplier"
            value={load.quarrySupplier}
            onChange={updateField}
            placeholder="Quarry or supplier name"
          />
        </FormField>
        <TextField
          label="Material / product"
          field="materialProduct"
          value={load.materialProduct}
          onChange={updateField}
          placeholder="e.g. Gap 40"
        />
        <TextField
          label="Delivery destination"
          field="deliveryDestination"
          value={load.deliveryDestination}
          onChange={updateField}
          placeholder="Site or delivery address"
        />
        <FormField label="Ticket number" fieldId="ticketNumber" required={!ticketOnly} error={errors.ticketNumber}>
          <TextField
            label=""
            field="ticketNumber"
            value={load.ticketNumber}
            onChange={updateField}
            placeholder="Weighbridge ticket #"
          />
        </FormField>
        <FormField label="Gross weight (t)" fieldId="grossWeightTonnes" error={errors.weights}>
          <input
            className="field__input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            value={load.grossWeightTonnes}
            onChange={(e) => updateWeightField('grossWeightTonnes', e.target.value)}
            placeholder="0.000"
          />
        </FormField>
        <FormField label="Tare weight (t)" fieldId="tareWeightTonnes" error={errors.weights}>
          <input
            className="field__input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            value={load.tareWeightTonnes}
            onChange={(e) => updateWeightField('tareWeightTonnes', e.target.value)}
            placeholder="0.000"
          />
        </FormField>
        <FormField label="Net weight (t)" fieldId="netWeightTonnes" required error={errors.netWeightTonnes}>
          <input
            className="field__input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            value={load.netWeightTonnes}
            onChange={(e) => updateWeightField('netWeightTonnes', e.target.value)}
            placeholder="0.000"
          />
        </FormField>
        <TimeField
          label="Trip / start time"
          field="tripStartTime"
          value={load.tripStartTime}
          onChange={updateField}
          ariaLabel="Trip start time"
        />
        <TimeField
          label="Delivery / finish time"
          field="deliveryFinishTime"
          value={load.deliveryFinishTime}
          onChange={updateField}
          ariaLabel="Delivery finish time"
        />
      </FormGrid>

      <NotesField value={load.notes} onChange={updateField} />

      <div className="driver-load-form__actions">
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
