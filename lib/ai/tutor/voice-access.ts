import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { isMembershipActive } from '@/lib/membership'
import { DEFAULT_TUTOR_VOICE, isTutorVoice, TUTOR_VOICES } from './voice-catalog'

/** user_metadata is a preference only, never evidence of membership. */
export async function getTutorVoiceAccess(supabase: SupabaseClient<Database>, user: User) {
  const { data: profile, error } = await supabase.from('profiles')
    .select('membership_tier, membership_period, membership_started_at, membership_expires_at')
    .eq('id', user.id).maybeSingle()
  if (error) throw error
  const member = isMembershipActive(profile)
  const legacy = process.env.DASHSCOPE_TUTOR_AUDIO_PROTOCOL === 'legacy'
  const canChoose = member && !legacy
  const stored = user.user_metadata?.tutor_voice
  return {
    canChoose,
    voice: canChoose && isTutorVoice(stored) ? stored : DEFAULT_TUTOR_VOICE,
    expiresAt: profile?.membership_period === 'monthly' || profile?.membership_period === 'yearly'
      ? profile.membership_expires_at : null,
    voices: legacy ? [] : TUTOR_VOICES,
  }
}
