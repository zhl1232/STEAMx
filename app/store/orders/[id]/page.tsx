import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requirePageUser } from '@/lib/auth/server'
import { isUuid } from '@/lib/store/http'
import { getSafeOrderExtras } from '@/lib/store/operations'
import { getUserStoreOrder } from '@/lib/store/service'
import type { StoreOrderWithItems } from '@/lib/store/service'
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
  return (
    <main className="min-h-screen bg-[hsl(var(--surface-sunken))] px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/store/orders"
          className="text-sm font-semibold text-primary"
        >
          ← 返回订单
        </Link>
        <div className="mt-5 rounded-2xl border bg-background p-6 shadow-sm">
          <h1 className="text-2xl font-black">订单 {order.id.slice(0, 8)}</h1>
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
          <p className="mt-5 text-right text-xl font-black">
            合计 ¥{(order.total_cents / 100).toFixed(2)}
          </p>
          {order.events?.length ? (
            <div className="mt-5 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">订单进度</p>
              {order.events.map((event) => (
                <p key={event.id} className="mt-2">
                  {new Date(event.created_at).toLocaleString('zh-CN')} ·{' '}
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
          <StoreOrderActions
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
        </div>
      </div>
    </main>
  )
}
