import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AnchorHTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LeaderboardContent } from './leaderboard-content'
import type { ProfileGrowthTask } from '@/lib/profile/growth-tasks'

const mockToast = vi.fn()
const mockRefreshProfile = vi.fn()
const fetchMock = vi.fn()

let mockUser: { id: string } | null = { id: 'user-1' }

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    refreshProfile: mockRefreshProfile,
  }),
}))

vi.mock('@/lib/context/gamification-context', () => ({
  useGamification: () => ({
    level: 3,
    xp: 450,
    nextLevelXp: 900,
    progress: 70,
    levelProgress: 350,
    levelTotalNeeded: 500,
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

function makeTask(overrides: Partial<ProfileGrowthTask>): ProfileGrowthTask {
  return {
    id: 'submit_first_observation',
    label: '记录 1 条自然观察',
    href: '/nature/submit',
    rewardXp: 10,
    reward: '+10 经验',
    target: 1,
    currentValue: 1,
    progressLabel: '1/1',
    progress: 100,
    done: true,
    claimed: false,
    claimable: true,
    status: 'claimable',
    ...overrides,
  }
}

function mockFetchWithGrowthTasks(tasks: ProfileGrowthTask[]) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url.startsWith('/api/leaderboard')) {
      return new Response(JSON.stringify({ users: [] }), { status: 200 })
    }

    if (url === '/api/profile/growth-tasks/sync') {
      return new Response(
        JSON.stringify({
          tasks,
          completedTaskCount: tasks.filter((task) => task.done).length,
          graduatedAt: null,
        }),
        { status: 200 },
      )
    }

    if (url === '/api/profile/growth-tasks/claim') {
      return new Response(
        JSON.stringify({
          ok: true,
          alreadyClaimed: false,
          taskId: 'submit_first_observation',
          taskLabel: '记录 1 条自然观察',
          xpGranted: 10,
        }),
        { status: 200 },
      )
    }

    return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 404 })
  })
}

describe('LeaderboardContent growth tasks panel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = { id: 'user-1' }
    global.fetch = fetchMock
  })

  it('renders real profile growth tasks instead of hard-coded weekly tasks', async () => {
    mockFetchWithGrowthTasks([
      makeTask({}),
      makeTask({
        id: 'publish_first_work',
        label: '拍张照，交出第一件作品',
        href: '/courses',
        rewardXp: 30,
        reward: '+30 经验',
        currentValue: 0,
        progressLabel: '0/1',
        progress: 0,
        done: false,
        claimable: false,
        status: 'in_progress',
      }),
    ])

    render(<LeaderboardContent />)

    expect(await screen.findByText('新手引导')).toBeInTheDocument()
    expect(screen.getByText('记录 1 条自然观察')).toBeInTheDocument()
    expect(screen.getAllByText('+10 经验').length).toBeGreaterThan(0)
    expect(screen.getByText('成长体系')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看成长体系' })).toBeInTheDocument()
    expect(screen.queryByText('排行榜规则')).not.toBeInTheDocument()
    expect(screen.queryByText('本周任务')).not.toBeInTheDocument()
    expect(screen.queryByText('发布 1 个观察记录')).not.toBeInTheDocument()
    expect(screen.queryByText('+80 经验')).not.toBeInTheDocument()
  })

  it('claims a claimable task and reloads real task progress', async () => {
    const user = userEvent.setup()
    mockFetchWithGrowthTasks([makeTask({})])

    render(<LeaderboardContent />)

    await user.click(await screen.findByRole('button', { name: '领取' }))

    await waitFor(() => {
      expect(mockRefreshProfile).toHaveBeenCalledTimes(1)
      expect(mockToast).toHaveBeenCalledWith({
        title: '领取成功',
        description: '已领取「记录 1 条自然观察」奖励，+10 经验',
      })
    })
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === '/api/profile/growth-tasks/sync')).toHaveLength(2)
    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/profile/growth-tasks/claim')).toBe(true)
  })

  it('shows graduated challenge card when growthTasksGraduatedAt is set', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/leaderboard')) {
        return new Response(JSON.stringify({ users: [] }), { status: 200 })
      }
      if (url === '/api/profile/growth-tasks/sync') {
        return new Response(
          JSON.stringify({
            tasks: [makeTask({ status: 'claimed', claimed: true, claimable: false, done: true })],
            completedTaskCount: 5,
            graduatedAt: '2026-05-01T00:00:00.000Z',
          }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 404 })
    })

    render(<LeaderboardContent />)

    expect(await screen.findByText('新手引导已完成')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /前往挑战中心/ })).toHaveAttribute('href', '/create')
    expect(screen.queryByText('记录 1 条自然观察')).not.toBeInTheDocument()
  })

  it('shows a login prompt and does not request growth tasks for anonymous users', async () => {
    mockUser = null
    mockFetchWithGrowthTasks([])

    render(<LeaderboardContent />)

    expect(await screen.findByText('登录后查看你的新手引导进度')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/profile/growth-tasks/sync')).toBe(false)
  })

  it('loads the observation leaderboard tab and renders observation counts', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.startsWith('/api/leaderboard')) {
        const params = new URL(url, 'http://localhost').searchParams
        if (params.get('type') === 'observations') {
          return new Response(
            JSON.stringify({
              users: [
                { id: 'observer-1', name: '观察员', xp: 900, level: 4, value: 12, avatar: null },
                { id: 'observer-2', name: '记录员', xp: 500, level: 3, value: 8, avatar: null },
                { id: 'observer-3', name: '探索员', xp: 300, level: 2, value: 5, avatar: null },
                { id: 'observer-4', name: '同行者', xp: 100, level: 2, value: 3, avatar: null },
              ],
            }),
            { status: 200 },
          )
        }

        return new Response(JSON.stringify({ users: [] }), { status: 200 })
      }

      if (url === '/api/profile/growth-tasks/sync') {
        return new Response(JSON.stringify({ tasks: [], completedTaskCount: 0, graduatedAt: null }), { status: 200 })
      }

      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 404 })
    })

    render(<LeaderboardContent />)

    await user.click(await screen.findByRole('tab', { name: /观察榜/ }))

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const url = String(input)
          return url.startsWith('/api/leaderboard') && new URL(url, 'http://localhost').searchParams.get('type') === 'observations'
        }),
      ).toBe(true)
    })
    expect(await screen.findByText('同行者')).toBeInTheDocument()
    expect(screen.getAllByText('条记录').length).toBeGreaterThan(0)
  })
})
