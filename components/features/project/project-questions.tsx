'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { useToast } from '@/hooks/use-toast'
import { ReportDialog } from '@/components/ui/report-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { uploadCommentImage } from '@/lib/comment-image'
import { emptyQuestionDraft, loadQuestionDraft, saveQuestionDraft, type QuestionContext, type QuestionDraft } from '@/lib/project/question-draft'
import { GrowthQualityBadge, useExchangeFeedback } from '@/components/features/growth/exchange-feedback'

type Question = { id:number; author_id:string; content:string; parent_id:number|null; question_root_id:number; reply_to_username:string|null; image_url:string|null; moderation_state:string; question_context:QuestionContext; profiles:{display_name:string}|null; is_project_question:boolean; created_at:string }
export function ProjectQuestionsTabs({ projectId, children }: { projectId:string|number; children:ReactNode }) {
  const [active,setActive]=useState(false); const [context,setContext]=useState<QuestionContext|null>(null); const root=useRef<HTMLDivElement>(null)
  useEffect(() => {
    const ask=(event:Event) => { const detail=(event as CustomEvent).detail; if(detail?.projectId!==String(projectId)||!root.current?.getClientRects().length) return; setContext(detail.context);setActive(true);root.current.scrollIntoView({behavior:'smooth',block:'start'}) }
    window.addEventListener('project-question',ask);return()=>window.removeEventListener('project-question',ask)
  },[projectId])
  return <div ref={root} className="scroll-mt-28">
    <Tabs value={active?'discussion':'works'} onValueChange={value=>setActive(value==='discussion')}>
      <TabsList aria-label="项目交流" className="mb-4 h-auto w-full justify-start gap-6 rounded-none border-b border-border/70 bg-transparent p-0">
        <TabsTrigger value="works" className="relative min-h-11 rounded-none bg-transparent px-1 pb-3 pt-2 text-sm shadow-none after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:bg-primary">作品</TabsTrigger>
        <TabsTrigger value="discussion" className="relative min-h-11 rounded-none bg-transparent px-1 pb-3 pt-2 text-sm shadow-none after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:bg-primary">讨论</TabsTrigger>
      </TabsList>
      <TabsContent value="works" forceMount hidden={active}>{children}</TabsContent>
      <TabsContent value="discussion">{active && <ProjectQuestions projectId={projectId} context={context} onContextApplied={setContext} enabled={active}/>}</TabsContent>
    </Tabs>
  </div>
}
function ProjectQuestions({projectId,context,onContextApplied,enabled}:{projectId:string|number;context:QuestionContext|null;onContextApplied:(context:null)=>void;enabled:boolean}) {
 const {user}=useAuth();const {promptLogin}=useLoginPrompt();const {toast}=useToast();const cache=useQueryClient()
 const [draft,setDraft]=useState<QuestionDraft>(emptyQuestionDraft);const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [submitted,setSubmitted]=useState<{id:number;at:number}|null>(null);const [before,setBefore]=useState<number|null>(null)
 const currentDraft=useRef(draft);const owner=useRef<string|null>(user?.id||null);const input=useRef<HTMLTextAreaElement>(null);const photoInput=useRef<HTMLInputElement>(null)
 useEffect(()=>{owner.current=user?.id||null;const restored=loadQuestionDraft(user?.id||null,projectId);currentDraft.current=restored;setDraft(restored);setFile(null);if(photoInput.current)photoInput.current.value='';setSubmitted(null)},[user?.id,projectId])
 // Consume explicit shortcuts once; a tab remount must keep the stored reply/context.
 useEffect(()=>{if(!context)return;const next={...currentDraft.current,context,replyId:null,replyName:null};currentDraft.current=next;setDraft(next);saveQuestionDraft(user?.id||null,projectId,next);onContextApplied(null)},[context,user?.id,projectId,onContextApplied])
 const change=(next:QuestionDraft)=>{currentDraft.current=next;setDraft(next);saveQuestionDraft(user?.id||null,projectId,next)}
 const {data,isLoading,error,refetch}=useQuery<{questions:Question[];nextBefore:number|null;repliesTruncated?:boolean}>({queryKey:['project-questions',projectId,user?.id,before],enabled,queryFn:async()=>{const r=await fetch(`/api/projects/${projectId}/questions?includeLegacy=1${before?`&before=${before}`:''}`);if(!r.ok)throw new Error('问题暂时无法加载');return r.json()},refetchInterval:()=>submitted&&Date.now()-submitted.at<60_000?5000:false})
 const questions=data?.questions||[];const feedback=useExchangeFeedback('project_comment',questions.filter(q=>q.is_project_question===true).map(q=>q.id).concat(submitted?[submitted.id]:[]),submitted)
 async function send(snapshot:QuestionDraft, photo:File|null, account:string) {
   if(owner.current!==account)return
   setBusy(true)
   try {
     const image_url=photo?await uploadCommentImage(photo,account):null
     if(owner.current!==account)return
     const response=await fetch(`/api/projects/${projectId}/questions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:snapshot.text,parent_id:snapshot.replyId,context:snapshot.context,image_url})})
     const body=await response.json();if(!response.ok)throw new Error(body.error||'发送失败')
     if(owner.current!==account)return
     currentDraft.current=emptyQuestionDraft();setDraft(currentDraft.current);saveQuestionDraft(account,projectId,emptyQuestionDraft());setFile(null);if(photoInput.current)photoInput.current.value='';setBefore(null);setSubmitted({id:body.question.id,at:Date.now()});cache.invalidateQueries({queryKey:['project-questions',projectId]});toast({title:'已提交，审核后公开'})
   }catch(err){toast({title:err instanceof Error?err.message:'发送失败',variant:'destructive'})}finally{setBusy(false)}
 }
 const submit=()=>{if(!draft.text.trim()||busy)return;const snapshot={...draft,text:draft.text.trim()};if(!user){promptLogin(nextUser=>{if(owner.current&&owner.current!==nextUser.id)return;owner.current=nextUser.id;return send(snapshot,file,nextUser.id)},{title:'登录后参与讨论',description:'保留当前输入'});return}void send(snapshot,file,user.id)}
 const reply=(q:Question)=>{change({...draft,replyId:q.id,replyName:q.profiles?.display_name||'探索者'});input.current?.focus()}
 return <section className="space-y-4" aria-label="讨论">
 <div className="overflow-hidden rounded-sm border border-border/80 bg-muted/30 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
 {(draft.replyId||draft.context.area!=='general')&&<p className="flex items-center gap-2 px-3 pt-1 text-xs text-muted-foreground"><span>{draft.replyId?`回复 @${draft.replyName}`:draft.context.area==='materials'?'关于项目材料':draft.context.area==='step'?`关于第${draft.context.step}步：${draft.context.title||''}`:''}</span><Button variant="ghost" size="sm" className="min-h-11 text-xs" onClick={()=>change({...draft,replyId:null,replyName:null,context:{area:'general'}})}>取消上下文</Button></p>}
 <Textarea className="min-h-24 resize-y rounded-none border-0 bg-transparent px-3.5 pb-2 pt-3.5 text-sm leading-6 shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0" ref={input} aria-label="问题或回复" value={draft.text} maxLength={2000} rows={2} onChange={e=>change({...draft,text:e.target.value})} placeholder="说说你的问题或发现…"/>
 <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
 <input ref={photoInput} type="file" aria-label="添加图片" className="sr-only" tabIndex={-1} accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/>
 <Button variant="ghost" size="sm" className="min-h-11 gap-1.5 px-2 text-xs text-muted-foreground hover:bg-background" disabled={busy} onClick={()=>photoInput.current?.click()}><ImagePlus className="size-4" aria-hidden="true"/>添加图片</Button>
 {file&&<span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"><span className="max-w-40 truncate">{file.name}</span><Button variant="ghost" size="icon" className="size-11" aria-label="移除图片" disabled={busy} onClick={()=>{setFile(null);if(photoInput.current)photoInput.current.value=''}}><X className="size-4" aria-hidden="true"/></Button></span>}
 <Button className="ml-auto min-h-11 rounded-sm px-5 text-sm shadow-none disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100" disabled={busy||!draft.text.trim()} onClick={submit}>{busy?'提交中…':'发布'}</Button>
 </div></div>
 {isLoading?<p className="text-sm text-muted-foreground">正在加载…</p>:null}
 {error&&<div role="alert" className="flex items-center gap-2 text-sm text-muted-foreground"><span>讨论暂时无法加载。</span><Button variant="ghost" className="min-h-11" onClick={()=>void refetch()}>重试</Button></div>}
 {!isLoading&&!error&&questions.length===0&&<p className="pb-1 pt-1 text-center text-xs text-muted-foreground">还没有讨论</p>}
 <div className="divide-y divide-border empty:hidden">{questions.filter(q=>!q.parent_id).map(q=><QuestionThread key={q.id} question={q} replies={questions.filter(r=>r.parent_id&&r.question_root_id===q.id)} feedback={feedback} onReply={reply}/>)}</div>
 {data?.repliesTruncated&&<p className="text-xs text-muted-foreground">回复较多，此页暂时只显示部分回复。</p>}
 {data?.nextBefore&&<Button variant="outline" className="min-h-11" onClick={()=>setBefore(data.nextBefore)}>更早的讨论</Button>}{before&&<Button variant="ghost" className="min-h-11" onClick={()=>setBefore(null)}>最新讨论</Button>}
 </section>
}
function QuestionThread({question:q,replies,feedback,onReply}:{question:Question;replies:Question[];feedback:Map<number,{qualified:boolean}>;onReply:(q:Question)=>void}) {
 const [expanded,setExpanded]=useState(false)
 const render=(item:Question)=><div key={item.id} className="space-y-1">
 <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{item.profiles?.display_name||'探索者'}</span>{item.reply_to_username&&<span>回复 @{item.reply_to_username}</span>}{item.created_at&&<time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('zh-CN',{month:'numeric',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}</time>}{item.is_project_question===true&&<GrowthQualityBadge qualified={feedback.get(item.id)?.qualified}/>}<span>{item.moderation_state==='pending'?'审核中':item.moderation_state==='rejected'?'未通过发布安全审核':''}</span></div>
 <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.content}</p>
 <div className="flex flex-wrap items-center gap-2">{item.image_url&&<a href={item.image_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-xs text-primary underline">查看附图</a>}{item.is_project_question===true&&<Button variant="ghost" size="sm" className="min-h-11 px-2 text-xs text-primary" onClick={()=>onReply(item)} disabled={item.moderation_state!=='approved'}>回复</Button>}<ReportDialog contentType="comment" contentId={item.id}><Button variant="ghost" size="sm" className="min-h-11 px-2 text-xs text-muted-foreground">举报</Button></ReportDialog></div>
 </div>
 return <article className="space-y-3 py-4">{q.question_context?.area==='materials'&&<p className="text-xs text-muted-foreground">材料问题</p>}{q.question_context?.area==='step'&&<p className="text-xs text-muted-foreground">第{q.question_context.step}步</p>}{render(q)}{replies.length>0&&<div className="ml-3 space-y-3 border-l border-border pl-3">{(expanded?replies:replies.slice(0,2)).map(render)}{replies.length>2&&<Button variant="ghost" size="sm" className="min-h-11 text-xs text-primary" onClick={()=>setExpanded(!expanded)}>{expanded?'收起回复':`展开其余 ${replies.length-2} 条回复`}</Button>}</div>}</article>
}
