import { supabase, isSupabaseConfigured } from '../supabaseClient.js'
import { SSSP_STATUS } from '../../constants/ssspStatuses.js'

export function generateSsspNumber(year = new Date().getFullYear()) {
  const seq = String(Math.floor(Math.random() * 900) + 100)
  return `SSSP-${year}-${seq}`
}

export async function checkSsspNumberUnique(ssspNumber, excludeCloudId = null) {
  if (!ssspNumber?.trim()) {
    return { unique: false, error: 'SSSP number is required.' }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { unique: true, error: null }
  }

  let query = supabase
    .from('sssp_records')
    .select('id')
    .eq('sssp_number', ssspNumber.trim())
    .limit(1)

  if (excludeCloudId) {
    query = query.neq('id', excludeCloudId)
  }

  const { data, error } = await query

  if (error) {
    return { unique: false, error: error.message }
  }

  return { unique: !data?.length, error: null }
}

export async function suggestNextSsspNumber(existingNumbers = []) {
  const year = new Date().getFullYear()
  const prefix = `SSSP-${year}-`

  const usedSeq = new Set(
    existingNumbers
      .filter((n) => n?.startsWith(prefix))
      .map((n) => parseInt(n.slice(prefix.length), 10))
      .filter((n) => !Number.isNaN(n)),
  )

  for (let i = 1; i <= 999; i += 1) {
    const candidate = `${prefix}${String(i).padStart(3, '0')}`
    if (!usedSeq.has(i)) {
      const { unique } = await checkSsspNumberUnique(candidate)
      if (unique) return candidate
    }
  }

  return generateSsspNumber(year)
}

export function validateSsspNumberFormat(ssspNumber) {
  if (!ssspNumber?.trim()) return 'SSSP number is required.'
  if (!/^SSSP-\d{4}-\d{3,}$/.test(ssspNumber.trim())) {
    return 'SSSP number must match format SSSP-YYYY-NNN (e.g. SSSP-2026-001).'
  }
  return null
}
