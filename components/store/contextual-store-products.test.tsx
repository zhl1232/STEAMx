import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
const flags = vi.hoisted(() => ({ visible: true }))
import { ContextualStoreProducts } from './contextual-store-products'

vi.mock('@/lib/store/config', () => ({ isStoreCatalogVisible: () => flags.visible }))
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

    expect(screen.getByRole('link', { name: /查看材料包/ })).toHaveAttribute('href', '/store/products/native-1')
    expect(screen.queryByText(/淘宝|¥|本站下单/)).not.toBeInTheDocument()
  })
})

const product = {
  id: 'p1', slug: 'science', name: '科学实验套装', description: null,
  cover_url: '/kit.jpg', currency: 'CNY', price_cents: 1200,
  compare_at_price_cents: null, checkout_mode: 'internal', external_channel: null,
  external_url: null, variants: [],
} as import('@/lib/store/service').PublicStoreProduct

it('selects a sole variant but leaves multiple specifications for the shopper to choose', () => {
  const variants = [{ id: 'v2', name: '小学二年级', price_cents: 1200 }] as typeof product.variants
  const { rerender } = render(<ContextualStoreProducts products={[{ ...product, variants }]} contextLabel="这节课的" />)
  expect(screen.getByRole('link', { name: /小学二年级/ })).toHaveAttribute('href', '/store/products/p1?variant=v2')
  rerender(<ContextualStoreProducts products={[{ ...product, variants: [...variants, { ...variants[0], id: 'v3', name: '小学三年级' }] }]} contextLabel="这节课的" />)
  expect(screen.getByRole('link', { name: /查看材料包/ })).toHaveAttribute('href', '/store/products/p1')
  expect(screen.queryByText('小学二年级')).not.toBeInTheDocument()
})

it('omits empty and closed catalogs', () => {
  const { container, rerender } = render(<ContextualStoreProducts products={[]} contextLabel="这节课的" />)
  expect(container).toBeEmptyDOMElement()
  flags.visible = false
  rerender(<ContextualStoreProducts products={[product]} contextLabel="这节课的" />)
  expect(container).toBeEmptyDOMElement()
  flags.visible = true
})
