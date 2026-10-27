import { describe, expect, it } from 'vitest'
import { storeOrderEventLabel } from './order-presentation'

describe('buyer order progress', () => {
  it('presents legacy created and paid events in Chinese', () => {
    expect(storeOrderEventLabel('created')).toBe('订单已创建，请在 30 分钟内完成付款')
    expect(storeOrderEventLabel('paid')).toBe('支付成功，等待商家备货')
  })

  it('does not expose unknown internal event identifiers', () => {
    expect(storeOrderEventLabel('internal_reconciliation')).toBe('订单进度已更新')
  })
})
