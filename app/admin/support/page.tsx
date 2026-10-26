import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/api/auth'
import { SupportInbox } from '@/components/support/support-inbox'
import { uuid } from '@/lib/support/validation'
export default async function AdminSupportPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const search=await searchParams
  const destination=new URLSearchParams()
  if(search.channel==='platform'||search.channel==='store')destination.set('channel',search.channel)
  if(typeof search.conversation==='string') {
    try {destination.set('conversation',uuid(search.conversation))}catch { /* Ignore an invalid deep-link identifier. */ }
  }
  const returnTo=`/admin/support${destination.size?`?${destination}`:''}`
  try {await requireRole(await createClient(),['admin'])}catch {redirect(`/login?next=${encodeURIComponent(returnTo)}`)}
  return <main className="app-shell-standard space-y-5 py-6"><h1 className="text-page-title">帮助与客服收件箱</h1><Suspense fallback={<p>正在加载…</p>}><SupportInbox/></Suspense></main>
}
