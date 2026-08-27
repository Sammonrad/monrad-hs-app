import { SSSP_EDITOR_DRAFT_KEY } from '../../constants/storageKeys.js'
import { SYNC_STATUS } from './cloudSyncStatus.js'
import { normalizeSsspRecord, syncIndexedFieldsFromRecordData } from './ssspStorage.js'

/** Debounce delay for local SSSP autosave (ms). */
export const SSSP_DRAFT_AUTOSAVE_MS = 850

/** User-facing label for unsynced browser drafts on the SSSP list. */
export const LOCAL_DRAFT_LIST_LABEL = 'Local draft — not synced'

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

function isDraftKeyForUser(key, userId) {
  if (!key || !userId) return false
  const base = `${DRAFT_KEY_PREFIX}${userId}`
  return key === base || key.startsWith(`${base}_`)
}

function siteOrJobIdFromKey(key, userId) {
  const base = `${DRAFT_KEY_PREFIX}${userId}`
  if (key === base) return null
  if (key.startsWith(`${base}_`)) return key.slice(base.length + 1) || null
  return null
}

function toTimestampMs(value) {
  if (!value) return 0
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : 0
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

/**
 * Non-destructive: list all local SSSP drafts owned by the given user.
 * Scans keys `monrad_hs_sssp_draft_<userId>` and `monrad_hs_sssp_draft_<userId>_*`.
 * Does not migrate, clear, or rewrite stored payloads.
 */
export function listLocalDrafts(userId) {
  if (!userId || typeof localStorage === 'undefined') return []

  const results = []

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!isDraftKeyForUser(key, userId)) continue

      const payload = normalizeDraftPayload(safeParse(localStorage.getItem(key)), userId)
      if (!payload?.record || payload.userId !== userId) continue

      results.push({
        key,
        siteOrJobId: siteOrJobIdFromKey(key, userId),
        userId: payload.userId,
        record: payload.record,
        sectionId: payload.sectionId ?? 'documentControl',
        savedAt: payload.savedAt ?? null,
      })
    }
  } catch {
    return results
  }

  return results.sort(
    (a, b) => toTimestampMs(b.savedAt) - toTimestampMs(a.savedAt),
  )
}

/**
 * Compare a local draft to cloud rows with the same SSSP number.
 * Does not overwrite either side — returns conflict metadata for UI only.
 */
export function resolveLocalDraftConflict(localRecord, localSavedAt, cloudRecords = []) {
  const number = localRecord?.ssspNumber?.trim()
  if (!number) return null

  const match = cloudRecords.find(
    (row) =>
      !row?.isLocalDraft &&
      typeof row?.ssspNumber === 'string' &&
      row.ssspNumber.trim() === number,
  )
  if (!match) return null

  const localTs = toTimestampMs(localSavedAt || localRecord.updatedAt)
  const cloudTs = toTimestampMs(match.updatedAt)
  let comparison = 'same'
  if (localTs > cloudTs) comparison = 'local_newer'
  else if (cloudTs > localTs) comparison = 'cloud_newer'

  return {
    cloudId: match.cloudId ?? match.id ?? null,
    cloudUpdatedAt: match.updatedAt ?? null,
    comparison,
  }
}

/**
 * Map a local draft entry to a dashboard list record (storageSource local).
 */
export function draftToListRecord(draftEntry, cloudRecords = []) {
  if (!draftEntry?.record) return null

  const record = normalizeSsspRecord(draftEntry.record)
  const savedAt = draftEntry.savedAt ?? record.updatedAt ?? null
  const conflict = resolveLocalDraftConflict(record, savedAt, cloudRecords)

  return {
    ...record,
    id: record.id || `local-draft:${draftEntry.key}`,
    cloudId: null,
    storageSource: 'local',
    syncStatus: SYNC_STATUS.LOCAL_ONLY,
    isLocalDraft: true,
    localDraftKey: draftEntry.key,
    localDraftSiteOrJobId: draftEntry.siteOrJobId ?? null,
    localDraftSavedAt: savedAt,
    localDraftSectionId: draftEntry.sectionId ?? 'documentControl',
    localDraftConflict: conflict,
    updatedAt: savedAt ?? record.updatedAt,
  }
}

export function getLocalDraftConflictNote(conflict) {
  if (!conflict) return null
  if (conflict.comparison === 'local_newer') {
    return 'This local draft is newer than the cloud copy — continue here to avoid losing work.'
  }
  if (conflict.comparison === 'cloud_newer') {
    return 'A cloud copy exists and may be newer — open carefully; local draft is kept until cloud save succeeds.'
  }
  return 'A cloud copy exists with the same SSSP number — local draft is kept until cloud save succeeds.'
}
