import type { ComponentProps } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreCatalogClient } from './store-catalog-client'
vi.mock('next/link', () => ({ default: ({ children, ...p }: ComponentProps<'a'>) => <a {...p}>{children}</a> }))
describe('store catalog', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ products: [{ id: 'p1', name: '齿轮车', price_cents: 1200, variants: [{ id: 'v1', price_cents: null }] }] })))) })
  it('offers public product details without requiring address or login', async () => {
    render(<StoreCatalogClient />)
    const link = await screen.findByRole('link', { name: /齿轮车/ })
    expect(link).toHaveAttribute('href', '/store/products/p1')
    expect(screen.queryByLabelText('收货人')).not.toBeInTheDocument()
    expect(screen.getByText('¥12.00')).toBeInTheDocument()
  })
  it('shows a useful empty state and reports catalog failures', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ products: [] })))
    const view = render(<StoreCatalogClient />)
    await screen.findByText('商品正在准备中')
    view.unmount()
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: '加载失败' }), { status: 503 }))
    render(<StoreCatalogClient />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('加载失败'))
  })
})
