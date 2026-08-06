import { describe, expect, it, vi } from 'vitest'

import { PermissionError } from '@/lib/api/auth'
import {
  getInteractionAccess,
  requireInteractionAccess,
} from '@/lib/access/interaction-access'

function makeSupabase(profile: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  return { from: vi.fn(() => ({ select })) } as never
}

const user = { id: 'user-1' } as never

describe('interaction access', () => {
  it('lets registered users save progress but not publish interactions', async () => {
    const supabase = makeSupabase({ age_confirmed_at: null, interaction_restricted: false })
    const access = await getInteractionAccess(supabase, user)

    expect(access).toMatchObject({
      state: 'registered',
      canSaveProgress: true,
      canSubmit: false,
      canComment: false,
      canMessage: true,
    })

    await expect(requireInteractionAccess(supabase, user, 'submit')).rejects.toMatchObject({
      code: 'AGE_CONFIRMATION_REQUIRED',
    })
    await expect(requireInteractionAccess(supabase, user, 'message')).resolves.toMatchObject({
      state: 'registered',
      canMessage: true,
    })
  })

  it('allows confirmed users to comment and message', async () => {
    const supabase = makeSupabase({
      age_confirmed_at: '2026-08-01T00:00:00.000Z',
      interaction_restricted: false,
    })

    await expect(requireInteractionAccess(supabase, user, 'comment')).resolves.toMatchObject({
      state: 'confirmed',
    })
    await expect(requireInteractionAccess(supabase, user, 'message')).resolves.toMatchObject({
      canMessage: true,
    })
  })

  it('blocks every write capability for restricted accounts', async () => {
    const supabase = makeSupabase({
      age_confirmed_at: '2026-08-01T00:00:00.000Z',
      interaction_restricted: true,
    })

    await expect(requireInteractionAccess(supabase, user, 'save_progress')).rejects.toEqual(
      expect.objectContaining({
        code: 'INTERACTION_RESTRICTED',
      } satisfies Partial<PermissionError>),
    )
  })
})
