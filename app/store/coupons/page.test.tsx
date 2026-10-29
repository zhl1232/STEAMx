import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import CouponsPage from './page'
vi.mock('@/lib/context/store-availability-context', () => ({ useStoreCatalogVisible: () => false }))
it('keeps owned coupons readable with closed catalog and explains unavailable states', async () => {
  const base = { title: '材料券', threshold_cents: 5000, discount_cents: 500, terms: '适用科学材料', expires_at: '2099-01-01T00:00:00Z', eligible: false }
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ coupons: [
    { ...base, id: 'reserved', status: 'reserved' },
    { ...base, id: 'used', status: 'used' },
    { ...base, id: 'expired', status: 'available', expires_at: '2000-01-01T00:00:00Z' },
    { ...base, id: 'qualification', status: 'available' },
  ] }))))
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CouponsPage /></QueryClientProvider>)
  expect(await screen.findByText('订单占用中')).toBeInTheDocument()
  expect(screen.getByText('已使用')).toBeInTheDocument()
  expect(screen.getByText('已过期')).toBeInTheDocument()
  expect(screen.getByText('当前资格不符合')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '去材料商城' })).not.toBeInTheDocument()
})
