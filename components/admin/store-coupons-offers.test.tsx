import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { StoreCouponOffers } from './store-coupons-offers'
it('requires explicit price and limits and saves an inactive offer by default', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ offers: [] }))))
  render(<StoreCouponOffers templates={[{ id: 't1', title: '材料券' }]} />)
  expect(screen.getByLabelText('开放兑换')).not.toBeChecked()
  expect(screen.getByLabelText('每张所需硬币')).toHaveValue(null)
  fireEvent.change(screen.getByLabelText('优惠券模板'), { target: { value: 't1' } })
  for (const [label, value] of [['每张所需硬币', 500], ['累计兑换总上限', 20], ['每人累计限兑', 2]]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
  await userEvent.click(screen.getByRole('button', { name: '保存兑换配置' }))
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(c => c[1]?.method === 'POST')).toBe(true))
  const call = vi.mocked(fetch).mock.calls.find(c => c[1]?.method === 'POST')!
  expect(JSON.parse(String(call[1]?.body))).toMatchObject({ templateId: 't1', coinPrice: 500, totalLimit: 20, perUserLimit: 2, active: false })
})
