'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

type Item = {
  id: number; type: 'completion' | 'comment' | 'project_comment'; hash: string
  evidence: { notes?: string; content?: string; user_id?: string; author_id?: string; project_id?: number; course_lesson_id?: string; completed_project_id?: number; proof_images?: string[]; proof_captions?: string[]; proof_video_url?: string }
  context?: { work?: { notes?: string }; parent?: { content?: string } }
  reviews: { stage: string; xp: number; reason: string; revoked_at?: string; revision?: number; events?: { type: string; xp: number; reason: string; created_at: string }[] }[]
}
const labels: Record<string, string> = {
  process: '首次真实过程 · 40 XP', discovery: '首次实质新观察 / 比较 / 调整 · 60 XP',
  final: '最终作品或总结（含失败总结）· 100 XP', exchange: '合格交流 · 5 XP', skip: '无符合条件的内容 · 不奖励 / 撤回本条已有奖励',
}
function ReviewItem({ item, refresh }: { item: Item; refresh: () => void }) {
  const [stages, setStages] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  async function save() {
    setBusy(true)
    try {
      const response = await fetch('/api/admin/growth-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: item.type, id: item.id, hash: item.hash, stages, reason }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '审核失败，请刷新后重试')
      toast({ title: `审核已记录，本次 XP 变动 ${data.result?.xp_awarded ?? 0}`, description: '重复阶段、历史奖励及每日额度可能使本次奖励为 0。' })
      refresh()
    } catch (error) { toast({ title: error instanceof Error ? error.message : '审核失败', variant: 'destructive' }) }
    finally { setBusy(false) }
  }
  return <article className="space-y-3 rounded-lg border p-4">
    <p className="font-semibold">{item.type === 'project_comment' ? '项目问答' : item.type === 'comment' ? '作品交流' : '作品 / 探索记录'} #{item.id}</p>
    <p className="text-sm text-muted-foreground">作者：{item.evidence.user_id || item.evidence.author_id}；来源：{item.evidence.course_lesson_id ? `课时 ${item.evidence.course_lesson_id}` : `项目 ${item.evidence.project_id ?? '见作品'}`}</p>
    <a className="text-primary underline" href={item.type==='project_comment'?`/project/${item.evidence.project_id}`:`/works/${item.type === 'completion' ? item.id : item.evidence.completed_project_id}`} target="_blank" rel="noreferrer">查看作品和完整交流上下文</a>
    <p className="whitespace-pre-wrap">{item.evidence.notes || item.evidence.content}</p>
    {item.context?.work?.notes && <p>作品背景：{item.context.work.notes}</p>}
    {item.context?.parent?.content && <p>回复对象原文：{item.context.parent.content}</p>}
    <div className="flex flex-wrap gap-3">{item.evidence.proof_images?.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="text-primary underline">查看凭证 {index + 1}：{item.evidence.proof_captions?.[index]}</a>)}</div>
    {item.evidence.proof_video_url && <a href={item.evidence.proof_video_url} target="_blank" rel="noreferrer" className="text-primary underline">查看视频凭证</a>}
    {item.reviews.map((review, index) => <div key={index} className="text-sm text-muted-foreground"><p>{labels[review.stage]}：{review.xp} XP{review.revoked_at ? '（已撤回，可重新确认恢复）' : ''}；首次依据：{review.reason}</p><details><summary>审核与恢复历史</summary>{review.events?.map((event, eventIndex) => <p key={eventIndex}>{event.type === 'restore' ? '恢复' : event.type === 'revoke' ? '撤回' : '首次确认'}：{event.xp} XP；{event.reason}；{new Date(event.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>)}</details></div>)}
    <fieldset className="space-y-2"><legend>逐项确认真实对应的内容，不按文件数量或字数评分</legend>
      {(item.type !== 'completion' ? ['exchange', 'skip'] : ['process', 'discovery', 'final', 'skip']).map(stage => <label key={stage} className="flex gap-2"><input type="checkbox" checked={stages.includes(stage)} onChange={event => setStages(event.target.checked ? stage === 'skip' ? ['skip'] : [...stages.filter(s => s !== 'skip'), stage] : stages.filter(s => s !== stage))} />{labels[stage]}</label>)}
    </fieldset>
    <Textarea aria-label={`审核依据 ${item.id}`} value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} placeholder="逐阶段说明真实证据；交流需确认具体问题、尝试或建议，并排除重复、广告和自动账号。" />
    <Button disabled={busy || !stages.length || !reason.trim()} onClick={() => void save()}>保存价值审核</Button>
  </article>
}
export function GrowthReviews() {
  const [type, setType] = useState<'completion' | 'comment' | 'project_comment'>('completion')
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function load(before?: number) {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/admin/growth-reviews?type=${type}${before ? `&before=${before}` : ''}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '加载失败')
      setItems(data.items)
    } catch (err) { setError(err instanceof Error ? err.message : '加载失败') }
    finally { setBusy(false) }
  }
  return <section className="space-y-4 rounded-lg border p-4">
    <h2 className="text-xl font-semibold">成长奖励复核</h2>
    <p className="text-sm text-muted-foreground">AI 分别判断发布安全与奖励证据，异常或不确定时在此人工复核。安全审核不代表价值审核。仅处理新规则生效后的已通过内容。一份记录可确认多阶段，无需三次提交；首次阶段按项目 / 课时终身去重。项目问答与作品交流共享每天五次、同一线程每天一次，无周上限，均按上海时间；内容或必要依赖失效会撤回奖励；重新确认仍有效的阶段可恢复原金额，并可确认新的阶段。恢复保留原发奖日名额，不重复发奖。部分误审可先撤回本条，再仅勾选真实成立的阶段恢复。不得审核自己的奖励。</p>
    <div className="flex gap-3"><select aria-label="成长审核类型" value={type} onChange={event => { setType(event.target.value as typeof type); setItems([]) }}><option value="completion">作品与记录</option><option value="comment">作品评论与回复</option><option value="project_comment">项目问答</option></select><Button disabled={busy} onClick={() => void load()}>加载 / 刷新</Button></div>
    <GrowthManualJobs />
    {error && <p role="alert">{error}</p>}
    {items.map(item => <ReviewItem key={`${item.type}-${item.id}-${item.hash}`} item={item} refresh={() => void load()} />)}
    {items.length === 30 && <Button disabled={busy} onClick={() => void load(items[items.length - 1].id)}>下一页</Button>}
  </section>
}

function GrowthManualJobs() {
 const [jobs,setJobs]=useState<{id:string;content_type:string;content_id:number;error?:string;decision?:{quality:string;safety:string;reason:string};evidence?:{notes?:string;content?:string}}[]>([])
 const {toast}=useToast()
 async function load() {try {const r=await fetch('/api/admin/growth-reviews?queue=manual');if(!r.ok)throw new Error('复核队列加载失败');setJobs((await r.json()).jobs||[])}catch(e){toast({title:e instanceof Error?e.message:'加载失败',variant:'destructive'})}}
 async function safety(jobId:string) {try {const r=await fetch('/api/admin/growth-reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'safety_case',jobId})});if(!r.ok)throw new Error('转交失败');toast({title:'已加入安全审核队列，请在安全审核区刷新处理'})}catch(e){toast({title:e instanceof Error?e.message:'失败',variant:'destructive'})}}
 return <details><summary>AI 异常与不确定任务（人工兜底）</summary><Button variant="outline" onClick={()=>void load()}>加载待复核任务</Button>{jobs.map(j=><div key={j.id} className="my-2 rounded border p-3 text-sm"><p>{j.content_type} #{j.content_id}：{j.error||j.decision?.reason||'待复核'}</p><p className="whitespace-pre-wrap">{j.evidence?.content||j.evidence?.notes}</p><p>安全未通过时先转安全审核；已公开内容在上方对应类型加载后确认奖励阶段。</p><Button variant="outline" onClick={()=>void safety(j.id)}>转安全审核队列</Button></div>)}</details>
}
