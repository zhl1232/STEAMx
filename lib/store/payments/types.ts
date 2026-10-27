export type PaymentProvider = 'alipay' | 'wechat'
export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'paid'
  | 'closed'
  | 'refunded'
  | 'failed'
  | 'not_found'
  | 'unknown'
  | 'refund_closed'
  | 'refund_abnormal'

export interface PaymentOrder {
  orderId: string
  merchantReference?: string
  amountCents: number
  currency: 'CNY'
  subject: string
  expiresAt: string
  description?: string
  notifyUrl?: string
  returnUrl?: string
  clientIp?: string
  device?: 'native' | 'h5' | 'page' | 'wap'
}
export interface PaymentResult {
  provider: PaymentProvider
  orderId: string
  providerOrderId?: string
  status: PaymentStatus
  amountCents?: number
  currency: 'CNY'
  raw?: unknown
  checkout?: string
  checkoutKind?: 'redirect' | 'qr'
}
export interface RefundRequest {
  orderId: string
  refundId: string
  amountCents: number
  totalAmountCents?: number
  reason?: string
}
export interface RefundResult {
  provider: PaymentProvider
  orderId: string
  refundId: string
  status: PaymentStatus
  amountCents?: number
  currency: 'CNY'
  raw?: unknown
}
export interface Notification {
  provider: PaymentProvider
  orderId: string
  providerOrderId?: string
  status: PaymentStatus
  amountCents?: number
  currency: 'CNY'
  refundId?: string
  raw: unknown
}
export interface PaymentTransport {
  request(input: {
    method: string
    path: string
    body?: string
    headers?: Record<string, string>
  }): Promise<{
    status: number
    headers?: Record<string, string>
    body: string
  }>
}
export interface PaymentAdapter {
  create(order: PaymentOrder): Promise<PaymentResult>
  query(orderId: string): Promise<PaymentResult>
  close(orderId: string): Promise<PaymentResult>
  verifyNotification(input: {
    headers?: Record<string, string>
    body: string
    query?: Record<string, string>
  }): Promise<Notification>
  refund(request: RefundRequest): Promise<RefundResult>
  queryRefund(orderId: string, refundId: string): Promise<RefundResult>
}

export function cents(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error('amount must be a positive integer number of cents')
  return value
}
export function yuan(value: number): string {
  return (cents(value) / 100).toFixed(2)
}
export function moneyCents(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value))
    throw new Error('invalid money')
  const n = Number(value)
  if (!Number.isSafeInteger(Math.round(n * 100)) || Math.round(n * 100) <= 0)
    throw new Error('invalid money')
  return Math.round(n * 100)
}
