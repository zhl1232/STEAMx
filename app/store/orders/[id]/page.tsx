import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requirePageUser } from '@/lib/auth/server'
import { isUuid } from '@/lib/store/http'
import { getSafeOrderExtras } from '@/lib/store/operations'
import { getUserStoreOrder } from '@/lib/store/service'
import type { StoreOrderWithItems } from '@/lib/store/service'
import { AppReadingShell } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { storeOrderEventLabel } from '@/lib/store/order-presentation'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { StoreQuoteBreakdown } from '@/components/store/store-checkout'
import { isStorePaymentEnabled } from '@/lib/store/config'
import { StoreOrderActions } from '@/components/store/store-order-actions'

export const dynamic = 'force-dynamic'
const statusText: Record<string, string> = {
  pending_payment: '待支付',
  paid: '已支付',
  sourcing: '备货中',
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
        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">我的订单</p>
            <h1 className="mt-2 text-page-title">{statusText[order.status] || '订单处理中'}</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {order.status === 'pending_payment' ? '请在下单后 30 分钟内完成付款，付款成功后我们会安排备货。' : '在这里查看商品、配送与售后进度。'}
            </p>
          </div>
          <StatusBadge className="mt-2 px-3 py-1.5 text-sm" status={order.payment_status === 'paid' ? 'success' : order.status === 'pending_payment' ? 'warning' : 'neutral'}>
            {{ paid: '已支付', refunded: '已退款', pending: '支付待确认', unpaid: '未支付', failed: '支付已关闭' }[order.payment_status] || '支付待确认'}
          </StatusBadge>
        </header>
        <Surface className="mt-6 p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-4">
            <h2 className="text-panel-title">商品与金额</h2>
            <span className="text-sm text-muted-foreground">订单 {order.id.slice(0, 8)}</span>
          </div>
          <div className="mt-6 space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-4 border-b border-border/60 pb-4 text-sm"
              >
                <div className="min-w-0">
                  <p className="break-words font-semibold leading-6">{item.title_snapshot}</p>
                  <p className="mt-1 break-words text-muted-foreground">规格：{item.sku_snapshot} · 数量：{item.quantity}</p>
                </div>
                <span className="shrink-0 pt-1 font-medium tabular-nums">
                  ¥{((item.unit_price_cents * item.quantity) / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6"><StoreQuoteBreakdown quote={{ originalSubtotalCents: discounts.original_subtotal_cents ?? order.subtotal_cents, memberSubtotalCents: discounts.member_subtotal_cents ?? order.subtotal_cents, memberDiscountCents: discounts.member_discount_cents || 0, couponDiscountCents: discounts.coupon_discount_cents || 0, coinDiscountCents: discounts.coin_discount_cents || 0, coinsUsed: discounts.coins_used || 0, shippingCents: order.shipping_cents, totalCents: order.total_cents, membershipTier: discounts.membership_tier_snapshot || 'free', couponId: discounts.coupon_id || null }} /></div>
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
          {order.events?.length ? (
            <section className="mt-8 border-t border-border/70 pt-6" aria-label="订单进度">
              <h2 className="text-panel-title">订单进度</h2>
              <ol className="mt-5 space-y-5 border-l border-border pl-5">
                {order.events.map((event) => (
                  <li key={event.id} className="relative">
                    <span aria-hidden="true" className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                    <p className="text-sm leading-6">{storeOrderEventLabel(event.event_type)}</p>
                    <time dateTime={event.created_at} className="mt-1 block text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                    </time>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
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
        </Surface>
      </AppReadingShell>
    </main>
  )
}
