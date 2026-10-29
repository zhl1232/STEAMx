import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StoreProductDetail } from './store-product-detail'

vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ profile: null }) }))
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
beforeEach(() => { push.mockClear() })
afterEach(() => { vi.unstubAllGlobals() })

it('shows saved draft readiness and paused specifications without offering a purchase', () => {
  render(<StoreProductDetail checkoutEnabled preview={{ status: 'draft' }} product={{
    id: 'draft-1', name: '真实草稿', price_cents: 1200, shipping_cents: null,
    variants: [
      { id: 'v1', name: '保存的红色套装', price_cents: null, stock_quantity: 0, min_quantity: 1, status: 'paused' },
      { id: 'v2', name: '保存的蓝色套装', price_cents: 1500, stock_quantity: 0, min_quantity: 1, status: 'paused', stock_pending: true },
    ],
  }} />)
  expect(screen.getByText('管理员商品预览 · 草稿')).toBeInTheDocument()
  expect(screen.getByText('每单运费待确认')).toBeInTheDocument()
  expect(screen.getByText('发货安排待确认')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '预览期间不发起购买' })).toBeDisabled()
  expect(screen.getByLabelText('商品购买')).not.toHaveClass('fixed')
  expect(screen.queryByRole('button', { name: '立即购买' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: '联系商城客服' })).toHaveAttribute('href', '/store/support')
  expect(screen.getByRole('link', { name: '← 返回编辑商品' })).toHaveAttribute('href', '/admin/store?product=draft-1')
  fireEvent.click(screen.getByRole('button', { name: '保存的蓝色套装（已暂停）' }))
  expect(screen.getByText('库存待确认')).toBeInTheDocument()
})

const product = {
  id: 'product-1', name: '材料套装', price_cents: 1200, shipping_cents: 0,
  variants: [{ id: 'v1', name: '标准套装', price_cents: null, stock_quantity: 5, min_quantity: 1 }],
}

it('shows a single specification as text and forwards the chosen quantity to checkout', () => {
  render(<StoreProductDetail product={product} checkoutEnabled />)
  expect(screen.getByText('标准套装')).toBeInTheDocument()
  expect(screen.getByText('可售 5 件')).toBeInTheDocument()
  expect(screen.queryByText(/1 件起订/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '标准套装' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '增加数量' }))
  fireEvent.click(screen.getByRole('button', { name: '立即购买' }))
  const target = new URL(push.mock.calls[0][0], 'https://example.test')
  expect(target.pathname).toBe('/store/checkout')
  expect(target.searchParams.get('variant')).toBe('v1')
  expect(target.searchParams.get('quantity')).toBe('2')
  expect(target.searchParams.get('intent')).toMatch(/^[0-9a-f-]{36}$/i)
})

it('keeps unavailable stock and invalid quantities from opening checkout', () => {
  const view = render(<StoreProductDetail product={{ ...product, variants: [{ ...product.variants[0], stock_quantity: 0 }] }} checkoutEnabled />)
  expect(screen.getByRole('button', { name: '暂时缺货' })).toBeDisabled()
  view.unmount()
  render(<StoreProductDetail product={product} checkoutEnabled />)
  fireEvent.change(screen.getByRole('spinbutton', { name: '数量' }), { target: { value: '101' } })
  expect(screen.getByRole('button', { name: '请选择有效数量' })).toBeDisabled()
  fireEvent.change(screen.getByRole('spinbutton', { name: '数量' }), { target: { value: '6' } })
  expect(screen.getByRole('button', { name: '库存不足' })).toBeDisabled()
  expect(push).not.toHaveBeenCalled()
})

it('switches multiple specifications while keeping pending stock unavailable', () => {
  render(<StoreProductDetail product={{ ...product, variants: [...product.variants, { id: 'v2', name: '补充套装', price_cents: 2000, stock_quantity: 10, min_quantity: 2, stock_pending: true }] }} checkoutEnabled />)
  fireEvent.click(screen.getByRole('button', { name: '补充套装（库存待确认）' }))
  expect(screen.getByRole('button', { name: '补充套装（库存待确认）' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('spinbutton', { name: '数量' })).toHaveValue(2)
  expect(screen.getByText('¥20.00')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '库存待确认' })).toBeDisabled()
})

it('keeps the purchase gate closed even with stock', () => {
  render(<StoreProductDetail product={product} checkoutEnabled={false} />)
  expect(screen.getByRole('button', { name: '购买暂未开放' })).toBeDisabled()
  expect(push).not.toHaveBeenCalled()
})

it('selects the exact linked variant and its minimum quantity', () => {
  render(<StoreProductDetail product={{ ...product, variants: [...product.variants, { id: 'v2', name: '指定套装', price_cents: 2200, stock_quantity: 100, min_quantity: 3 }] }} requestedVariantId="v2" checkoutEnabled />)
  expect(screen.getByRole('button', { name: '指定套装' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('spinbutton', { name: '数量' })).toHaveValue(3)
  fireEvent.click(screen.getByRole('button', { name: '立即购买' }))
  expect(push.mock.calls[0][0]).toContain('variant=v2&quantity=3')
})

it('does not silently purchase a different variant when the linked variant is unavailable', () => {
  render(<StoreProductDetail product={product} requestedVariantId="missing" checkoutEnabled />)
  expect(screen.getByRole('alert')).toHaveTextContent('链接中的规格已不可用')
  expect(screen.getByRole('button', { name: '暂无可售规格' })).toBeDisabled()
  expect(push).not.toHaveBeenCalled()
})

it('summarizes remote-region delivery and dispatch without repeating freight details', () => {
  render(<StoreProductDetail product={{ ...product, fulfillment_description: '付款后48小时内发货。中国大陆除新疆、西藏外包邮；新疆、西藏每单运费32元，不随购买数量增加。', shipping_province_overrides: { '新疆维吾尔自治区': 3200, '西藏自治区': 3200 } }} checkoutEnabled />)
  expect(screen.getByText('非偏远地区包邮')).toBeInTheDocument()
  expect(screen.getByText('付款后48小时内发货。')).toBeInTheDocument()
  expect(screen.queryByText(/每单运费32元/)).not.toBeInTheDocument()
  expect(screen.queryByText('免运费')).not.toBeInTheDocument()
})

it('changes kit images and project links without repeating the illustrated material list', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => ({ projects: [{ project: { id: url.includes('/small/') ? 1 : 2, title: url.includes('/small/') ? '土电话教程' : '液压机械手教程' }, confirmed: false, preparationStatus: 'unknown', extras: [] }], hasMore: false }) })))
  const kit = { id: 'k1', slug: 'small', name: '小班材料', kind: 'material_pack' as const, revision: 1, status: 'published' as const, cover_url: '/small.jpg', gallery_urls: ['/small-detail.jpg'], materials: ['小班配件'], catalog: ['土电话'], preparation_note: '纸杯需按说明准备' }
  render(<StoreProductDetail product={{ ...product, gallery_urls: ['/usage.jpg'], variants: [
    { ...product.variants[0], kit },
    { ...product.variants[0], id: 'v2', name: '中班规格', kit: { ...kit, id: 'k2', slug: 'middle', name: '中班材料', cover_url: '/middle.jpg', gallery_urls: ['/middle-detail.jpg'], materials: ['中班配件'], catalog: ['液压机械手'] } },
  ] }} checkoutEnabled />)
  expect(screen.queryByRole('button', { name: '查看商品图片 3' })).not.toBeInTheDocument()
  expect(await screen.findByRole('link', { name: '土电话教程' })).toHaveAttribute('href', '/project/1?kit=small')
  fireEvent.click(screen.getByRole('button', { name: '查看商品图片 2' }))
  fireEvent.click(screen.getByRole('button', { name: '中班规格' }))
  expect(screen.queryByText('小班配件')).not.toBeInTheDocument()
  expect(screen.queryByText('中班配件')).not.toBeInTheDocument()
  expect(screen.queryByText('盒内实验目录', { exact: false })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '土电话教程' })).not.toBeInTheDocument()
  expect(await screen.findByRole('link', { name: '液压机械手教程' })).toHaveAttribute('href', '/project/2?kit=middle')
  expect(screen.queryByText(/盒内材料是否覆盖教程所需尚未逐项确认/)).not.toBeInTheDocument()
  expect(screen.queryByText('纸杯需按说明准备。')).not.toBeInTheDocument()
  expect(screen.queryByText('材料待核对')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '查看商品图片 1' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByAltText('中班材料供应商详情')).toHaveAttribute('src', '/middle-detail.jpg')
})


it('shows general materials without fetching or linking project tutorials', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const kit = { id: 'general', slug: 'general', name: '启蒙款', kind: 'general_materials' as const, revision: 1, status: 'published' as const, cover_url: '/general.jpg', gallery_urls: [], materials: ['量杯'], catalog: ['调色大师'], preparation_note: '' }
  render(<StoreProductDetail checkoutEnabled product={{ ...product, variants: [{ ...product.variants[0], kit }] }} />)
  expect(screen.getByText('量杯')).toBeInTheDocument()
  expect(screen.getByText('调色大师')).toBeInTheDocument()
  expect(screen.queryByText('站内实验教程')).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})


it('keeps unique product details while removing duplicate prose and visible gallery captions', () => {
  const kit = { id: 'g', slug: 'g', name: '启蒙款', kind: 'general_materials' as const, revision: 1, status: 'published' as const, cover_url: '/cover.jpg', gallery_urls: ['/materials.jpg'], materials: [], catalog: [], preparation_note: '器材可重复使用。耗材需补充。' }
  const props = { ...product, description: '器材可重复使用。', detail_content: '器材可重复使用。', gallery_urls: ['/usage.jpg'], variants: [{ ...product.variants[0], kit }] }
  const { rerender } = render(<StoreProductDetail checkoutEnabled product={props} />)
  expect(screen.getAllByText('器材可重复使用。')).toHaveLength(1)
  expect(screen.queryByRole('heading', { name: '商品详情' })).not.toBeInTheDocument()
  expect(screen.queryByText('使用展示')).not.toBeInTheDocument()
  expect(screen.getByAltText('启蒙款供应商详情')).toHaveAttribute('src', '/materials.jpg')
  rerender(<StoreProductDetail checkoutEnabled product={{ ...props, detail_content: '独立的产品说明。' }} />)
  expect(screen.getByText('独立的产品说明。')).toBeInTheDocument()
})
