'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { Textarea } from '@/components/ui/textarea'
import { SUPPORT_CHANNEL_LABELS } from '@/lib/support/channels'
import type { SupportChannel } from '@/lib/support/channels'
import type { SupportConversation,SupportMessage } from '@/lib/support/types'

type Snapshot={conversation:SupportConversation; messages:SupportMessage[]; nextCursor:number|null;nextAfterCursor?:number|null}
async function api(url:string,init?:RequestInit) {
  const response=await fetch(url,{cache:'no-store',...init})
  const data=await response.json().catch(()=>null)
  if(!response.ok) throw Object.assign(new Error(data?.error || (response.status===413?'图片超过上传服务的大小限制，请压缩后重试':'暂时无法连接客服，请重试')), {status:response.status})
  if(!data) throw new Error('服务返回异常，请重试')
  return data
}
export function SupportChat({conversationId,admin=false,productId,orderId,onChannelResolved}:{conversationId:string;admin?:boolean;productId?:string;orderId?:string;onChannelResolved?:(channel:SupportChannel)=>void}) {
  const prefix=`/api/${admin?'admin/support':'support'}/conversations/${conversationId}`
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null)
  const [content,setContent]=useState('')
  const [attachments,setAttachments]=useState<{id:string}[]>([])
  const [busy,setBusy]=useState(false)
  const [uploading,setUploading]=useState(false)
  const [uploadError,setUploadError]=useState('')
  const [error,setError]=useState('')
  const [retrying,setRetrying]=useState(false)
  const [loadingOlder,setLoadingOlder]=useState(false)
  const fileInput=useRef<HTMLInputElement>(null)
  const pending=useRef<Record<string,unknown>|null>(null)
  const refreshing=useRef(false)
  const mounted=useRef(false)
  const channelCallback=useRef(onChannelResolved)
  useEffect(()=>{channelCallback.current=onChannelResolved},[onChannelResolved])
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  const current=useRef<Snapshot|null>(null)
  const load=useCallback(async()=>{
    if(document.visibilityState==='hidden' || refreshing.current) return
    refreshing.current=true
    try {
      let data=await api(`${prefix}/messages`) as Snapshot
      if(!mounted.current)return
      const prior=current.current
      const start=prior?.messages.at(-1)?.seq ?? (admin?data.conversation.staff_read_seq:data.conversation.user_read_seq)
      const target=data.messages.at(-1)?.seq ?? start
      const caughtUp:SupportMessage[]=[]
      let after=start
      // Recover every page after the last displayed message before advancing the read marker.
      while(after<target) {
        const page=await api(`${prefix}/messages?after=${after}`) as Snapshot
        if(!mounted.current)return
        caughtUp.push(...page.messages)
        data={...data,conversation:page.conversation}
        const tail=page.messages.at(-1)?.seq
        if(!tail || tail<=after) throw new Error('消息尚未同步完整，请重试')
        after=tail
        if(!page.nextAfterCursor) break
      }
      if(after<target) throw new Error('消息尚未同步完整，请重试')
      const previous=current.current
      const messages=[...new Map([...(previous?.messages??[]),...data.messages,...caughtUp].map(m=>[m.seq,m])).values()].sort((a,b)=>a.seq-b.seq)
      const nextCursor=previous?previous.nextCursor:start===0?null:data.nextCursor===null?null:Math.min(data.nextCursor,messages[0]?.seq??data.nextCursor)
      const next={...data,messages,nextCursor}
      if(!mounted.current)return
      current.current=next
      setSnapshot(next)
      channelCallback.current?.(next.conversation.channel)
      if(messages.length && document.visibilityState==='visible') {
        await api(`${prefix}/read`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seq:messages.at(-1)!.seq})})
        window.dispatchEvent(new Event('support:updated'))
      }
      setError('')
    } catch(e) {if(mounted.current)setError(e instanceof Error?e.message:'加载失败，请重试')}
    finally {refreshing.current=false}
  },[prefix,admin])
  useEffect(()=>{
    void Promise.resolve().then(load)
    const timer=window.setInterval(()=>void load(),10000)
    const refresh=()=>void load()
    window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh)
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh)}
  },[load])
  async function send() {
    if(busy || uploading || (!content.trim()&&!attachments.length&&!pending.current)) return
    if(!pending.current) pending.current={clientId:crypto.randomUUID(),content,attachmentIds:attachments.map(a=>a.id),productId,orderId}
    setBusy(true);setError('')
    try {
      await api(`${prefix}/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending.current)})
      pending.current=null;setRetrying(false);setContent('');setAttachments([])
      window.dispatchEvent(new Event('support:updated'));await load()
    } catch(e){const status=(e as {status?:number}).status;const definitive=!!status&&status>=400&&status<500&&status!==408;if(definitive)pending.current=null;setRetrying(!definitive);setError(e instanceof Error?e.message:'发送失败，请重试')}
    finally {setBusy(false)}
  }
  async function upload(file:File) {
    setUploading(true);setUploadError('')
    try {
      if(file.size>5*1024*1024) throw new Error('图片不能超过 5 MB，请压缩后重新选择')
      if(!file.size) throw new Error('图片文件为空，请重新选择')
      const data=await api(`/api/support/conversations/${conversationId}/attachments`,{method:'POST',body:file})
      setAttachments(old=>[...old,data.attachment])
    } catch(err) {
      const reason=err instanceof TypeError?'网络连接失败，请检查网络后重试':err instanceof Error?err.message:'请稍后重试'
      setUploadError(`“${file.name}”上传失败：${reason}`)
    } finally {setUploading(false)}
  }
  async function older() {
    if(!snapshot?.nextCursor || loadingOlder) return
    setLoadingOlder(true)
    try {
      const data=await api(`${prefix}/messages?before=${snapshot.nextCursor}`) as Snapshot
      const old=current.current
      const next=old?({...old,nextCursor:data.nextCursor,messages:[...new Map([...data.messages,...old.messages].map(m=>[m.seq,m])).values()].sort((a,b)=>a.seq-b.seq)}):data
      current.current=next;setSnapshot(next)
    } catch(e){setError(e instanceof Error?e.message:'加载失败')}
    finally {setLoadingOlder(false)}
  }
  const channel=snapshot?.conversation.channel
  const label=channel?SUPPORT_CHANNEL_LABELS[channel]:'服务人员'
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{snapshot?.conversation.status==='resolved'?'本次问题已处理，仍可继续留言。':`留言后可在「消息中心 → 服务消息 → ${label}」查看回复。`}</p>{admin&&snapshot?<Button variant="outline" className="h-11 shrink-0" onClick={async()=>{try{await api(prefix,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:snapshot.conversation.status==='open'?'resolved':'open',expectedLastMessageSeq:snapshot.messages.at(-1)?.seq??0})});await load()}catch(e){if((e as {status?:number}).status===409)await load();setError(e instanceof Error?e.message:'操作失败')}}}>{snapshot.conversation.status==='open'?'标为已处理':'重新打开'}</Button>:null}</div>
    {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
    <Surface className="space-y-4 p-4 sm:p-6">
      {snapshot?.nextCursor?<Button variant="ghost" className="h-11" disabled={loadingOlder} onClick={()=>void older()}>查看更早消息</Button>:null}
      {!snapshot?<p role="status">正在加载会话…</p>:snapshot.messages.length===0?<p className="py-8 text-center text-muted-foreground">{channel==='store'?'商品、订单或配送遇到问题？请留下具体情况，商城客服会在此回复。':'课程使用、账号或社区遇到问题？请留下具体情况，我们会在此回复。'}</p>:null}
      <div role="log" aria-label="客服会话" className="space-y-5">
        {snapshot?.messages.map(message=><article key={message.id} className={`space-y-2 ${message.sender_role==='admin'?'border-l-2 border-primary pl-3':'pl-3'}`}>
          <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground"><span className="font-semibold text-foreground">{message.sender_role==='admin'?label:admin?'用户':'你'}</span><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString('zh-CN')}</time>{message.sender_role===(admin?'admin':'user')?<span>{message.seq<=(admin?snapshot.conversation.user_read_seq:snapshot.conversation.staff_read_seq)?'已读':'已发送'}</span>:null}</div>
          {message.context.productName?<p className="text-sm text-muted-foreground">商品：{message.context.productName}</p>:null}
          {message.context.orderId?<p className="break-all text-sm text-muted-foreground">订单：{message.context.orderId} {admin?<Link className="underline" href={`/admin/store?order=${message.context.orderId}`}>查看订单</Link>:null}</p>:null}
          <p className="whitespace-pre-wrap break-words text-sm leading-7">{message.content}</p>
          {message.attachments?.length?<div className="flex flex-wrap gap-2">{message.attachments.map(attachment=><a key={attachment.id} href={`/api/support/attachments/${attachment.id}${admin?'?staff=1':''}`} target="_blank" rel="noreferrer" className="block"><Image unoptimized width={96} height={96} src={`/api/support/attachments/${attachment.id}${admin?'?staff=1':''}`} alt="客服会话附件，点击查看原图" loading="lazy" referrerPolicy="no-referrer" className="h-24 w-24 rounded-md object-cover" /></a>)}</div>:null}
        </article>)}
      </div>
    </Surface>
    <Surface className="space-y-3 p-4">
      {productId||orderId?<p className="text-xs text-muted-foreground">将随留言附上当前{orderId?'订单':'商品'}，请勿填写完整地址或手机号。</p>:null}
      <label htmlFor={`support-draft-${conversationId}`} className="text-sm font-semibold">{admin?'回复用户':'描述问题'}</label>
      <Textarea id={`support-draft-${conversationId}`} value={content} maxLength={2000} rows={4} disabled={busy||retrying} onChange={e=>setContent(e.target.value)} placeholder={admin?'填写回复内容…':channel==='store'?'描述商品、订单或售后问题…':'描述课程使用、账号或社区问题…'} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!admin ? <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" shape="pill" className="h-11" aria-describedby={`support-images-help-${conversationId}`} aria-busy={uploading} disabled={busy||retrying||uploading||attachments.length>=3} onClick={()=>fileInput.current?.click()}>{uploading?'正在上传图片…':'添加图片'}</Button>
          <span id={`support-images-help-${conversationId}`} className="text-xs text-muted-foreground">支持 JPG、PNG、WebP，最多 3 张，每张 5 MB</span>
          <input ref={fileInput} aria-label="添加客服图片" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy||retrying||uploading||attachments.length>=3} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(file)}} />
        </div> : null}
        <Button type="button" tone="brand" shape="pill" className="h-12" disabled={busy||uploading||(!content.trim()&&!attachments.length&&!retrying)} onClick={()=>void send()}>{busy?'发送中…':retrying?'重试发送':uploading?'上传中…':'发送留言'}</Button>
      </div>
      {uploadError?<p role="alert" className="text-sm text-destructive">{uploadError}</p>:null}
      {attachments.length?<div className="flex flex-wrap gap-2">{attachments.map((attachment,index)=><Button key={attachment.id} type="button" variant="outline" className="h-11" disabled={busy||retrying} onClick={()=>setAttachments(old=>old.filter(a=>a.id!==attachment.id))}>图片 {index+1} · 移除</Button>)}</div>:null}
      {retrying?<p className="text-xs text-muted-foreground">发送结果尚未确认，请重试确认这条留言。</p>:null}
    </Surface>
  </div>
}
export { api as supportFetch }
