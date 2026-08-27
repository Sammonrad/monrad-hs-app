import { SSSP_EDITOR_DRAFT_KEY } from '../../constants/storageKeys.js'
import { normalizeSsspRecord, syncIndexedFieldsFromRecordData } from './ssspStorage.js'

/** Debounce delay for local SSSP autosave (ms). */
export const SSSP_DRAFT_AUTOSAVE_MS = 850

const DRAFT_KEY_PREFIX = 'monrad_hs_sssp_draft_'

/**
 * Build a user-scoped localStorage key for New SSSP drafts.
 * @param {string} userId
 * @param {string} [siteOrJobId]
 */
export function getDraftKey(userId, siteOrJobId) {
  if (!userId) return null
  const base = `${DRAFT_KEY_PREFIX}${userId}`
  if (siteOrJobId) return `${base}_${siteOrJobId}`
  return base
}

function safeParse(raw) {
  try {
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function safeSerialize(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

function normalizeDraftPayload(parsed, userId) {
  if (!parsed || typeof parsed !== 'object') return null
  const recordSource = parsed.record ?? parsed
  if (!recordSource || typeof recordSource !== 'object') return null

  return {
    userId: parsed.userId ?? recordSource.preparedByUserId ?? userId ?? null,
    record: normalizeSsspRecord(recordSource),
    savedAt: parsed.savedAt ?? null,
    sectionId: parsed.sectionId ?? 'documentControl',
  }
}

function readLegacyDraft() {
  try {
    return safeParse(localStorage.getItem(SSSP_EDITOR_DRAFT_KEY))
  } catch {
    return null
  }
}

function removeLegacyDraft() {
  try {
    localStorage.removeItem(SSSP_EDITOR_DRAFT_KEY)
  } catch {
    // ignore
  }
}

/**
 * Load a New SSSP local draft for the authenticated user.
 * Migrates a legacy shared-key draft only when ownership matches userId.
 */
export function loadDraft(userId, siteOrJobId) {
  if (!userId) return null

  const key = getDraftKey(userId, siteOrJobId)
  if (!key) return null

  try {
    const fromUserKey = normalizeDraftPayload(safeParse(localStorage.getItem(key)), userId)
    if (fromUserKey?.record && fromUserKey.userId === userId) {
      return fromUserKey
    }

    const legacy = normalizeDraftPayload(readLegacyDraft(), userId)
    if (
      legacy?.record &&
      legacy.userId === userId &&
      legacy.record.preparedByUserId === userId
    ) {
      saveDraft(userId, {
        record: legacy.record,
        sectionId: legacy.sectionId,
        savedAt: legacy.savedAt,
      }, siteOrJobId)
      removeLegacyDraft()
      return loadDraft(userId, siteOrJobId)
    }

    return null
  } catch {
    return null
  }
}

/**
 * Persist a New SSSP local draft for the authenticated user.
 * Does not write to Supabase.
 */
export function saveDraft(userId, { record, sectionId = 'documentControl', savedAt } = {}, siteOrJobId) {
  if (!userId || !record) return false

  const key = getDraftKey(userId, siteOrJobId)
  if (!key) return false

  const payload = {
    userId,
    record: syncIndexedFieldsFromRecordData(record),
    sectionId,
    savedAt: savedAt ?? new Date().toISOString(),
  }

  const serialized = safeSerialize(payload)
  if (!serialized) return false

  try {
    localStorage.setItem(key, serialized)
    // Avoid leaving a shared legacy draft that another user could pick up.
    removeLegacyDraft()
    return true
  } catch {
    return false
  }
}

/**
 * Remove the New SSSP local draft for the authenticated user.
 */
export function clearDraft(userId, siteOrJobId) {
  if (!userId) return false

  const key = getDraftKey(userId, siteOrJobId)
  if (!key) return false

  try {
    localStorage.removeItem(key)
    removeLegacyDraft()
    return true
  } catch {
    return false
  }
}

/**
 * Whether a local New SSSP draft exists for this user.
 */
export function hasDraft(userId, siteOrJobId) {
  return Boolean(loadDraft(userId, siteOrJobId)?.record)
}
