import { render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import ProfilePage from './page'

vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({
  user: { id: 'user-1', created_at: '2026-01-01', user_metadata: {} },
  profile: { display_name: '小创客', xp: 0 }, loading: false, refreshProfile: vi.fn(),
}) }))
vi.mock('@/lib/context/gamification-context', () => ({ useGamification: () => ({
  xp: 0, coins: 0, level: 1, nextLevelXp: 100, progress: 0, levelProgress: 0, levelTotalNeeded: 100, unlockedBadges: new Set(), userBadgeDetails: new Map(), userStats: undefined, refetchStats: vi.fn(),
}) }))
vi.mock('@/hooks/profile/use-profile-page-data', () => ({
  useProfilePageData: () => ({ data: {}, isPending: false, isError: false }),
  profileHomeQueryKey: () => ['profile'],
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: () => ({ data: null, isPending: false, isError: false }),
}))
vi.mock('@/lib/context/notification-context', () => ({ useOptionalNotifications: () => ({
  unreadCount: 0, notifications: [], loading: false,
}) }))
vi.mock('@/components/layout/mobile-global-header', () => ({ MobileGlobalHeader: () => null }))
vi.mock('@/components/features/profile/edit-profile-dialog', () => ({ EditProfileDialog: () => null }))

it.each([390, 768, 1440])('keeps profile destinations visible even for an empty profile at %ipx', async (width) => {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query === '(min-width: 768px)' && width >= 768,
    media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })))
  try {
    render(<ProfilePage />)
    if (width >= 768) {
      const nav = await screen.findByRole('navigation', { name: '个人中心常用入口' })
      expect(nav).toHaveClass('hidden', 'md:flex')
      for (const [name, href] of [['内容库', '/profile/library'], ['排行榜', '/leaderboard']]) {
        expect(within(nav).getByRole('link', { name })).toHaveAttribute('href', href)
      }
      expect(within(nav).queryByRole('link', { name: '编辑资料' })).not.toBeInTheDocument()
    } else {
      expect(await screen.findByRole('link', { name: /我的内容/ })).toHaveAttribute('href', '/profile/library')
      expect(screen.queryByRole('navigation', { name: '个人中心常用入口' })).not.toBeInTheDocument()
    }
    expect(screen.getAllByRole('button', { name: '编辑资料' }).length).toBeGreaterThan(0)
  } finally { vi.unstubAllGlobals() }
})
