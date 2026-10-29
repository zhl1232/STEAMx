import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { UserButton } from './user-button'
import { NotificationBell } from './notification-bell'
import { MainNav } from './main-nav'

const auth = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'member@example.com', user_metadata: {} },
  profile: { display_name: '小创客', xp: 1600, membership_tier: 'founder', membership_period: 'founder' },
  loading: false, canReview: false, signOut: vi.fn(),
}))
const notifications = vi.hoisted(() => ({ unreadCount: 7 }))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => auth }))
vi.mock('@/lib/context/login-prompt-context', () => ({ useLoginPrompt: () => ({ promptLogin: vi.fn() }) }))
vi.mock('@/lib/context/notification-context', () => ({ useOptionalNotifications: () => notifications }))
vi.mock('next/navigation', () => ({ usePathname: () => '/leaderboard' }))
vi.mock('@/components/layout/login-dialog', () => ({ LoginDialog: () => null }))

beforeEach(() => {
  vi.clearAllMocks()
  auth.canReview = false
  auth.profile.xp = 1600
})

async function openMenu(compact = false) {
  render(<UserButton compact={compact} />)
  fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
  return screen.findByRole('menu')
}

it('limits desktop entries while retaining identity and sign out', async () => {
  await openMenu()
  expect(screen.getByText('小创客')).toBeInTheDocument()
  expect(screen.getByText('member@example.com')).toBeInTheDocument()
  expect(screen.getByText(/创始会员/)).toBeInTheDocument()
  expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
    '个人中心', '我的硬币', '申请成为审核员', '退出登录',
  ])
  expect(screen.getByRole('menuitem', { name: '个人中心' })).toHaveAttribute('href', '/profile')
  expect(screen.getByRole('menuitem', { name: '我的硬币' })).toHaveAttribute('href', '/coins')
  expect(screen.queryByRole('menuitem', { name: '我的订单' })).not.toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: '平台帮助' })).not.toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: '商城客服' })).not.toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: '实物商城' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('menuitem', { name: '退出登录' }))
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce())
})

it.each([false, true])('preserves reviewer access with compact=%s', async (compact) => {
  auth.canReview = true
  await openMenu(compact)
  expect(screen.getByRole('menuitem', { name: '管理后台' })).toHaveAttribute('href', '/admin')
  expect(screen.queryByRole('menuitem', { name: '申请成为审核员' })).not.toBeInTheDocument()
})

it('keeps the compact menu unchanged', async () => {
  await openMenu(true)
  expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
    '个人中心', '探索指南', '申请成为审核员', '退出登录',
  ])
  expect(screen.getByRole('menuitem', { name: '探索指南' })).toHaveAttribute('href', '/start')
  expect(screen.queryByText('member@example.com')).not.toBeInTheDocument()
})

it('does not offer reviewer application below level five', async () => {
  auth.profile.xp = 0
  await openMenu()
  expect(screen.queryByRole('menuitem', { name: '申请成为审核员' })).not.toBeInTheDocument()
})

it('keeps the existing bell linked to messages with an unread badge', () => {
  render(<NotificationBell />)
  expect(screen.getByRole('link', { name: '消息中心' })).toHaveAttribute('href', '/messages')
  expect(screen.getByText('7')).toBeInTheDocument()
})

it('keeps desktop top navigation focused on the four main sections', () => {
  render(<MainNav />)
  expect(screen.queryByRole('link', { name: '排行榜' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '实验课' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('link').map(link => [link.textContent, link.getAttribute('href')])).toEqual([
    ['探索', '/explore'],
    ['技能课程', '/courses'],
    ['自然观察', '/nature'],
    ['游乐场', '/playground'],
  ])
})
