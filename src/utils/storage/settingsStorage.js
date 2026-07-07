import { SETTINGS_STORAGE_KEY, MACHINE_TYPES } from '../../constants/index.js'
import { createRecordId } from '../ids.js'

export function createEmptySettings() {
  return { operators: [], machines: [], sites: [] }
}

export function normalizeSettings(data) {
  return {
    operators: Array.isArray(data?.operators)
      ? data.operators
          .map((item) => ({ id: item.id ?? createRecordId(), name: item.name ?? '' }))
          .filter((item) => item.name.trim())
      : [],
    machines: Array.isArray(data?.machines)
      ? data.machines
          .map((item) => ({
            id: item.id ?? createRecordId(),
            name: item.name ?? '',
            type: MACHINE_TYPES.includes(item.type) ? item.type : 'Other',
          }))
          .filter((item) => item.name.trim())
      : [],
    sites: Array.isArray(data?.sites)
      ? data.sites
          .map((item) => ({ id: item.id ?? createRecordId(), name: item.name ?? '' }))
          .filter((item) => item.name.trim())
      : [],
  }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return createEmptySettings()
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return createEmptySettings()
  }
}

export function persistSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    return true
  } catch {
    window.alert('Could not save settings to this device.')
    return false
  }
}

export function getSettingsOptions(settings) {
  return {
    operators: settings.operators.map((item) => item.name),
    machines: settings.machines.map((item) => item.name),
    sites: settings.sites.map((item) => item.name),
  }
}
