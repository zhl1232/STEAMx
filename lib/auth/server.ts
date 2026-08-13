import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { buildLoginRedirectFromRequestHeaders } from '@/lib/auth/login-redirect'
import { createClient } from '@/lib/supabase/server'
import { isPlaywrightSmoke } from '@/lib/testing/playwright-smoke'

type UserRole = 'user' | 'teacher' | 'moderator' | 'admin'

async function resolveLoginRedirect(redirectTo?: string) {
  if (redirectTo) return redirectTo
  return buildLoginRedirectFromRequestHeaders(await headers())
}

export async function requirePageUser(redirectTo?: string) {
  const loginRedirect = await resolveLoginRedirect(redirectTo)

  if (isPlaywrightSmoke()) {
    redirect(loginRedirect)
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect(loginRedirect)
  }

  return { supabase, user }
}

export async function requirePageRole(
  allowedRoles: UserRole[],
  unauthorizedRedirectTo: string = '/',
  unauthenticatedRedirectTo?: string,
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
