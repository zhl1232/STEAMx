import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import ProfilePage from './page'

const planState = vi.hoisted(() => ({ data: null as Record<string, unknown> | null }))
const home = vi.hoisted(() => ({
  data: {} as Record<string, unknown> | undefined,
  isError: false, refetchProfileHome: vi.fn(), isFetching: false,
}))
beforeEach(() => {
  planState.data = null
  home.data = {}; home.isError = false; home.refetchProfileHome.mockClear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ notifications: [] }) }))
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })))
})

vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({
  user: { id: 'user-1', created_at: '2026-01-01', user_metadata: {} },
  profile: { display_name: '小创客', xp: 0 }, loading: false, refreshProfile: vi.fn(),
}) }))
vi.mock('@/lib/context/gamification-context', () => ({ useGamification: () => ({
  xp: 0, coins: 0, level: 1, nextLevelXp: 100, progress: 0, levelProgress: 0, levelTotalNeeded: 100, unlockedBadges: new Set(), userBadgeDetails: new Map(), userStats: undefined, refetchStats: vi.fn(),
}) }))
vi.mock('@/hooks/profile/use-profile-page-data', () => ({
  useProfilePageData: () => ({ ...home, isPending: false }),
  profileHomeQueryKey: () => ['profile'],
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: () => ({ data: planState.data, isPending: false, isError: false }),
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
      for (const [name, href] of [['内容库', '/profile/library'], ['排行榜', '/leaderboard']]) {
        const links = await screen.findAllByRole('link', { name })
        expect(links.length).toBeGreaterThan(0)
        for (const link of links) expect(link).toHaveAttribute('href', href)
      }
      expect(screen.queryByRole('link', { name: '查看排行榜' })).not.toBeInTheDocument()
    } else {
      expect(await screen.findByRole('link', { name: /我的内容/ })).toHaveAttribute('href', '/profile/library')
      expect(screen.queryByRole('link', { name: '内容库' })).not.toBeInTheDocument()
      // 手机端排行榜只出现在头图快捷入口里一次
      const leaderboard = screen.getAllByRole('link', { name: /排行榜/ })
      expect(leaderboard).toHaveLength(1)
      expect(leaderboard[0]).toHaveAttribute('href', '/leaderboard')
    }
    expect(screen.queryByRole('navigation', { name: '个人中心常用入口' })).not.toBeInTheDocument()
    for (const link of screen.getAllByRole('link', { name: /作品/ })) {
      expect(link).toHaveAttribute('href', '/profile/library?tab=works')
    }
    expect(screen.getAllByRole('button', { name: '编辑资料' }).length).toBeGreaterThan(0)
  } finally { vi.unstubAllGlobals() }
})

it('shows recovery instead of zero statistics when the summary fails', async () => {
  home.data = undefined
  home.isError = true
  render(<ProfilePage />)
  expect(await screen.findByRole('alert')).toHaveTextContent('个人中心暂时无法加载')
  expect(screen.queryByRole('link', { name: '0 作品' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
  expect(home.refetchProfileHome).toHaveBeenCalledOnce()
})

it('preserves successful statistics and identifies a failed optional section', async () => {
  home.data = { myWorksTotalCount: 12, failedSections: ['observations'] }
  render(<ProfilePage />)
  expect(await screen.findByRole('link', { name: '12 作品' })).toHaveAttribute('href', '/profile/library?tab=works')
  expect(screen.getByText('自然观察暂未更新，已加载的内容仍可查看。')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  expect(home.refetchProfileHome).toHaveBeenCalledOnce()
})

it('keeps growth collapsed and recent works before growth on mobile', async () => {
  render(<ProfilePage />)
  const works = await screen.findByRole('heading', { name: '最近作品' })
  const growth = screen.getByText('成长与荣誉').closest('details')!
  expect(growth).not.toHaveAttribute('open')
  expect(works.compareDocumentPosition(growth) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByText('热爱科学与创造，喜欢用动手实践探索世界的奥秘。')).not.toBeInTheDocument()
})

it('uses the compact exploration card on the mobile page', async () => {
  planState.data = { title: '继续探索', subtitle: '桌面计划简介', completedCount: 0, steps: [
    { id: 'course', type: 'course', status: 'todo', title: '继续风车课程', subtitle: '完成下一课', href: '/courses', actionLabel: '继续学习' },
  ] }
  render(<ProfilePage />)
  expect(await screen.findByRole('link', { name: '继续学习' })).toHaveAttribute('href', '/courses')
  expect(screen.queryByText('桌面计划简介')).not.toBeInTheDocument()
})
