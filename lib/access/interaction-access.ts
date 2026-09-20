import type { SupabaseClient, User } from '@supabase/supabase-js'

import { PermissionError } from '@/lib/api/auth'
import type { Database } from '@/lib/supabase/types'

export type InteractionCapability =
  | 'save_progress'
  | 'engage'
  | 'submit'
  | 'comment'
  | 'post'
  | 'message'

export type InteractionState = 'anonymous' | 'registered' | 'restricted'

export interface InteractionAccess {
  state: Exclude<InteractionState, 'anonymous'>
  canSaveProgress: boolean
  canEngage: boolean
  canSubmit: boolean
  canComment: boolean
  canPost: boolean
  canMessage: boolean
}

type InteractionProfile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'interaction_restricted' | 'safety_status' | 'safety_restricted_until'
>

export async function getInteractionAccess(
  supabase: SupabaseClient<Database>,
  user: User | null,
): Promise<InteractionAccess | null> {
  if (!user) return null

  const profileQuery = supabase
    .from('profiles')
    .select('interaction_restricted, safety_status, safety_restricted_until')
    .eq('id', user.id)
  const profileQueryWithFallback = profileQuery as unknown as {
    maybeSingle?: () => PromiseLike<{ data: unknown; error: unknown }>
    single?: () => PromiseLike<{ data: unknown; error: unknown }>
  }
  const response = typeof profileQueryWithFallback.maybeSingle === 'function'
    ? await profileQueryWithFallback.maybeSingle()
    : await profileQueryWithFallback.single?.()

  const data = response?.data
  const error = response?.error

  if (error) throw error

  const profile = data as InteractionProfile | null
  if (!profile) return null
  const restrictionHasExpired = Boolean(
    profile?.safety_restricted_until && new Date(profile.safety_restricted_until).getTime() <= Date.now(),
  )
  const isRestricted = Boolean(
    profile?.safety_status === 'banned'
      || (profile?.safety_status === 'suspended' && !restrictionHasExpired)
      || (profile?.interaction_restricted && !restrictionHasExpired),
  )

  if (isRestricted) {
    return {
      state: 'restricted',
      canSaveProgress: false,
      canEngage: false,
      canSubmit: false,
      canComment: false,
      canPost: false,
      canMessage: false,
    }
  }

  return {
    state: 'registered',
    canSaveProgress: true,
    canEngage: true,
    canSubmit: true,
    canComment: true,
    canPost: true,
    // Direct messages are governed by recipient privacy, blocks, moderation,
    // and rate limits.
    canMessage: true,
  }
}

export async function requireInteractionAccess(
  supabase: SupabaseClient<Database>,
  user: User,
  capability: InteractionCapability,
): Promise<InteractionAccess> {
  const access = await getInteractionAccess(supabase, user)

  if (!access) {
    throw new PermissionError('请先登录后继续', 'AUTH_REQUIRED', { capability })
  }

  if (access.state === 'restricted') {
    throw new PermissionError('当前账号暂时不能进行此操作', 'INTERACTION_RESTRICTED', {
      capability,
    })
  }

  return access
}
