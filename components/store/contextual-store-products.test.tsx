import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ContextualStoreProducts } from './contextual-store-products'

vi.mock('@/lib/store/config', () => ({ isStoreCatalogVisible: () => true }))
vi.mock('@/components/ui/optimized-image', () => ({ OptimizedImage: () => null }))
vi.mock('next/link', () => ({ default: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a> }))

describe('ContextualStoreProducts', () => {
  it('links native contextual products to their exact store product', () => {
    render(
      <ContextualStoreProducts
        products={[{
          id: 'native-1', slug: 'gear-car', name: '齿轮车材料包', description: null,
          cover_url: null, currency: 'CNY', price_cents: 1200,
          compare_at_price_cents: null, checkout_mode: 'internal', external_channel: null,
          external_url: null, variants: [],
        }]}
        contextLabel="这节课的"
      />,
    )

    expect(screen.getByRole('link', { name: /查看并下单/ })).toHaveAttribute('href', '/store?product=native-1')
    expect(screen.queryByText(/淘宝/)).not.toBeInTheDocument()
  })
})
