import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { getTutorVoiceAccess } from './voice-access'
import { DEFAULT_TUTOR_VOICE, TUTOR_VOICES } from './voice-catalog'
function db(profile: unknown) {
  type Query = { select: () => Query; eq: (...args: unknown[]) => Query; maybeSingle: () => Promise<{ data: unknown }> }
  const query: Query = { select: () => query, eq: vi.fn(() => query), maybeSingle: async () => ({ data: profile }) }
  return { from: () => query } as unknown as SupabaseClient<Database>
}
const user = { id: 'user-one', user_metadata: { tutor_voice: 'anmingyuan_v3.1', isMember: true } } as unknown as User
afterEach(() => vi.unstubAllEnvs())
describe('voice entitlement', () => {
  it('ignores forged membership metadata and expired membership', async () => {
    const free = await getTutorVoiceAccess(db({ membership_tier: 'free' }), user)
    expect(free).toMatchObject({ voice: DEFAULT_TUTOR_VOICE, canChoose: false })
    const expired = await getTutorVoiceAccess(db({ membership_tier: 'pro', membership_period: 'monthly', membership_expires_at: '2000-01-01' }), user)
    expect(expired.voice).toBe(DEFAULT_TUTOR_VOICE)
  })
  it('restores a valid stored male voice for an active member and rejects unknown stored voices', async () => {
    const member = db({ membership_tier: 'pro', membership_period: 'lifetime' })
    expect((await getTutorVoiceAccess(member, user)).voice).toBe('anmingyuan_v3.1')
    expect((await getTutorVoiceAccess(member, { ...user, user_metadata: { tutor_voice: 'Ethan' } })).voice).toBe(DEFAULT_TUTOR_VOICE)
    expect(TUTOR_VOICES.some((voice) => voice.description.includes('男声'))).toBe(true)
    expect(TUTOR_VOICES.some((voice) => voice.description.includes('女声'))).toBe(true)
  })
  it('disables incompatible custom voices on an operator legacy rollback', async () => {
    vi.stubEnv('DASHSCOPE_TUTOR_AUDIO_PROTOCOL', 'legacy')
    expect(await getTutorVoiceAccess(db({ membership_tier: 'founder', membership_period: 'founder' }), user)).toMatchObject({ canChoose: false, voices: [] })
  })
})
