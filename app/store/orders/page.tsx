'use client'

import Link from 'next/link'
import { Loader2, Package } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { AppReadingShell } from '@/components/layout/app-shell'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { money, storeJson } from '@/components/store/store-catalog-client'
import { useStoreCatalogVisible } from '@/lib/context/store-availability-context'

type Order = { id: string; status: string; total_cents: number; created_at: string; items: Array<{ title_snapshot: string; quantity: number; sku_snapshot: string }> }
const statusText: Record<string, string> = { pending_payment: '待支付', paid: '已支付', sourcing: '备货中', ordered: '待发货', shipped: '已发货', delivered: '已送达', failed: '处理中', cancelled: '已取消', refund_pending: '售后处理中', refunded: '已退款', partially_shipped: '部分发货' }
export default function StoreOrdersPage() {
  const catalogVisible = useStoreCatalogVisible()
  const query = useQuery({ queryKey: ['store-orders'], queryFn: () => storeJson<{ orders: Order[] }>('/api/store/orders', { cache: 'no-store' }) })
  return <main><AppReadingShell className="pb-24 pt-8"><nav aria-label="订单导航" className="flex items-center justify-between gap-3"><Button asChild variant="ghost" className="h-11"><Link href={catalogVisible ? "/store" : "/profile"}>{catalogVisible ? "← 浏览商品" : "← 返回个人中心"}</Link></Button><Button asChild variant="outline" shape="pill" className="h-11"><Link href="/courses">继续学习</Link></Button></nav><header className="py-8"><p className="section-kicker">创探实物商店</p><h1 className="mt-3 text-page-title">我的订单</h1><p className="mt-3 text-sm text-muted-foreground">查看本站商品的付款、配送与售后进度。</p></header>
  {query.isPending ? <p role="status" className="flex items-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />正在加载订单…</p> : null}
  {query.error ? <Surface className="p-6"><p role="alert" className="text-sm text-destructive">订单暂时无法加载，请稍后重试。</p><Button variant="outline" className="mt-4 h-11" onClick={() => void query.refetch()}>重新加载</Button></Surface> : null}
  <div className="space-y-4">{query.data?.orders.map(order => <Surface key={order.id} interactive><Link href={`/store/orders/${order.id}`} className="block p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><span className="font-semibold">订单 {order.id.slice(0, 8)}</span><span className="text-sm font-semibold text-primary">{statusText[order.status] || '处理中'}</span></div><p className="mt-4 text-sm leading-6">{order.items.map(item => `${item.title_snapshot} / ${item.sku_snapshot} × ${item.quantity}`).join('、')}</p><div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><time dateTime={order.created_at}>{new Date(order.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</time><span className="text-lg font-semibold text-foreground">{money(order.total_cents)}</span></div></Link></Surface>)}</div>
  {query.data && !query.data.orders.length ? <Surface className="p-10 text-center"><Package className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-4 text-panel-title">还没有本站订单</h2><p className="mt-2 text-sm text-muted-foreground">从一件适合的材料，开始下一次探索。</p><Button asChild tone="brand" shape="pill" className="mt-5 h-12"><Link href={catalogVisible ? "/store" : "/courses"}>{catalogVisible ? "去看看商品" : "浏览技能课程"}</Link></Button></Surface> : null}
  <p className="mt-8 text-xs text-muted-foreground">此前在淘宝购买的商品，请在淘宝查看订单与售后。</p></AppReadingShell></main>
}
