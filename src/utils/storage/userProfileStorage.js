import { supabase, isSupabaseConfigured } from '../supabaseClient.js'

export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
}

export function getProfileRole(profile) {
  if (profile?.role === ROLES.ADMIN) return ROLES.ADMIN
  return ROLES.STAFF
}

export function isAdminProfile(profile) {
  return getProfileRole(profile) === ROLES.ADMIN
}

export function getRoleLabel(profile) {
  return isAdminProfile(profile) ? 'Admin' : 'Staff'
}

function defaultFullNameFromEmail(email) {
  if (!email) return ''
  const local = email.split('@')[0] ?? ''
  return local.replace(/[._-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export async function loadOrCreateProfile(user) {
  if (!isSupabaseConfigured || !supabase || !user?.id) {
    return { profile: null, error: null }
  }

  const { data: existing, error: fetchError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (fetchError) {
    return { profile: null, error: fetchError }
  }

  if (existing) {
    return { profile: existing, error: null }
  }

  const newProfile = {
    id: user.id,
    email: user.email ?? '',
    full_name: defaultFullNameFromEmail(user.email) || '',
    role: ROLES.STAFF,
  }

  const { data: created, error: createError } = await supabase
    .from('user_profiles')
    .insert(newProfile)
    .select()
    .single()

  if (createError) {
    return { profile: null, error: createError }
  }

  return { profile: created, error: null }
}

export async function fetchAllProfiles() {
  if (!isSupabaseConfigured || !supabase) {
    return { profiles: [], error: null }
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at')

  if (error) {
    return { profiles: [], error }
  }

  return { profiles: data ?? [], error: null }
}

export async function updateProfile(userId, updates) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { profile: null, error: new Error('Supabase is not configured.') }
  }

  const payload = {}
  if (updates.full_name !== undefined) payload.full_name = updates.full_name.trim()
  if (updates.role !== undefined) payload.role = updates.role

  const { data, error } = await supabase
    .from('user_profiles')
    .update(payload)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    return { profile: null, error }
  }

  return { profile: data, error: null }
}
