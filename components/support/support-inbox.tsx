'use client'
import { useCallback,useEffect,useRef,useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import type { SupportConversation } from '@/lib/support/types'
import { SUPPORT_CHANNEL_LABELS } from '@/lib/support/channels'
import type { SupportChannel } from '@/lib/support/channels'
import { SupportChat,supportFetch } from './support-chat'
type Inbox={conversations:(SupportConversation&{unreadCount:number})[];nextOffset:number|null;notificationHealth:{configured:boolean;pending:number}}
export function SupportInbox() {
  const search=useSearchParams()
  const [id,setId]=useState(search.get('conversation')??'')
  const [channel,setChannel]=useState<SupportChannel>(search.get('channel')==='store'?'store':'platform')
  const [resolvedChannel,setResolvedChannel]=useState<SupportChannel|null>(null)
  const [state,setState]=useState<{key:string;inbox:Inbox}|null>(null)
  const [error,setError]=useState('');const [offset,setOffset]=useState(0)
  const key=`${channel}:${offset}`
  const requestEpoch=useRef(0)
  const inbox=state?.key===key?state.inbox:null
  const invalidateRequests=useCallback(()=>{requestEpoch.current++},[])
  const load=useCallback(async()=>{if(document.visibilityState==='hidden')return;const requestId=++requestEpoch.current;try{const data=await supportFetch(`/api/admin/support/conversations?channel=${channel}&offset=${offset}`);if(requestEpoch.current===requestId){setState({key,inbox:data});setError('')}}catch(e){if(requestEpoch.current===requestId)setError(e instanceof Error?e.message:'加载失败')}},[channel,offset,key])
  useEffect(()=>{let active=true;const refresh=()=>{if(active)void load()};void Promise.resolve().then(refresh);const timer=setInterval(refresh,10000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);return()=>{active=false;invalidateRequests();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh)}},[load,invalidateRequests])
  const resolveChannel=useCallback((value:SupportChannel)=>{setResolvedChannel(value);setChannel(value);setOffset(0)},[])
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2" aria-label="客服收件箱分类">{(['platform','store'] as const).map(value=><Button key={value} variant={channel===value?'default':'outline'} className="h-11" aria-pressed={channel===value} onClick={()=>{setChannel(value);setOffset(0);setId('');setResolvedChannel(null);setError('')}}>{SUPPORT_CHANNEL_LABELS[value]}</Button>)}</div>
    {error?<p role="alert" className="text-destructive">{error}</p>:null}
    {inbox&&!id?<p className="text-sm text-muted-foreground">{SUPPORT_CHANNEL_LABELS[channel]}运营提醒：{inbox.notificationHealth.configured?'已配置':'未配置，请联系维护者'} · 待发送 {inbox.notificationHealth.pending}；会话回复始终保存在站内。</p>:null}
    {id?<><div className="flex flex-wrap items-center gap-3"><Button variant="outline" className="h-11" onClick={()=>{setId('');setResolvedChannel(null);void load()}}>返回{resolvedChannel?SUPPORT_CHANNEL_LABELS[resolvedChannel]:'客服'}收件箱</Button>{resolvedChannel?<p className="font-semibold">{SUPPORT_CHANNEL_LABELS[resolvedChannel]}会话</p>:null}</div><SupportChat key={id} conversationId={id} admin onChannelResolved={resolveChannel}/></>:<Surface className="divide-y p-3">
      {!inbox?<p role="status" className="p-4">正在加载收件箱…</p>:inbox.conversations.length===0?<p className="p-4 text-muted-foreground">暂时没有{SUPPORT_CHANNEL_LABELS[channel]}咨询。</p>:null}
      {inbox?.conversations.map(conversation=><button key={conversation.id} type="button" className="flex min-h-20 w-full items-center justify-between gap-4 p-3 text-left hover:bg-muted" onClick={()=>{setId(conversation.id);setResolvedChannel(conversation.channel)}}><span className="min-w-0"><span className="block truncate font-semibold">{SUPPORT_CHANNEL_LABELS[conversation.channel]} · {conversation.id.slice(0,8)}</span><span className="text-xs text-muted-foreground">{new Date(conversation.updated_at).toLocaleString('zh-CN')}</span></span><span className="text-sm">{conversation.status==='open'?'待处理':'已处理'}{conversation.unreadCount>0?` · ${conversation.unreadCount} 条未读`:''}</span></button>)}
      <div className="flex justify-between pt-3"><Button variant="ghost" className="h-11" disabled={offset===0} onClick={()=>setOffset(old=>Math.max(0,old-50))}>上一页</Button><Button variant="ghost" className="h-11" disabled={inbox?.nextOffset==null} onClick={()=>setOffset(inbox?.nextOffset??0)}>下一页</Button></div>
    </Surface>}
  </div>
}
