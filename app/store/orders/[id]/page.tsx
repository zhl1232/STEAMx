import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requirePageUser } from '@/lib/auth/server'
import { isUuid } from '@/lib/store/http'
import { getSafeOrderExtras } from '@/lib/store/operations'
import { getUserStoreOrder } from '@/lib/store/service'
import type { StoreOrderWithItems } from '@/lib/store/service'
import { AppReadingShell } from '@/components/layout/app-shell'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { StoreQuoteBreakdown } from '@/components/store/store-checkout'
import { isStorePaymentEnabled } from '@/lib/store/config'
import { StoreOrderActions } from '@/components/store/store-order-actions'

export const dynamic = 'force-dynamic'
const statusText: Record<string, string> = {
  pending_payment: '待支付',
  paid: '已支付',
  sourcing: '采购中',
  ordered: '待发货',
  partially_shipped: '部分发货',
  shipped: '已发货',
  delivered: '已送达',
  cancelled: '已取消',
  refund_pending: '退款处理中',
  refunded: '已退款',
  failed: '处理失败',
}

export default async function StoreOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { supabase, user } = await requirePageUser()
  const { id } = await params
  if (!isUuid(id)) notFound()
  const order = (await getUserStoreOrder(supabase, user.id, id)) as
    | (StoreOrderWithItems & {
        events: Array<{
          id: number
          event_type: string
          message: string | null
          created_at: string
        }>
      })
    | null
  if (!order) notFound()
  const extras = await getSafeOrderExtras(id)
  const paymentProviders = (['alipay', 'wechat'] as const).filter(provider => isStorePaymentEnabled(provider))
  const discounts = order as typeof order & { original_subtotal_cents?: number; member_subtotal_cents?: number; member_discount_cents?: number; coupon_discount_cents?: number; coin_discount_cents?: number; coins_used?: number; membership_tier_snapshot?: 'free' | 'pro' | 'founder'; coupon_id?: string | null }
  return (
    <main>
      <AppReadingShell className="pb-24 pt-8">
        <Button asChild variant="ghost" className="h-11">
          <Link href="/store/orders">← 返回订单</Link>
        </Button>
        <Surface className="mt-5 p-6">
          <h1 className="text-page-title">订单 {order.id.slice(0, 8)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            状态：{statusText[order.status] || order.status} · 支付：
            {{
              paid: '已支付',
              refunded: '已退款',
              pending: '待确认',
              unpaid: '未支付',
              failed: '已关闭',
            }[order.payment_status] || '待确认'}
          </p>
          <div className="mt-6 space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between border-b pb-3 text-sm"
              >
                <span>
                  {item.title_snapshot} / {item.sku_snapshot} × {item.quantity}
                </span>
                <span>
                  ¥{((item.unit_price_cents * item.quantity) / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6"><StoreQuoteBreakdown quote={{ originalSubtotalCents: discounts.original_subtotal_cents ?? order.subtotal_cents, memberSubtotalCents: discounts.member_subtotal_cents ?? order.subtotal_cents, memberDiscountCents: discounts.member_discount_cents || 0, couponDiscountCents: discounts.coupon_discount_cents || 0, coinDiscountCents: discounts.coin_discount_cents || 0, coinsUsed: discounts.coins_used || 0, shippingCents: order.shipping_cents, totalCents: order.total_cents, membershipTier: discounts.membership_tier_snapshot || 'free', couponId: discounts.coupon_id || null }} /></div>
          {order.events?.length ? (
            <div className="mt-5 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">订单进度</p>
              {order.events.map((event) => (
                <p key={event.id} className="mt-2">
                  {new Date(event.created_at).toLocaleString('zh-CN', { timeZone: "Asia/Shanghai" })} ·{' '}
                  {event.message || event.event_type}
                </p>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-right text-sm text-muted-foreground">
            含运费 ¥{(order.shipping_cents / 100).toFixed(2)}
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            {extras.learningLinks.length ? (
              extras.learningLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-primary"
                >
                  {link.label} →
                </Link>
              ))
            ) : (
              <Link
                href="/courses"
                className="text-sm font-medium text-primary"
              >
                继续学习 →
              </Link>
            )}
          </div>
          <Button asChild variant="outline" shape="pill" className="mt-5 h-11"><Link href={`/store/support?orderId=${order.id}`}>联系订单客服</Link></Button>
          <StoreOrderActions
            paymentProviders={paymentProviders}
            orderId={order.id}
            status={order.status}
            paymentStatus={order.payment_status}
            shipment={
              extras.shipment
                ? {
                    carrier: extras.shipment.carrier,
                    trackingNumber: extras.shipment.tracking_number,
                  }
                : null
            }
            aftersale={extras.aftersale}
          />
        </Surface>
      </AppReadingShell>
    </main>
  )
}
