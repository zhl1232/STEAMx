import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ kit: vi.fn(), offers: vi.fn() }))
vi.mock('@/lib/kits/service', () => ({ getKit: mocks.kit, getKitOffers: mocks.offers }))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND') },
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) },
}))
import KitPage from './page'
beforeEach(() => { vi.resetAllMocks(); mocks.kit.mockResolvedValue({ id: 'k4' }) })
it('redirects a legacy kit link to its exact active SKU', async () => {
  mocks.offers.mockResolvedValue([{ productId: 'product', id: 'grade4' }])
  await expect(KitPage({ params: Promise.resolve({ slug: 'pack-grade-4-2026' }) })).rejects.toThrow('REDIRECT:/store/products/product?variant=grade4')
})
it('does not substitute another product when no current offer exists', async () => {
  mocks.offers.mockResolvedValue([])
  await expect(KitPage({ params: Promise.resolve({ slug: 'unavailable' }) })).rejects.toThrow('NOT_FOUND')
})
it('does not resolve offers for an unpublished or missing kit', async () => {
  mocks.kit.mockResolvedValue(null)
  await expect(KitPage({ params: Promise.resolve({ slug: 'missing' }) })).rejects.toThrow('NOT_FOUND')
  expect(mocks.offers).not.toHaveBeenCalled()
})
