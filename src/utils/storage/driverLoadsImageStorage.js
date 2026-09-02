import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { DRIVER_LOAD_TICKETS_BUCKET } from './driverLoadsCloudStorage.js'

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = header.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const binary = atob(base64)
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i)
  }
  return new Blob([array], { type: mime })
}

export function buildDriverTicketStoragePath(userId, loadId) {
  return `${userId}/${loadId}.jpg`
}

export async function uploadDriverTicketImage(userId, loadId, dataUrl, { onProgress } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { path: null, error: new Error('Supabase is not configured.') }
  }
  if (!userId || !loadId || !dataUrl) {
    return { path: null, error: new Error('Missing image upload parameters.') }
  }

  const path = buildDriverTicketStoragePath(userId, loadId)
  const blob = dataUrlToBlob(dataUrl)

  if (onProgress) onProgress(10)

  const { error } = await supabase.storage.from(DRIVER_LOAD_TICKETS_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600',
  })

  if (onProgress) onProgress(100)

  if (error) {
    return { path: null, error }
  }

  return { path, error: null }
}

export async function getDriverTicketSignedUrl(path, expiresIn = 3600) {
  if (!isSupabaseConfigured || !supabase || !path) {
    return { url: null, error: null }
  }

  const { data, error } = await supabase.storage
    .from(DRIVER_LOAD_TICKETS_BUCKET)
    .createSignedUrl(path, expiresIn)

  if (error) return { url: null, error }
  return { url: data?.signedUrl ?? null, error: null }
}

export async function deleteDriverTicketImage(path) {
  if (!isSupabaseConfigured || !supabase || !path) {
    return { ok: true, error: null }
  }

  const { error } = await supabase.storage.from(DRIVER_LOAD_TICKETS_BUCKET).remove([path])
  if (error) return { ok: false, error }
  return { ok: true, error: null }
}
