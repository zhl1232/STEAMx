/** Buyer-facing progress copy also covers events stored by older order functions. */
const orderEventLabels: Record<string, string> = {
  created: '订单已创建，请在 30 分钟内完成付款',
  paid: '支付成功，等待商家备货',
  cancelled: '订单已取消',
  expired: '订单已超时关闭',
  record_procurement: '商家已备货，等待发货',
  ship: '商品已发货',
  confirm_delivery: '已确认收货',
  refund_requested: '售后申请已提交，等待审核',
  approve_refund: '售后已通过，退款处理中',
  require_return: '请按退货说明寄回商品',
  reject_refund: '售后申请未通过，请联系客服',
  return_shipped: '退货已寄出，等待商家收货',
  receive_return: '商家已收到退货，退款处理中',
  refund_closed: '本次退款未完成，等待商家重新处理',
  refund_abnormal: '退款遇到异常，商家正在核查',
  refund_restarted: '商家已重新发起退款，等待渠道确认',
  refunded: '退款成功，款项原路退回',
  alibaba_order_created: '商家已备货，等待发货',
  alibaba_order_failed: '备货处理中，请联系客服了解进度',
}

export function storeOrderEventLabel(eventType: string): string {
  return Object.hasOwn(orderEventLabels, eventType) ? orderEventLabels[eventType] : '订单进度已更新'
}
