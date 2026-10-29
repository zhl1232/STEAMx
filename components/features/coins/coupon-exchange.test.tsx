import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CouponExchange from './coupon-exchange'
const { refreshProfile } = vi.hoisted(() => ({ refreshProfile: vi.fn() }))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'user' }, refreshProfile }) }))
vi.mock('@/lib/context/gamification-context', () => ({ useGamification: () => ({ coins: 1000 }) }))
const offer = { id: 'offer', version: 'v1', coin_price: 500, title: '材料券', threshold_cents: 5000, discount_cents: 500, valid_days: 30, terms: '指定积木适用', eligible_product_ids: ['product'], eligible_products: [{ id: 'product', name: '科学材料包' }], per_user_limit: 2, user_redeemed: 0, available: true }
function show() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CouponExchange /></QueryClientProvider>) }
function reply(body: unknown, status = 200) { return Promise.resolve(new Response(JSON.stringify(body), { status })) }
describe('coupon exchange', () => {
  beforeEach(() => { sessionStorage.clear(); vi.resetAllMocks(); refreshProfile.mockResolvedValue(undefined) })
  it('confirms terms before spending and refreshes balance after success', async () => {
    const fetcher = vi.fn((url: string, _init?: RequestInit) => url.endsWith('coupon-offers') ? reply({ offers: [offer], enabled: true }) : reply({ exchange: { id: 'exchange' } }))
    vi.stubGlobal('fetch', fetcher); show()
    fireEvent.click(await screen.findByRole('button', { name: '500 硬币兑换' }))
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('region', { name: '确认兑换' })).toHaveTextContent('科学材料包')
    expect(screen.getByRole('region', { name: '确认兑换' })).toHaveTextContent('兑换后不退硬币')
    fireEvent.click(screen.getByRole('button', { name: '确认兑换' }))
    await screen.findByText('兑换成功，优惠券已存入我的优惠券。')
    const submitted = fetcher.mock.calls.find(call => call[1]?.method === 'POST')
    expect(JSON.parse(submitted![1]!.body as string)).toMatchObject({ offerId: 'offer', expectedVersion: 'v1' })
    expect(refreshProfile).toHaveBeenCalledOnce()
  })
  it('recovers a stored successful intent without spending again', async () => {
    sessionStorage.setItem('coupon-exchange:user', JSON.stringify({ offerId: 'offer', expectedVersion: 'v1', idempotencyKey: 'same-intent' }))
    const fetcher = vi.fn((url: string) => url.includes('?intent=') ? reply({ exchange: { id: 'done' } }) : reply({ offers: [], enabled: false }))
    vi.stubGlobal('fetch', fetcher); show()
    fireEvent.click(await screen.findByRole('button', { name: '核查同一次兑换' }))
    await screen.findByText('兑换成功，优惠券已存入我的优惠券。')
    expect(fetcher.mock.calls.some(call => call[0].includes('intent=same-intent'))).toBe(true)
    expect(sessionStorage.getItem('coupon-exchange:user')).toBeNull()
  })
  it('keeps the original intent when the network result is unknown', async () => {
    const fetcher = vi.fn((url: string) => url.endsWith('coupon-offers') ? reply({ offers: [offer], enabled: true }) : Promise.reject(new Error('网络中断')))
    vi.stubGlobal('fetch', fetcher); show()
    fireEvent.click(await screen.findByRole('button', { name: '500 硬币兑换' }))
    fireEvent.click(screen.getByRole('button', { name: '确认兑换' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '核查同一次兑换' })).toBeEnabled())
    expect(JSON.parse(sessionStorage.getItem('coupon-exchange:user')!)).toMatchObject({ offerId: 'offer', expectedVersion: 'v1' })
  })
  it('preserves the same exchange intent after rate limiting', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('coupon-offers') ? reply({ offers: [offer], enabled: true }) : reply({ error: '请求频繁' }, 429)))
    show()
    fireEvent.click(await screen.findByRole('button', { name: '500 硬币兑换' }))
    fireEvent.click(screen.getByRole('button', { name: '确认兑换' }))
    await screen.findByText('请求频繁')
    expect(screen.getByRole('button', { name: '核查同一次兑换' })).toBeEnabled()
    expect(JSON.parse(sessionStorage.getItem('coupon-exchange:user')!)).toMatchObject({ offerId: 'offer' })
  })

  it('keeps the intent for an unclassified conflict', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('coupon-offers') ? reply({ offers: [offer], enabled: true }) : reply({ error: '状态未知', code: 'STORE_STATE_CONFLICT' }, 409)))
    show()
    fireEvent.click(await screen.findByRole('button', { name: '500 硬币兑换' }))
    fireEvent.click(screen.getByRole('button', { name: '确认兑换' }))
    await screen.findByText('状态未知')
    expect(screen.getByRole('button', { name: '核查同一次兑换' })).toBeEnabled()
    expect(sessionStorage.getItem('coupon-exchange:user')).not.toBeNull()
  })

})
