import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CoinsPage from '@/app/coins/page'
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'user' }, loading: false }) }))
vi.mock('@/lib/context/gamification-context', () => ({ useGamification: () => ({ coins: 123 }) }))
vi.mock('@/components/layout/mobile-global-header', () => ({ MobileGlobalHeader: ({ title }: { title: string }) => <h1>{title}</h1> }))
vi.mock('./appearance-exchange', () => ({ default: () => <p>装扮列表</p> }))
vi.mock('./coin-history', () => ({ default: () => <p>流水列表</p> }))
vi.mock('./coupon-exchange', () => ({ default: () => <p>券列表</p> }))
describe('coins hub', () => {
  beforeEach(() => window.history.replaceState(null, '', '/coins'))
  it('defaults to appearance with one shared balance and three clear destinations', () => {
    render(<CoinsPage />)
    expect(screen.getByRole('tab', { name: '装扮兑换' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('123')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '优惠券兑换' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '收支明细' })).toBeInTheDocument()
  })
  it('restores a linked tab and follows browser navigation', () => {
    window.history.replaceState(null, '', '/coins?tab=coupons')
    render(<CoinsPage />)
    expect(screen.getByText('券列表')).toBeInTheDocument()
    window.history.replaceState(null, '', '/coins?tab=history')
    fireEvent.popState(window)
    expect(screen.getByText('流水列表')).toBeInTheDocument()
  })
})
