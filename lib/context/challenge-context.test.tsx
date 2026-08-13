import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChallengeProvider, useChallenge } from './challenge-context'

const addXp = vi.fn()
const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
}))

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({
    user: authState.user,
    loading: authState.loading,
  }),
}))

vi.mock('@/lib/context/gamification-context', () => ({
  useGamification: () => ({ addXp }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}))

function JoinButton({ currentlyJoined }: { currentlyJoined?: boolean }) {
  const { joinChallenge } = useChallenge()
  return (
    <button
      type="button"
      onClick={() => {
        void joinChallenge(4, currentlyJoined === undefined ? undefined : { currentlyJoined })
      }}
    >
      join
    </button>
  )
}

describe('ChallengeProvider joinChallenge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.user = null
    authState.loading = false
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ joined: true, action: 'joined', changed: true }),
      text: async () => '',
    }))
  })

  it('still posts join when the homepage deep-link list is empty and auth state has not caught up', async () => {
    render(
      <ChallengeProvider autoLoad={false}>
        <JoinButton currentlyJoined={false} />
      </ChallengeProvider>,
    )

    document.querySelector('button')?.click()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/challenges/4/participation', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'join' }),
      }))
    })
  })

  it('does not require the challenge to already exist in the provider cache', async () => {
    authState.user = { id: 'user-1' }

    render(
      <ChallengeProvider autoLoad={false}>
        <JoinButton />
      </ChallengeProvider>,
    )

    document.querySelector('button')?.click()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })
    expect(fetch).toHaveBeenCalledWith('/api/challenges/4/participation', expect.objectContaining({
      body: JSON.stringify({ action: 'join' }),
    }))
  })
})
