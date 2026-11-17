import { supabase } from './supabase'

// Account actions shared by the Recruiters and Team access pages.
// Each returns { error } like a supabase call.

export const listAccounts = () => supabase.rpc('bt_accounts')

export const hasRole = (a) => a.is_admin || a.recruiter_active
export const accountStatus = (a) => (a.blocked ? 'deactivated' : !a.confirmed ? 'unconfirmed' : hasRole(a) ? 'approved' : 'pending')
export const displayName = (a) => a.full_name || a.email.split('@')[0]

export const approveAsRecruiter = (a) =>
  a.recruiter_id
    ? supabase.from('bt_recruiters').update({ active: true }).eq('id', a.recruiter_id)
    : supabase.from('bt_recruiters').insert({ name: displayName(a), email: a.email.toLowerCase() })

export const makeAdmin = (a) => supabase.from('bt_admins').insert({ email: a.email.toLowerCase() })

export async function removeAccess(a) {
  const r = await supabase.from('bt_admins').delete().eq('email', a.email.toLowerCase())
  if (r.error || !a.recruiter_id) return r
  return supabase.from('bt_recruiters').update({ active: false }).eq('id', a.recruiter_id)
}

// Admin rights on and off. Removing keeps a recruiter a recruiter; the database refuses to
// remove the last active admin.
export const removeAdmin = (a) => supabase.rpc('bt_remove_admin', { p_user_id: a.user_id })
// Deactivate keeps the login and every record but gives no access; activate restores it.
// The database refuses yourself and the last active admin.
export const setAccountActive = (a, active) => supabase.rpc('bt_set_account_active', { p_user_id: a.user_id, p_active: active })
// Deletes the login for good; submissions and interviews stay. Never yourself or the last active admin.
export const deleteAccount = (a) => supabase.rpc('bt_delete_account', { p_user_id: a.user_id })

// Deletes the sign-up entirely (the database refuses for admins, active recruiters and yourself)
export const rejectAccount = (a) => supabase.rpc('bt_reject_account', { p_user_id: a.user_id })

// PostgREST says PGRST202 when the function isn't in the database yet
export const needsDbUpdate = (error) => error?.code === 'PGRST202' || /could not find the function/i.test(error?.message || '')
