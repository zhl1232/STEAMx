'use client'

import Link from 'next/link'
import { ChevronLeft, Loader2, Package } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { AppReadingShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { money, storeJson } from '@/components/store/store-catalog-client'
import { useStoreCatalogVisible } from '@/lib/context/store-availability-context'

type Order = { id: string; status: string; total_cents: number; created_at: string; items: Array<{ title_snapshot: string; quantity: number; sku_snapshot: string }> }
const statusText: Record<string, string> = { pending_payment: '待支付', paid: '已支付', sourcing: '备货中', ordered: '待发货', shipped: '已发货', delivered: '已送达', failed: '处理中', cancelled: '已取消', refund_pending: '售后处理中', refunded: '已退款', partially_shipped: '部分发货' }
export default function StoreOrdersPage() {
  const catalogVisible = useStoreCatalogVisible()
  const query = useQuery({ queryKey: ['store-orders'], queryFn: () => storeJson<{ orders: Order[] }>('/api/store/orders', { cache: 'no-store' }) })
  return <AppReadingShell className="pb-24 pt-3 sm:pt-6">
    <header className="mb-6 flex min-h-11 items-center gap-3">
      <Link href={catalogVisible ? '/store' : '/profile'} aria-label={catalogVisible ? '返回商城' : '返回个人中心'} className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft aria-hidden className="h-5 w-5" /></Link>
      <h1 className="text-xl font-semibold">我的订单</h1>
      <Link href="/store/support" className="ml-auto inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">客服</Link>
    </header>
    {query.isPending ? <p role="status" className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 aria-hidden className="mr-2 h-5 w-5 animate-spin" />正在加载订单…</p> : null}
    {query.error ? <div className="py-10 text-center"><p role="alert" className="text-sm text-destructive">订单暂时无法加载</p><Button variant="outline" className="mt-4 h-11" onClick={() => void query.refetch()}>重新加载</Button></div> : null}
    <div className="divide-y divide-border/70">{query.data?.orders.map(order => <Link key={order.id} href={`/store/orders/${order.id}`} className="block py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:py-6">
      <div className="flex items-center justify-between gap-4"><span className="text-xs text-muted-foreground">订单 {order.id.slice(0, 8)}</span><span className="text-sm font-medium">{statusText[order.status] || '处理中'}</span></div>
      <p className="mt-3 text-sm font-medium leading-6">{order.items.map(item => `${item.title_snapshot} / ${item.sku_snapshot} × ${item.quantity}`).join('、')}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><time dateTime={order.created_at}>{new Date(order.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</time><span className="text-lg font-semibold tabular-nums text-foreground">{money(order.total_cents)}</span></div>
    </Link>)}</div>
    {query.data && !query.data.orders.length && !query.error ? <div className="flex flex-col items-center py-16 text-center sm:py-20">
      <Package aria-hidden strokeWidth={1.5} className="h-10 w-10 text-muted-foreground/60" />
      <h2 className="mt-5 text-base font-medium text-muted-foreground">暂无订单</h2>
      <Button asChild variant="outline" className="mt-6 h-11 px-6"><Link href={catalogVisible ? '/store' : '/courses'}>{catalogVisible ? '浏览商品' : '浏览技能课程'}</Link></Button>
    </div> : null}
  </AppReadingShell>
}
