'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AppReadingShell } from '@/components/layout/app-shell'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { money, storeJson } from '@/components/store/store-catalog-client'
import { useStoreCatalogVisible } from '@/lib/context/store-availability-context'

type Coupon = { id: string; title: string; threshold_cents: number; discount_cents: number; terms: string; expires_at: string; status: string; eligible: boolean; source?: string }
export default function CouponsPage() {
  const catalogVisible = useStoreCatalogVisible()
  const query = useQuery({ queryKey: ['store-coupons'], queryFn: async () => ({ ...await storeJson<{ coupons: Coupon[] }>('/api/store/coupons', { cache: 'no-store' }), checkedAt: Date.now() }) })
  return <main><AppReadingShell className="pb-24 pt-8"><nav className="flex flex-wrap gap-3"><Button asChild variant="ghost"><Link href={catalogVisible ? '/store' : '/profile'}>{catalogVisible ? '← 材料商城' : '← 个人中心'}</Link></Button><Button asChild variant="outline"><Link href="/coins?tab=coupons">用硬币兑换券</Link></Button></nav><h1 className="my-8 text-page-title">我的优惠券</h1>
    {query.isPending ? <p role="status">正在加载优惠券…</p> : null}
    {query.isError ? <div role="alert"><p>优惠券暂时无法加载。</p><Button variant="outline" onClick={() => void query.refetch()}>重试</Button></div> : null}
    {query.data?.coupons.length === 0 ? <Surface className="p-8"><h2 className="text-panel-title">还没有优惠券</h2><p className="mt-3 text-muted-foreground">可在“我的硬币”中查看可兑换的优惠券。</p></Surface> : null}
    <div className="space-y-4">{query.data?.coupons.map(coupon => {
      const expired = Date.parse(coupon.expires_at) <= (query.data?.checkedAt ?? 0)
      const status = coupon.status === 'reserved' ? '订单占用中' : coupon.status === 'used' ? '已使用' : expired ? '已过期' : coupon.eligible ? '可用' : '当前资格不符合'
      return <Surface key={coupon.id} className="p-5 sm:p-6"><div className="flex justify-between gap-4"><h2 className="text-panel-title">{coupon.title}</h2><span className="text-sm text-muted-foreground">{status}</span></div><p className="mt-4 text-lg font-semibold">满 {money(coupon.threshold_cents)} 减 {money(coupon.discount_cents)}</p><p className="mt-2 text-sm text-muted-foreground">{new Date(coupon.expires_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} 到期</p><p className="mt-3 whitespace-pre-line text-sm leading-6">{coupon.terms}</p><p className="mt-2 text-sm text-muted-foreground">运费不参与优惠；门槛按会员折后商品金额计算。</p>{coupon.eligible && catalogVisible ? <Button asChild variant="outline" className="mt-4"><Link href="/store">去材料商城</Link></Button> : null}</Surface>
    })}</div>
  </AppReadingShell></main>
}
