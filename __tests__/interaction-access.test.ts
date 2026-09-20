import { describe, expect, it, vi } from 'vitest'

import { PermissionError } from '@/lib/api/auth'
import { getInteractionAccess, requireInteractionAccess } from '@/lib/access/interaction-access'

function makeSupabase(profile: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  return { from: vi.fn(() => ({ select })) } as never
}

const user = { id: 'user-1' } as never
const capabilities = ['save_progress', 'engage', 'submit', 'comment', 'post', 'message'] as const

describe('interaction access', () => {
  it.each(capabilities)('lets an unconfirmed registered user use %s', async (capability) => {
    const supabase = makeSupabase({ age_confirmed_at: null, interaction_restricted: false })
    const access = await getInteractionAccess(supabase, user)

    expect(access).toMatchObject({
      state: 'registered',
      canSaveProgress: true,
      canEngage: true,
      canSubmit: true,
      canComment: true,
      canPost: true,
      canMessage: true,
    })
    await expect(requireInteractionAccess(supabase, user, capability)).resolves.toMatchObject({
      state: 'registered',
    })
  })

  it.each(capabilities)('blocks %s for restricted accounts', async (capability) => {
    const supabase = makeSupabase({ interaction_restricted: true })

    await expect(requireInteractionAccess(supabase, user, capability)).rejects.toEqual(
      expect.objectContaining({
        code: 'INTERACTION_RESTRICTED',
      } satisfies Partial<PermissionError>),
    )
  })

  it.each([
    { safety_status: 'banned' },
    { safety_status: 'suspended', safety_restricted_until: '2999-01-01T00:00:00.000Z' },
  ])('blocks accounts with active safety status: %o', async (safety) => {
    const supabase = makeSupabase({ interaction_restricted: false, ...safety })

    await expect(requireInteractionAccess(supabase, user, 'post')).rejects.toMatchObject({
      code: 'INTERACTION_RESTRICTED',
    })
  })

  it('requires authentication before checking capabilities', async () => {
    const supabase = makeSupabase(null)

    await expect(requireInteractionAccess(supabase, null as never, 'post')).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    })
    await expect(getInteractionAccess(supabase, null)).resolves.toBeNull()
  })

  it('fails closed when an authenticated user has no profile', async () => {
    const supabase = makeSupabase(null)

    await expect(getInteractionAccess(supabase, user)).resolves.toBeNull()
    await expect(requireInteractionAccess(supabase, user, 'post')).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    })
  })
})
