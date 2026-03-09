import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { isPlaywrightSmoke } from '@/lib/testing/playwright-smoke'

type UserRole = 'user' | 'teacher' | 'moderator' | 'admin'

export async function requirePageUser(redirectTo: string = '/login') {
  if (isPlaywrightSmoke()) {
    redirect(redirectTo)
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect(redirectTo)
  }

  return { supabase, user }
}

export async function requirePageRole(
  allowedRoles: UserRole[],
  unauthorizedRedirectTo: string = '/',
  unauthenticatedRedirectTo: string = '/login',
) {
  const { supabase, user } = await requirePageUser(unauthenticatedRedirectTo)
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (data as { role?: UserRole } | null)?.role

  if (error || !role || !allowedRoles.includes(role)) {
    redirect(unauthorizedRedirectTo)
  }

  return { supabase, user, role }
}
