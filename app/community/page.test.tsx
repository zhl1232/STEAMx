import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CommunityPageClient } from './community-page-client'

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

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

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

vi.mock('@/lib/context/community-context', () => ({
  useCommunity: () => mockCommunityState,
}))

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock('@/components/features/community/discussion-list', () => ({
  DiscussionList: ({ tabsSlot }: { tabsSlot?: React.ReactNode }) => (
    <div>
      {tabsSlot}
      <div>discussion-list</div>
    </div>
  ),
}))

vi.mock('@/components/ui/loading-skeleton', () => ({
  ChallengeCardSkeleton: () => <div>loading</div>,
}))

vi.mock('@/components/layout/notification-bell', () => ({
  NotificationBell: () => <button type="button">消息</button>,
}))

vi.mock('@/components/layout/user-button', () => ({
  UserButton: () => <button type="button">用户</button>,
}))

vi.mock('@/components/layout/logo', () => ({
  SteamLogo: () => <span>logo</span>,
}))

describe('CommunityPage', () => {
  const renderCommunityPage = () => render(
    <CommunityPageClient
      initialTab="discussions"
      initialDiscussionTotal={0}
      initialDiscussions={[]}
      initialDiscussionsHasMore={false}
      initialDiscussionTags={[]}
      initialDiscussionDataLoaded
      initialDiscussionTagsLoaded
    />,
  )

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total: 0 }),
    }))
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
      challengesError: '挑战加载失败，请稍后重试',
    }

    renderCommunityPage()

    fireEvent.click(screen.getByRole('button', { name: '挑战' }))

    expect(screen.getByText('挑战加载失败')).toBeInTheDocument()
    expect(screen.getByText('挑战加载失败，请稍后重试')).toBeInTheDocument()
    expect(screen.queryByText('暂无挑战')).not.toBeInTheDocument()
  })

  it('retries challenge loading from the inline error state', () => {
    mockCommunityState = {
      ...mockCommunityState,
      challengesError: '挑战加载失败，请稍后重试',
    }

    renderCommunityPage()

    fireEvent.click(screen.getByRole('button', { name: '挑战' }))
    fireEvent.click(screen.getByRole('button', { name: '重试' }))

    expect(mockReloadChallenges).toHaveBeenCalledTimes(1)
  })
})
