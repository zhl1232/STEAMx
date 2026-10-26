import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { SupportHome } from '@/components/support/support-home'
export const metadata={title:'平台帮助',robots:{index:false,follow:false}}
export default async function SupportPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const search=await searchParams
  const context=new URLSearchParams()
  for(const key of ['productId','orderId']) {
    const value=search[key]
    if(typeof value==='string'&&value)context.set(key,value)
  }
  if(context.size)redirect(`/store/support?${context}`)
  return <main className="app-shell-narrow space-y-5 py-6 pb-28"><header className="space-y-2"><h1 className="text-page-title">平台帮助</h1><p className="text-sm text-muted-foreground">课程使用、账号问题和社区反馈，可以在这里留言。</p></header><Suspense fallback={<p>正在加载…</p>}><SupportHome channel="platform"/></Suspense></main>
}
