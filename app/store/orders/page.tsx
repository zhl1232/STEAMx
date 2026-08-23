'use client'

import Link from 'next/link'
import { Loader2, Package } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { MobileGlobalHeader } from '@/components/layout/mobile-global-header'

type Order = { id: string; status: string; payment_status: string; total_cents: number; created_at: string; items: Array<{ title_snapshot: string; quantity: number; sku_snapshot: string }> }

async function loadOrders() {
  const response = await fetch('/api/store/orders', { cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || '订单加载失败')
  return body as { orders: Order[] }
}

const statusText: Record<string, string> = { pending_payment: '待支付', paid: '已支付', sourcing: '采购中', ordered: '已下单', shipped: '已发货', delivered: '已送达', failed: '处理失败', cancelled: '已取消' }

export default function StoreOrdersPage() {
  const query = useQuery({ queryKey: ['store-orders'], queryFn: loadOrders })
  return <main className="min-h-screen bg-[hsl(var(--surface-sunken))]"><MobileGlobalHeader variant="title" title="本站材料包订单" rightSlot={<Link className="text-sm font-semibold text-primary" href="/store">回到商城</Link>} /><div className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><div className="mb-6 flex items-center gap-3"><Package className="h-6 w-6 text-primary" /><div><h1 className="text-2xl font-black">本站订单记录</h1><p className="text-sm text-muted-foreground">这里只显示 STEAMX 过渡订单；淘宝订单请在淘宝 App/网页查看</p></div></div>{query.isPending ? <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中…</div> : null}{query.error ? <p className="rounded-xl border border-destructive/30 p-5 text-sm text-destructive">订单暂时无法加载。</p> : null}<div className="space-y-4">{query.data?.orders.map((order) => <Link key={order.id} href={`/store/orders/${order.id}`} className="block rounded-xl border border-border/70 bg-background p-5 shadow-sm transition hover:border-primary/50"><div className="flex items-center justify-between gap-4"><span className="font-semibold">订单 {order.id.slice(0, 8)}</span><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{statusText[order.status] || order.status}</span></div><p className="mt-3 text-sm text-muted-foreground">{order.items.map((item) => `${item.title_snapshot} × ${item.quantity}`).join('、')}</p><div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>{new Date(order.created_at).toLocaleString('zh-CN')}</span><span className="text-base font-bold text-foreground">¥{(order.total_cents / 100).toFixed(2)}</span></div></Link>)}</div>{query.data && !query.data.orders.length ? <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">还没有本站材料包订单；淘宝购买记录请回到淘宝查看。</div> : null}</div></main>
}
