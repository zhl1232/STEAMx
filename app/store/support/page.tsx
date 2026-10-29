import { Suspense } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { SupportHome } from '@/components/support/support-home'
import { isStoreCatalogVisible } from '@/lib/store/config'
export const metadata={title:'商城客服',robots:{index:false,follow:false}}
export default function StoreSupportPage() {
  const catalogVisible=isStoreCatalogVisible()
  return <div className="app-shell-narrow space-y-6 pb-28 pt-3 sm:pt-6"><header className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-2"><Link href={catalogVisible?'/store':'/profile'} aria-label={catalogVisible?'返回商城':'返回个人中心'} className="flex h-11 w-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"><ChevronLeft aria-hidden className="h-5 w-5"/></Link><h1 className="text-xl font-semibold">商城客服</h1></div><Link href="/messages?tab=support" className="inline-flex min-h-11 shrink-0 items-center text-sm text-muted-foreground hover:text-foreground">服务消息</Link></header><Suspense fallback={<p role="status">正在加载…</p>}><SupportHome channel="store"/></Suspense></div>
}
