'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/context/auth-context'
import { useGamification } from '@/lib/context/gamification-context'
import { AppWideShell } from '@/components/layout/app-shell'
import { MobileGlobalHeader } from '@/components/layout/mobile-global-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import AppearanceExchange from '@/components/features/coins/appearance-exchange'
import CoinHistory from '@/components/features/coins/coin-history'
import CouponExchange from '@/components/features/coins/coupon-exchange'

type Tab = 'appearance' | 'coupons' | 'history'
function readTab(): Tab {
  const tab = new URLSearchParams(window.location.search).get('tab')
  return tab === 'coupons' || tab === 'history' ? tab : 'appearance'
}
export default function CoinsPage() {
  const { user, loading } = useAuth()
  const { coins = 0 } = useGamification()
  const [tab, setTab] = useState<Tab>('appearance')
  useEffect(() => {
    const sync = () => setTab(readTab())
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  if (loading || !user) return <p role="status">正在加载账号…</p>
  return <main className="pb-24"><MobileGlobalHeader variant="title" title="我的硬币" showNotification={false} showUserButton={false} className="md:hidden" /><AppWideShell className="space-y-6 pt-6">
    <header><h1 className="hidden text-page-title md:block">我的硬币</h1><p className="mt-4 text-sm text-muted-foreground">可用硬币</p><p className="mt-2 text-4xl font-semibold tabular-nums">{coins.toLocaleString()} <span className="text-base font-normal">枚</span></p><p className="mt-3 text-sm text-muted-foreground">兑换装扮、材料优惠券，或为喜欢的作品投币。</p></header>
    <Tabs value={tab} onValueChange={value => { setTab(value as Tab); const url = new URL(window.location.href); url.searchParams.set('tab', value); window.history.pushState(null, '', url) }}>
      <TabsList className="grid h-auto w-full grid-cols-3 sm:w-fit"><TabsTrigger className="min-h-11" value="appearance">装扮兑换</TabsTrigger><TabsTrigger className="min-h-11" value="coupons">优惠券兑换</TabsTrigger><TabsTrigger className="min-h-11" value="history">收支明细</TabsTrigger></TabsList>
      <TabsContent value="appearance" className="mt-6"><AppearanceExchange /></TabsContent><TabsContent value="coupons" className="mt-6"><CouponExchange /></TabsContent><TabsContent value="history" className="mt-6"><CoinHistory /></TabsContent>
    </Tabs>
  </AppWideShell></main>
}
