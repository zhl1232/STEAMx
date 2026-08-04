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

export type InteractionState = 'anonymous' | 'registered' | 'confirmed' | 'restricted'

export interface InteractionAccess {
  state: Exclude<InteractionState, 'anonymous'>
  ageConfirmed: boolean
  canSaveProgress: boolean
  canEngage: boolean
  canSubmit: boolean
  canComment: boolean
  canPost: boolean
  canMessage: boolean
}

type InteractionProfile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'age_confirmed_at' | 'interaction_restricted'
>

const AGE_GATED_CAPABILITIES = new Set<InteractionCapability>([
  'submit',
  'comment',
  'post',
  'message',
])

function isAgeConfirmed(profile: InteractionProfile | null) {
  return Boolean(profile?.age_confirmed_at)
}

export async function getInteractionAccess(
  supabase: SupabaseClient<Database>,
  user: User | null,
): Promise<InteractionAccess | null> {
  if (!user) return null

  const profileQuery = supabase
    .from('profiles')
    .select('age_confirmed_at, interaction_restricted')
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
  if (profile?.interaction_restricted) {
    return {
      state: 'restricted',
      ageConfirmed: isAgeConfirmed(profile),
      canSaveProgress: false,
      canEngage: false,
      canSubmit: false,
      canComment: false,
      canPost: false,
      canMessage: false,
    }
  }

  const ageConfirmed = isAgeConfirmed(profile)
  return {
    state: ageConfirmed ? 'confirmed' : 'registered',
    ageConfirmed,
    canSaveProgress: true,
    canEngage: true,
    canSubmit: ageConfirmed,
    canComment: ageConfirmed,
    canPost: ageConfirmed,
    canMessage: ageConfirmed,
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

  if (AGE_GATED_CAPABILITIES.has(capability) && !access.ageConfirmed) {
    throw new PermissionError('完成社区互动确认后即可继续此操作', 'AGE_CONFIRMATION_REQUIRED', {
      capability,
      redirectTo: '/settings/security?section=age-confirmation',
    })
  }

  return access
}
