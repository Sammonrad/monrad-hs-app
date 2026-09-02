import { supabase, isSupabaseConfigured } from '../supabaseClient.js'

export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
}

export const STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  DISABLED: 'disabled',
}

export const TIMESHEET_TYPES = {
  STANDARD: 'standard',
  DRIVER: 'driver',
}

export function getProfileTimesheetType(profile) {
  if (profile?.timesheet_type === TIMESHEET_TYPES.DRIVER) return TIMESHEET_TYPES.DRIVER
  return TIMESHEET_TYPES.STANDARD
}

export function getTimesheetTypeLabel(profile) {
  return getProfileTimesheetType(profile) === TIMESHEET_TYPES.DRIVER
    ? 'Driver daily sheet'
    : 'Standard timesheet'
}

export function isDriverTimesheetProfile(profile) {
  return getProfileTimesheetType(profile) === TIMESHEET_TYPES.DRIVER
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

export function getProfileStatus(profile) {
  if (profile?.status === STATUS.ACTIVE) return STATUS.ACTIVE
  if (profile?.status === STATUS.DISABLED) return STATUS.DISABLED
  return STATUS.PENDING
}

export function getStatusLabel(profile) {
  const status = getProfileStatus(profile)
  if (status === STATUS.ACTIVE) return 'Active'
  if (status === STATUS.DISABLED) return 'Disabled'
  return 'Pending'
}

export function isProfileAccessAllowed(profile) {
  if (isAdminProfile(profile)) return true
  return getProfileStatus(profile) === STATUS.ACTIVE
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
    status: STATUS.PENDING,
    phone: '',
    notes: '',
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
  if (updates.status !== undefined) payload.status = updates.status
  if (updates.phone !== undefined) payload.phone = updates.phone.trim()
  if (updates.notes !== undefined) payload.notes = updates.notes.trim()
  if (updates.timesheet_type !== undefined) {
    const type = updates.timesheet_type
    if (type === TIMESHEET_TYPES.DRIVER || type === TIMESHEET_TYPES.STANDARD) {
      payload.timesheet_type = type
    }
  }

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
