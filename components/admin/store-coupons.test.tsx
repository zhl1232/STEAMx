import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreCoupons } from './store-coupons'
const template = { id: '00000000-0000-4000-8000-000000000001', title: '材料券', threshold_cents: 5000, discount_cents: 500, valid_days: 30, terms: '仅限适用材料；有效期内使用', active: true, eligible_product_ids: ['00000000-0000-4000-8000-000000000002'] }
const respond = (body: unknown) => new Response(JSON.stringify(body))
describe('manual store coupons', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (init?.method === 'POST' && String(url).endsWith('/batches')) return respond({ grantedCount: 1 })
      if (String(url).endsWith('/batches')) return respond({ batches: [] })
      if (String(url).endsWith('/catalog')) return respond({ products: [{ id: template.eligible_product_ids[0], name: '探索材料' }] })
      return respond({ templates: [template] })
    }))
  })
  it('keeps the default 50-minus-5 template inactive without granting coupons', async () => {
    const user = userEvent.setup()
    render(<StoreCoupons />)
    await screen.findByText('探索材料')
    expect(screen.getByLabelText(/启用模板/)).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: '保存模板' }))
    await screen.findByText('优惠券模板已保存；不会自动发券。')
    const calls = vi.mocked(fetch).mock.calls.filter(c => c[1]?.method === 'POST')
    expect(calls).toHaveLength(1)
    expect(JSON.parse(String(calls[0][1]?.body))).toMatchObject({ thresholdCents: 5000, discountCents: 500, active: false, eligibleProductIds: [], validDays: null })
  })
  it('requires a review and reuses the batch key after uncertain issuance', async () => {
    const user = userEvent.setup()
    let attempted = false
    const implementation = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (init?.method === 'POST' && String(url).endsWith('/batches') && !attempted) { attempted = true; throw new TypeError('发放超时') }
      return implementation(url, init)
    })
    render(<StoreCoupons />)
    await screen.findByText('探索材料')
    fireEvent.change(screen.getByLabelText('发放模板'), { target: { value: template.id } })
    fireEvent.change(screen.getByLabelText(/用户 UUID 名单/), { target: { value: '00000000-0000-4000-8000-000000000003' } })
    await user.click(screen.getByRole('button', { name: '核对名单与发放数量' }))
    expect(vi.mocked(fetch).mock.calls.filter(c => c[1]?.method === 'POST')).toHaveLength(0)
    expect(screen.getByText('收件人 1 人 · 每人一张 · 共 1 张')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认发放本批优惠券' }))
    await screen.findByText('发放超时')
    expect(screen.getByLabelText('发放模板')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '重试核查同一批次' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已确认发放 1 张优惠券'))
    const calls = vi.mocked(fetch).mock.calls.filter(c => c[1]?.method === 'POST')
    expect(calls).toHaveLength(2)
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual(JSON.parse(String(calls[1][1]?.body)))
  })
})
