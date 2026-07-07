import { STORAGE_KEY } from '../../constants/storageKeys.js'
import { normalizeRecord } from '../records.js'

export function loadSavedRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeRecord) : []
  } catch {
    return []
  }
}

export function persistSavedRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    return true
  } catch (error) {
    if (error?.name === 'QuotaExceededError') {
      window.alert(
        'Could not save — device storage is full. Try clearing old records or using fewer photos (max 3 per record, compressed).',
      )
    } else {
      window.alert('Could not save record to this device.')
    }
    return false
  }
}
