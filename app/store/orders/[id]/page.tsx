import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requirePageUser } from '@/lib/auth/server'
import { isUuid } from '@/lib/store/http'
import { getUserStoreOrder } from '@/lib/store/service'
import type { StoreOrderWithItems } from '@/lib/store/service'

export const dynamic = 'force-dynamic'

export default async function StoreOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requirePageUser()
  const { id } = await params
  if (!isUuid(id)) notFound()
  const order = await getUserStoreOrder(supabase, user.id, id) as (StoreOrderWithItems & { events: Array<{ id: number; event_type: string; message: string | null; created_at: string }> }) | null
  if (!order) notFound()
  return <main className="min-h-screen bg-[hsl(var(--surface-sunken))] px-4 py-8"><div className="mx-auto max-w-2xl"><Link href="/store/orders" className="text-sm font-semibold text-primary">← 返回订单</Link><div className="mt-5 rounded-2xl border bg-background p-6 shadow-sm"><h1 className="text-2xl font-black">订单 {order.id.slice(0, 8)}</h1><p className="mt-2 text-sm text-muted-foreground">状态：{order.status} · 支付：{order.payment_status}</p><div className="mt-6 space-y-3">{order.items.map((item) => <div key={item.id} className="flex justify-between border-b pb-3 text-sm"><span>{item.title_snapshot} / {item.sku_snapshot} × {item.quantity}</span><span>¥{((item.unit_price_cents * item.quantity) / 100).toFixed(2)}</span></div>)}</div><p className="mt-5 text-right text-xl font-black">合计 ¥{(order.total_cents / 100).toFixed(2)}</p><p className="mt-4 rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">收货地址已加密保存。支付通道和 1688 代发状态由服务端 webhook/任务同步更新。</p></div></div></main>
}
