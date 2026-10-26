import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { StoreProductDetail } from './store-product-detail'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

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
  expect(screen.queryByRole('button', { name: '立即购买' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: '联系商城客服' })).toHaveAttribute('href', '/store/support')
  expect(screen.getByRole('link', { name: '← 返回编辑商品' })).toHaveAttribute('href', '/admin/store?product=draft-1')
  fireEvent.click(screen.getByRole('button', { name: '保存的蓝色套装（已暂停）' }))
  expect(screen.getByText('库存待确认 · 1 件起订')).toBeInTheDocument()
})
