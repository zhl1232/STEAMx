import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CommunityPage from './page'

const mockReloadChallenges = vi.fn()

let mockCommunityState = {
  challenges: {
    activeTimed: [],
    evergreen: [],
    ended: [],
  },
  challengesError: null as string | null,
  isLoading: false,
  reloadChallenges: mockReloadChallenges,
}

vi.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/context/community-context', () => ({
  useCommunity: () => mockCommunityState,
}))

vi.mock('@/components/features/community/discussion-list', () => ({
  DiscussionList: () => <div>discussion-list</div>,
}))

vi.mock('@/components/community/mobile-community-page', () => ({
  MobileCommunityPage: () => <div>mobile-community-page</div>,
}))

vi.mock('@/components/features/community/challenge-card', () => ({
  ChallengeCard: ({ challenge }: { challenge: { title: string } }) => <div>{challenge.title}</div>,
}))

vi.mock('@/components/ui/loading-skeleton', () => ({
  ChallengeCardSkeleton: () => <div>loading</div>,
}))

describe('CommunityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCommunityState = {
      challenges: {
        activeTimed: [],
        evergreen: [],
        ended: [],
      },
      challengesError: null,
      isLoading: false,
      reloadChallenges: mockReloadChallenges,
    }
  })

  it('shows the challenge error state instead of the empty state when challenge loading fails', () => {
    mockCommunityState = {
      ...mockCommunityState,
      challengesError: '挑战赛加载失败，请稍后重试',
    }

    render(<CommunityPage />)

    fireEvent.click(screen.getByRole('button', { name: '挑战赛' }))

    expect(screen.getByText('挑战赛加载失败')).toBeInTheDocument()
    expect(screen.getByText('挑战赛加载失败，请稍后重试')).toBeInTheDocument()
    expect(screen.queryByText('暂无挑战赛')).not.toBeInTheDocument()
  })

  it('retries challenge loading from the inline error state', () => {
    mockCommunityState = {
      ...mockCommunityState,
      challengesError: '挑战赛加载失败，请稍后重试',
    }

    render(<CommunityPage />)

    fireEvent.click(screen.getByRole('button', { name: '挑战赛' }))
    fireEvent.click(screen.getByRole('button', { name: '重试' }))

    expect(mockReloadChallenges).toHaveBeenCalledTimes(1)
  })
})
