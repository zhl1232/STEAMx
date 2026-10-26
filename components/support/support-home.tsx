'use client'
import { useEffect,useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { Button } from '@/components/ui/button'
import type { SupportChannel } from '@/lib/support/channels'
import { SUPPORT_CHANNEL_LABELS } from '@/lib/support/channels'
import { SupportChat,supportFetch } from './support-chat'
export function SupportHome({channel='platform'}:{channel?:SupportChannel}) {
  const {user,loading}=useAuth()
  const {promptLogin}=useLoginPrompt()
  const search=useSearchParams()
  const [owned,setOwned]=useState<{userId:string;channel:SupportChannel;id:string}>({userId:'',channel,id:''})
  const [failure,setFailure]=useState<{userId:string;channel:SupportChannel;message:string}|null>(null)
  useEffect(()=>{let active=true;if(user)void supportFetch(`/api/support/conversation?channel=${channel}`,{method:'POST'}).then(data=>{if(active){setOwned({userId:user.id,channel,id:data.conversation.id});setFailure(null)}}).catch(e=>{if(active)setFailure({userId:user.id,channel,message:e.message})});return()=>{active=false}},[user,channel])
  if(loading)return <p role="status">正在加载…</p>
  const label=SUPPORT_CHANNEL_LABELS[channel]
  if(!user)return <div className="space-y-3"><p>登录后即可留下问题，并在消息中心查看{label}回复。</p><Button tone="brand" shape="pill" className="h-12" onClick={()=>promptLogin(()=>window.location.reload(),{title:`登录后联系${label}`,description:'保留会话，方便查看后续回复。'})}>登录并联系{label}</Button></div>
  if(failure?.userId===user.id&&failure.channel===channel)return <p role="alert">{failure.message}<Button variant="outline" className="ml-3 h-11" onClick={()=>window.location.reload()}>重试</Button></p>
  return owned.userId===user.id&&owned.channel===channel&&owned.id?<SupportChat key={`${user.id}:${owned.id}`} conversationId={owned.id} productId={channel==='store'?(search.get('productId')??undefined):undefined} orderId={channel==='store'?(search.get('orderId')??undefined):undefined}/>:<p role="status">正在打开{label}会话…</p>
}
