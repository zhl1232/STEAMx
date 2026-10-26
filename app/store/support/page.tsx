import { Suspense } from 'react'
import { SupportHome } from '@/components/support/support-home'
export const metadata={title:'商城客服',robots:{index:false,follow:false}}
export default function StoreSupportPage() {
  return <main className="app-shell-narrow space-y-5 py-6 pb-28"><header className="space-y-2"><h1 className="text-page-title">商城客服</h1><p className="text-sm text-muted-foreground">商品咨询、订单配送和退换货售后，可以在这里联系商城客服。</p></header><Suspense fallback={<p>正在加载…</p>}><SupportHome channel="store"/></Suspense></main>
}
