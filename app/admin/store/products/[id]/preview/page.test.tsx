import { render } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requirePageRole: vi.fn(),
  getProduct: vi.fn(),
  getKits: vi.fn(),
  visible: vi.fn(() => true),
  detail: vi.fn((_props: Record<string, unknown>) => null),
}))
vi.mock('@/lib/kits/service',()=>({getKitsForVariants:mocks.getKits}))
vi.mock('@/lib/auth/server', () => ({ requirePageRole: mocks.requirePageRole }))
vi.mock('@/lib/store/operations', () => ({ getAdminStoreProductPreview: mocks.getProduct }))
vi.mock('@/lib/store/config', () => ({ isStoreCatalogVisible: mocks.visible }))
vi.mock('@/components/store/store-product-detail', () => ({ StoreProductDetail: mocks.detail }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') } }))

import Page from './page'

const id = '61000000-0000-4000-8000-000000000001'
const product = { id, name: '已保存商品', shipping_cents: null, variants: [] }
const page = (productId = id) => Page({ params: Promise.resolve({ id: productId }) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requirePageRole.mockResolvedValue({ role: 'admin' })
  mocks.getKits.mockResolvedValue({})
  mocks.getProduct.mockResolvedValue({ status: 'draft', checkoutMode: 'internal', product })
  mocks.visible.mockReturnValue(true)
})

it('checks administrator access before loading private draft data', async () => {
  mocks.requirePageRole.mockRejectedValueOnce(new Error('FORBIDDEN'))
  await expect(page()).rejects.toThrow('FORBIDDEN')
  expect(mocks.requirePageRole).toHaveBeenCalledWith(['admin'])
  expect(mocks.getProduct).not.toHaveBeenCalled()
})

it('returns 404 for an invalid ID or missing stored product', async () => {
  await expect(page('invalid')).rejects.toThrow('NOT_FOUND')
  expect(mocks.getProduct).not.toHaveBeenCalled()
  mocks.getProduct.mockResolvedValueOnce(null)
  await expect(page()).rejects.toThrow('NOT_FOUND')
})

it('previews stored draft fields without opening checkout or a public draft link', async () => {
  render(await page())
  expect(mocks.getProduct).toHaveBeenCalledWith(id)
  expect(mocks.detail.mock.calls[0][0]).toEqual({ product, checkoutEnabled: false, preview: { status: 'draft', publicProductHref: undefined } })
})

it.each([true, false])('offers a separate public page for an active product only when the catalog is open (%s)', async (visible) => {
  mocks.visible.mockReturnValue(visible)
  mocks.getProduct.mockResolvedValueOnce({ status: 'active', checkoutMode: 'internal', product: { ...product, shipping_cents: 600 } })
  render(await page())
  expect(mocks.detail.mock.calls[0][0]).toMatchObject({ checkoutEnabled: false, preview: {
    status: 'active', publicProductHref: visible ? `/store/products/${id}` : undefined,
  } })
})

it('attaches draft kit materials only after administrator access and keeps checkout disabled',async()=>{
 const variant={id:'variant',name:'小班',price_cents:7200};const kit={id:'kit',status:'draft',materials:['纸杯'],gallery_urls:['/kit.jpg']}
 mocks.getProduct.mockResolvedValueOnce({status:'draft',checkoutMode:'internal',product:{...product,variants:[variant]}});mocks.getKits.mockResolvedValueOnce({variant:kit})
 render(await page());expect(mocks.getKits).toHaveBeenCalledWith(['variant'],{includeDraft:true});expect(mocks.detail.mock.calls[0][0]).toMatchObject({checkoutEnabled:false,product:{variants:[{id:'variant',kit}]}})
 expect(mocks.requirePageRole.mock.invocationCallOrder[0]).toBeLessThan(mocks.getKits.mock.invocationCallOrder[0])
})
