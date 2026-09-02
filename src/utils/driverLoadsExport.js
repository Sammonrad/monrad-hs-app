import { downloadFile } from './export.js'
import { parseWeightTonnes } from './driverLoads.js'

function escapeCsv(value) {
  const str = value == null ? '' : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const CSV_COLUMNS = [
  { key: 'loadDate', header: 'Date' },
  { key: 'driverName', header: 'Driver' },
  { key: 'jobProjectName', header: 'Job / Project' },
  { key: 'truckVehicle', header: 'Truck / Vehicle' },
  { key: 'quarrySupplier', header: 'Quarry / Supplier' },
  { key: 'materialProduct', header: 'Material / Product' },
  { key: 'deliveryDestination', header: 'Delivery Destination' },
  { key: 'ticketNumber', header: 'Ticket Number' },
  { key: 'grossWeightTonnes', header: 'Gross (t)' },
  { key: 'tareWeightTonnes', header: 'Tare (t)' },
  { key: 'netWeightTonnes', header: 'Net (t)' },
  { key: 'tripStartTime', header: 'Trip Start' },
  { key: 'deliveryFinishTime', header: 'Delivery Finish' },
  { key: 'notes', header: 'Notes' },
  { key: 'duplicateTicketFlag', header: 'Duplicate Ticket Flag' },
  { key: 'timesheetCloudId', header: 'Timesheet ID' },
  { key: 'createdAt', header: 'Created At' },
]

export function buildDriverLoadsCsv(loads) {
  const header = CSV_COLUMNS.map((col) => escapeCsv(col.header)).join(',')
  const rows = loads.map((load) =>
    CSV_COLUMNS.map((col) => {
      let value = load[col.key]
      if (col.key === 'duplicateTicketFlag') value = value ? 'Yes' : 'No'
      if (
        col.key === 'grossWeightTonnes' ||
        col.key === 'tareWeightTonnes' ||
        col.key === 'netWeightTonnes'
      ) {
        const parsed = parseWeightTonnes(value)
        value = parsed != null ? parsed : ''
      }
      return escapeCsv(value)
    }).join(','),
  )
  return [header, ...rows].join('\n')
}

export function exportDriverLoadsCsv(loads, filenamePrefix = 'driver-loads') {
  const csv = buildDriverLoadsCsv(loads)
  const date = new Date().toISOString().slice(0, 10)
  downloadFile(csv, `${filenamePrefix}-${date}.csv`, 'text/csv;charset=utf-8')
}
