/**
 * Driver load / quarry run validation and daily summaries.
 */

export function parseWeightTonnes(value) {
  if (value == null || value === '') return null
  const num = Number(String(value).trim().replace(',', '.'))
  if (!Number.isFinite(num) || num < 0) return null
  return Math.round(num * 1000) / 1000
}

export function formatWeightTonnes(value) {
  const parsed = parseWeightTonnes(value)
  if (parsed == null) return ''
  return String(parsed)
}

/**
 * Auto-calculate net from gross and tare when both present.
 * Returns null if calculation not possible.
 */
export function calculateNetWeightTonnes(gross, tare) {
  const g = parseWeightTonnes(gross)
  const t = parseWeightTonnes(tare)
  if (g == null || t == null) return null
  const net = g - t
  if (net < 0) return null
  return Math.round(net * 1000) / 1000
}

export function createEmptyDriverLoad(overrides = {}) {
  return {
    id: '',
    cloudId: null,
    cloudUserId: null,
    timesheetLocalId: '',
    timesheetCloudId: null,
    dailySheetId: '',
    dailySheetCloudId: null,
    segmentId: '',
    segmentCloudId: null,
    loadDate: '',
    driverName: '',
    jobProjectName: '',
    truckVehicle: '',
    quarrySupplier: '',
    materialProduct: '',
    deliveryDestination: '',
    ticketNumber: '',
    grossWeightTonnes: '',
    tareWeightTonnes: '',
    netWeightTonnes: '',
    netWeightOverridden: false,
    tripStartTime: '',
    deliveryFinishTime: '',
    notes: '',
    ticketImagePath: '',
    ticketImagePreviewUrl: '',
    duplicateTicketFlag: false,
    createdAt: '',
    updatedAt: '',
    syncStatus: null,
    storageSource: 'local',
    ...overrides,
  }
}

export function validateDriverLoad(load) {
  const errors = {}

  if (!load.loadDate?.trim()) errors.loadDate = 'Date is required.'
  if (!load.driverName?.trim()) errors.driverName = 'Driver is required.'
  if (!load.jobProjectName?.trim()) errors.jobProjectName = 'Job / project is required.'
  if (!load.truckVehicle?.trim()) errors.truckVehicle = 'Truck / vehicle is required.'
  if (!load.quarrySupplier?.trim()) errors.quarrySupplier = 'Quarry / supplier is required.'
  if (!load.ticketNumber?.trim()) errors.ticketNumber = 'Ticket number is required.'

  const gross = parseWeightTonnes(load.grossWeightTonnes)
  const tare = parseWeightTonnes(load.tareWeightTonnes)
  let net = parseWeightTonnes(load.netWeightTonnes)

  if (gross != null && tare != null && gross < tare) {
    errors.weights = 'Gross weight must be greater than or equal to tare.'
  }

  if (net == null) {
    const calculated = calculateNetWeightTonnes(load.grossWeightTonnes, load.tareWeightTonnes)
    if (calculated != null) net = calculated
  }

  if (net == null) {
    errors.netWeightTonnes = 'Net weight (tonnes) is required.'
  } else if (net < 0) {
    errors.netWeightTonnes = 'Net weight must be zero or greater.'
  }

  return { errors, netWeightTonnes: net }
}

/** Driver ticket modal — net-only tickets allowed; gross/tare optional */
export function validateDriverTicket(load) {
  const errors = {}

  if (!load.loadDate?.trim()) errors.loadDate = 'Date is required.'
  if (!load.driverName?.trim()) errors.driverName = 'Driver is required.'
  if (!load.truckVehicle?.trim()) errors.truckVehicle = 'Truck / vehicle is required.'
  if (!load.quarrySupplier?.trim()) errors.quarrySupplier = 'Quarry / supplier is required.'

  const gross = parseWeightTonnes(load.grossWeightTonnes)
  const tare = parseWeightTonnes(load.tareWeightTonnes)
  let net = parseWeightTonnes(load.netWeightTonnes)

  if (gross != null && tare != null && gross < tare) {
    errors.weights = 'Gross weight must be greater than or equal to tare.'
  }

  if (net == null) {
    const calculated = calculateNetWeightTonnes(load.grossWeightTonnes, load.tareWeightTonnes)
    if (calculated != null) net = calculated
  }

  if (net == null) {
    errors.netWeightTonnes = 'Net weight (tonnes) is required.'
  } else if (net < 0) {
    errors.netWeightTonnes = 'Net weight must be zero or greater.'
  }

  return { errors, netWeightTonnes: net }
}

export function hasDriverLoadErrors(errors) {
  return Object.keys(errors).length > 0
}

/**
 * Normalize ticket number for duplicate comparison (company-wide scope).
 */
export function normalizeTicketNumberKey(ticketNumber) {
  const key = ticketNumber?.trim().toLowerCase()
  return key || null
}

/**
 * Single source of truth for duplicate ticket detection.
 * Flags loads sharing the same ticket number (case-insensitive trim) within the provided set.
 * Does not remove duplicates — sets duplicateTicketFlag on each.
 */
export function computeDuplicateTicketFlags(loads) {
  const byTicket = new Map()

  loads.forEach((load) => {
    const key = normalizeTicketNumberKey(load.ticketNumber)
    if (!key) return
    if (!byTicket.has(key)) byTicket.set(key, [])
    byTicket.get(key).push(load)
  })

  return loads.map((load) => {
    const key = normalizeTicketNumberKey(load.ticketNumber)
    const dupes = key ? byTicket.get(key) : null
    return { ...load, duplicateTicketFlag: Boolean(dupes && dupes.length > 1) }
  })
}

/** @deprecated Use computeDuplicateTicketFlags — kept for existing imports */
export function flagDuplicateTicketNumbers(loads) {
  return computeDuplicateTicketFlags(loads)
}

/**
 * Resolve duplicate flag for one load against a peer set (e.g. before save).
 */
export function resolveDuplicateFlagForLoad(load, peerLoads) {
  const key = normalizeTicketNumberKey(load.ticketNumber)
  if (!key) return false
  const count = peerLoads.filter((peer) => normalizeTicketNumberKey(peer.ticketNumber) === key).length
  return count > 1
}

/**
 * Apply company-wide duplicate flag to a load using the full peer set.
 */
export function applyDuplicateFlagToLoad(load, allLoads) {
  return {
    ...load,
    duplicateTicketFlag: resolveDuplicateFlagForLoad(load, allLoads),
  }
}

function sumNetTonnes(loads) {
  return loads.reduce((sum, load) => {
    const net = parseWeightTonnes(load.netWeightTonnes)
    return sum + (net ?? 0)
  }, 0)
}

function groupSumBy(loads, field) {
  const groups = new Map()
  loads.forEach((load) => {
    const key = load[field]?.trim() || '—'
    const net = parseWeightTonnes(load.netWeightTonnes) ?? 0
    groups.set(key, (groups.get(key) ?? 0) + net)
  })
  return [...groups.entries()]
    .map(([label, tonnes]) => ({ label, tonnes: Math.round(tonnes * 1000) / 1000 }))
    .sort((a, b) => b.tonnes - a.tonnes)
}

function earliestTime(loads, field) {
  const times = loads.map((l) => l[field]?.trim()).filter(Boolean)
  if (!times.length) return ''
  return times.sort()[0]
}

function latestTime(loads, field) {
  const times = loads.map((l) => l[field]?.trim()).filter(Boolean)
  if (!times.length) return ''
  return times.sort().at(-1)
}

/** Daily summary for driver view — uses persisted duplicateTicketFlag on each load */
export function computeDailyLoadSummary(loads) {
  const flagged = loads
  const totalTrips = flagged.length
  const totalNetTonnes = Math.round(sumNetTonnes(flagged) * 1000) / 1000

  return {
    loads: flagged,
    totalTrips,
    totalNetTonnes,
    byMaterial: groupSumBy(flagged, 'materialProduct'),
    byQuarry: groupSumBy(flagged, 'quarrySupplier'),
    byJob: groupSumBy(flagged, 'jobProjectName'),
    firstTripTime: earliestTime(flagged, 'tripStartTime'),
    finalTripTime: latestTime(flagged, 'deliveryFinishTime'),
    duplicateTicketCount: flagged.filter((l) => l.duplicateTicketFlag).length,
  }
}

/** Date-range totals for admin */
export function computeLoadRangeTotals(loads) {
  const summary = computeDailyLoadSummary(loads)
  const byDate = new Map()

  loads.forEach((load) => {
    const date = load.loadDate || '—'
    if (!byDate.has(date)) {
      byDate.set(date, { date, trips: 0, netTonnes: 0 })
    }
    const entry = byDate.get(date)
    entry.trips += 1
    entry.netTonnes += parseWeightTonnes(load.netWeightTonnes) ?? 0
  })

  const daily = [...byDate.values()]
    .map((d) => ({ ...d, netTonnes: Math.round(d.netTonnes * 1000) / 1000 }))
    .sort((a, b) => b.date.localeCompare(a.date))

  return { ...summary, daily }
}
