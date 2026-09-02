import {
  DRIVER_LAST_TRUCK_KEY,
  DRIVER_RECENT_JOBS_KEY,
  DRIVER_RECENT_QUARRIES_KEY,
} from '../constants/storageKeys.js'

const MAX_RECENT = 8

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function getLastTruck() {
  try {
    return localStorage.getItem(DRIVER_LAST_TRUCK_KEY) || ''
  } catch {
    return ''
  }
}

export function setLastTruck(truck) {
  try {
    if (truck?.trim()) localStorage.setItem(DRIVER_LAST_TRUCK_KEY, truck.trim())
  } catch {
    /* ignore */
  }
}

export function getRecentJobs() {
  const list = readJson(DRIVER_RECENT_JOBS_KEY, [])
  return Array.isArray(list) ? list.filter(Boolean) : []
}

export function rememberRecentJob(jobName) {
  const name = jobName?.trim()
  if (!name) return
  const current = getRecentJobs()
  const next = [name, ...current.filter((item) => item !== name)].slice(0, MAX_RECENT)
  writeJson(DRIVER_RECENT_JOBS_KEY, next)
}

export function getRecentQuarries() {
  const list = readJson(DRIVER_RECENT_QUARRIES_KEY, [])
  return Array.isArray(list) ? list.filter(Boolean) : []
}

export function rememberRecentQuarry(quarry) {
  const name = quarry?.trim()
  if (!name) return
  const current = getRecentQuarries()
  const next = [name, ...current.filter((item) => item !== name)].slice(0, MAX_RECENT)
  writeJson(DRIVER_RECENT_QUARRIES_KEY, next)
}
