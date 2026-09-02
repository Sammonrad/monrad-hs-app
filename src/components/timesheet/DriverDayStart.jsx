import { formatNzLongDate } from '../../utils/formatting.js'
import { getSettingsOptions } from '../../utils/storage/settingsStorage.js'
import { getLastTruck } from '../../utils/driverLocalPrefs.js'

export function DriverDayStart({
  driverName,
  sheetDate,
  truckVehicle,
  onTruckChange,
  onStart,
  starting = false,
  settings,
}) {
  const comboOptions = getSettingsOptions(settings)
  const trucks = comboOptions.machines ?? []

  return (
    <div className="driver-day-start">
      <header className="driver-day-start__header">
        <p className="driver-day-start__driver">{driverName}</p>
        <p className="driver-day-start__date">{formatNzLongDate(sheetDate)}</p>
      </header>

      <label className="driver-day-field">
        <span className="driver-day-field__label">Truck / vehicle</span>
        <select
          className="driver-day-field__input driver-day-field__input--large"
          value={truckVehicle || getLastTruck()}
          onChange={(e) => onTruckChange(e.target.value)}
          aria-label="Select truck"
        >
          <option value="">Select truck…</option>
          {trucks.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
          {truckVehicle && !trucks.includes(truckVehicle) && (
            <option value={truckVehicle}>{truckVehicle}</option>
          )}
        </select>
      </label>

      <button
        type="button"
        className="driver-day-btn driver-day-btn--primary driver-day-btn--block"
        onClick={onStart}
        disabled={starting || !truckVehicle?.trim()}
      >
        {starting ? 'Starting day…' : 'Start Day'}
      </button>
    </div>
  )
}
