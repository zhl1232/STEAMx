'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { useToast } from '@/hooks/use-toast'
import { ReportDialog } from '@/components/ui/report-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { uploadCommentImage } from '@/lib/comment-image'
import { emptyQuestionDraft, loadQuestionDraft, saveQuestionDraft, type QuestionContext, type QuestionDraft } from '@/lib/project/question-draft'
import { ExchangeRewardHint, GrowthQualityBadge, useExchangeFeedback } from '@/components/features/growth/exchange-feedback'

type Question = { id:number; author_id:string; content:string; parent_id:number|null; question_root_id:number; reply_to_username:string|null; image_url:string|null; moderation_state:string; question_context:QuestionContext; profiles:{display_name:string}|null }
export function AskProjectQuestion({ projectId, context }: { projectId:string|number; context:QuestionContext }) {
  return <button type="button" className="mt-2 text-xs text-primary underline underline-offset-4" onClick={() => window.dispatchEvent(new CustomEvent('project-question',{detail:{projectId:String(projectId),context}}))}>{context.area==='materials'?'材料有疑问？':'这一步有疑问？'}</button>
}
export function ProjectQuestionsTabs({ projectId, children }: { projectId:string|number; children:ReactNode }) {
  const [active,setActive]=useState(false); const [context,setContext]=useState<QuestionContext|null>(null); const root=useRef<HTMLDivElement>(null)
  useEffect(() => {
    const ask=(event:Event) => { const detail=(event as CustomEvent).detail; if(detail?.projectId!==String(projectId)||!root.current?.getClientRects().length) return; setContext(detail.context);setActive(true);root.current.scrollIntoView({behavior:'smooth',block:'start'}) }
    window.addEventListener('project-question',ask);return()=>window.removeEventListener('project-question',ask)
  },[projectId])
  return <div ref={root} className="scroll-mt-28"><div className="mb-4 flex gap-2" role="tablist" aria-label="项目交流"><button type="button" role="tab" aria-selected={!active} className="rounded px-3 py-2 text-sm" onClick={()=>setActive(false)}>大家的作品</button><button type="button" role="tab" aria-selected={active} className="rounded px-3 py-2 text-sm" onClick={()=>setActive(true)}>问题与解答</button></div><div hidden={active}>{children}</div><div hidden={!active}>{active && <ProjectQuestions projectId={projectId} context={context} onContextApplied={setContext} enabled={active}/>}</div></div>
}
function ProjectQuestions({projectId,context,onContextApplied,enabled}:{projectId:string|number;context:QuestionContext|null;onContextApplied:(context:null)=>void;enabled:boolean}) {
 const {user}=useAuth();const {promptLogin}=useLoginPrompt();const {toast}=useToast();const cache=useQueryClient()
 const [draft,setDraft]=useState<QuestionDraft>(emptyQuestionDraft);const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [submitted,setSubmitted]=useState<{id:number;at:number}|null>(null);const [before,setBefore]=useState<number|null>(null)
 const currentDraft=useRef(draft);const owner=useRef<string|null>(user?.id||null);const input=useRef<HTMLTextAreaElement>(null)
 useEffect(()=>{owner.current=user?.id||null;const restored=loadQuestionDraft(user?.id||null,projectId);currentDraft.current=restored;setDraft(restored);setFile(null);setSubmitted(null)},[user?.id,projectId])
 // Consume explicit shortcuts once; a tab remount must keep the stored reply/context.
 useEffect(()=>{if(!context)return;const next={...currentDraft.current,context,replyId:null,replyName:null};currentDraft.current=next;setDraft(next);saveQuestionDraft(user?.id||null,projectId,next);onContextApplied(null)},[context,user?.id,projectId,onContextApplied])
 const change=(next:QuestionDraft)=>{currentDraft.current=next;setDraft(next);saveQuestionDraft(user?.id||null,projectId,next)}
 const {data,isLoading,error}=useQuery<{questions:Question[];nextBefore:number|null;repliesTruncated?:boolean}>({queryKey:['project-questions',projectId,user?.id,before],enabled,queryFn:async()=>{const r=await fetch(`/api/projects/${projectId}/questions${before?`?before=${before}`:''}`);if(!r.ok)throw new Error('问题暂时无法加载');return r.json()},refetchInterval:()=>submitted&&Date.now()-submitted.at<60_000?5000:false})
 const questions=data?.questions||[];const feedback=useExchangeFeedback('project_comment',questions.map(q=>q.id).concat(submitted?[submitted.id]:[]),submitted)
 async function send(snapshot:QuestionDraft, photo:File|null, account:string) {
   if(owner.current!==account)return
   setBusy(true)
   try {
     const image_url=photo?await uploadCommentImage(photo,account):null
     if(owner.current!==account)return
     const response=await fetch(`/api/projects/${projectId}/questions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:snapshot.text,parent_id:snapshot.replyId,context:snapshot.context,image_url})})
     const body=await response.json();if(!response.ok)throw new Error(body.error||'发送失败')
     if(owner.current!==account)return
     currentDraft.current=emptyQuestionDraft();setDraft(currentDraft.current);saveQuestionDraft(account,projectId,emptyQuestionDraft());setFile(null);setBefore(null);setSubmitted({id:body.question.id,at:Date.now()});cache.invalidateQueries({queryKey:['project-questions',projectId]});toast({title:'已提交，审核后公开'})
   }catch(err){toast({title:err instanceof Error?err.message:'发送失败',variant:'destructive'})}finally{setBusy(false)}
 }
 const submit=()=>{if(!draft.text.trim()||busy)return;const snapshot={...draft,text:draft.text.trim()};if(!user){promptLogin(nextUser=>{if(owner.current&&owner.current!==nextUser.id)return;owner.current=nextUser.id;return send(snapshot,file,nextUser.id)},{title:'登录后提问或回复',description:'保留当前输入与问题上下文'});return}void send(snapshot,file,user.id)}
 const reply=(q:Question)=>{change({...draft,replyId:q.id,replyName:q.profiles?.display_name||'探索者'});input.current?.focus()}
 return <section className="space-y-4" aria-label="问题与解答"><p className="text-xs text-muted-foreground">无需先有作品，可以直接问材料、步骤或分享尝试。作品下的聊天保留在各自作品中。</p>
 {isLoading?<p>正在加载…</p>:error?<p role="alert">问题暂时无法加载，请重试。</p>:questions.filter(q=>!q.parent_id).map(q=><QuestionThread key={q.id} question={q} replies={questions.filter(r=>r.parent_id&&r.question_root_id===q.id)} feedback={feedback} onReply={reply}/>)}
 {data?.repliesTruncated&&<p className="text-xs text-muted-foreground">回复较多，此页暂时只显示部分回复。</p>}
 {data?.nextBefore&&<Button variant="outline" onClick={()=>setBefore(data.nextBefore)}>更早的问题</Button>}{before&&<Button variant="ghost" onClick={()=>setBefore(null)}>最新问题</Button>}
 <div className="space-y-2 border-t pt-3"><p className="text-xs text-muted-foreground">{draft.replyId?`回复 @${draft.replyName}`:draft.context.area==='materials'?'关于项目材料':draft.context.area==='step'?`关于第${draft.context.step}步：${draft.context.title||''}`:'提问或分享尝试'}{(draft.replyId||draft.context.area!=='general')&&<button className="ml-2 underline" onClick={()=>change({...draft,replyId:null,replyName:null,context:{area:'general'}})}>取消上下文</button>}</p>
 <Textarea ref={input} aria-label="问题或回复" value={draft.text} maxLength={2000} rows={3} onChange={e=>change({...draft,text:e.target.value})} placeholder="可以直接说说卡在哪里，或你试过什么…"/>
 <ExchangeRewardHint/><label className="block text-xs text-muted-foreground">照片（可选，不保存到草稿）<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
 <Button disabled={busy||!draft.text.trim()} onClick={submit}>{busy?'提交中…':draft.replyId?'发表回复':'发布问题'}</Button></div>
 <details className="text-xs text-muted-foreground"><summary>历史项目留言</summary><p>旧留言保留原有身份，不计为新问题，也不迁移作品聊天。</p><LegacyQuestions projectId={projectId}/></details>
 </section>
}
function QuestionThread({question:q,replies,feedback,onReply}:{question:Question;replies:Question[];feedback:Map<number,{qualified:boolean}>;onReply:(q:Question)=>void}) {
 const [expanded,setExpanded]=useState(false)
 const render=(item:Question)=><div key={item.id} className="space-y-1"><p className="text-xs text-muted-foreground">{item.profiles?.display_name||'探索者'}{item.reply_to_username?` 回复 @${item.reply_to_username}`:''}<GrowthQualityBadge qualified={feedback.get(item.id)?.qualified}/>{item.moderation_state==='pending'?' · 审核中':item.moderation_state==='rejected'?' · 未通过发布安全审核':''}</p><p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>{item.image_url&&<a href={item.image_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">查看附图</a>}<button className="text-xs text-primary" onClick={()=>onReply(item)} disabled={item.moderation_state!=='approved'}>回复</button><ReportDialog contentType="comment" contentId={item.id}><button className="ml-3 text-xs text-muted-foreground">举报</button></ReportDialog></div>
 return <article className="space-y-3 rounded border p-3">{q.question_context?.area==='materials'&&<p className="text-xs text-muted-foreground">材料问题</p>}{q.question_context?.area==='step'&&<p className="text-xs text-muted-foreground">第{q.question_context.step}步</p>}{render(q)}{replies.length>0&&<div className="ml-3 space-y-3 border-l pl-3">{(expanded?replies:replies.slice(0,2)).map(render)}{replies.length>2&&<button className="text-xs text-primary" onClick={()=>setExpanded(!expanded)}>{expanded?'收起回复':`展开其余 ${replies.length-2} 条回复`}</button>}</div>}</article>
}
function LegacyQuestions({projectId}:{projectId:string|number}) {
 const [text,setText]=useState<string[]>([])
 return <div><button className="underline" onClick={async()=>{const r=await fetch(`/api/projects/${projectId}/comments?pageSize=20`);if(r.ok){const body=await r.json();setText((body.comments||[]).map((c:{content:string})=>c.content))}}}>查看历史留言</button>{text.map((t,i)=><p key={i} className="my-2 whitespace-pre-wrap">{t}</p>)}</div>
}
