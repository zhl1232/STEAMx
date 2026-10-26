'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

type Item = {
  id: number; type: 'completion' | 'comment'; hash: string
  evidence: { notes?: string; content?: string; user_id?: string; author_id?: string; project_id?: number; course_lesson_id?: string; completed_project_id?: number; proof_images?: string[]; proof_captions?: string[]; proof_video_url?: string }
  context?: { work?: { notes?: string }; parent?: { content?: string } }
  reviews: { stage: string; xp: number; reason: string; revoked_at?: string }[]
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
      toast({ title: `审核已记录，本次 XP 变动 ${data.result?.xp_awarded ?? 0}`, description: '重复阶段、历史奖励及日周额度可能使本次奖励为 0。' })
      refresh()
    } catch (error) { toast({ title: error instanceof Error ? error.message : '审核失败', variant: 'destructive' }) }
    finally { setBusy(false) }
  }
  return <article className="space-y-3 rounded-lg border p-4">
    <p className="font-semibold">{item.type === 'comment' ? '作品交流' : '作品 / 探索记录'} #{item.id}</p>
    <p className="text-sm text-muted-foreground">作者：{item.evidence.user_id || item.evidence.author_id}；来源：{item.evidence.course_lesson_id ? `课时 ${item.evidence.course_lesson_id}` : `项目 ${item.evidence.project_id ?? '见作品'}`}</p>
    <a className="text-primary underline" href={`/works/${item.type === 'completion' ? item.id : item.evidence.completed_project_id}`} target="_blank" rel="noreferrer">查看作品和完整交流上下文</a>
    <p className="whitespace-pre-wrap">{item.evidence.notes || item.evidence.content}</p>
    {item.context?.work?.notes && <p>作品背景：{item.context.work.notes}</p>}
    {item.context?.parent?.content && <p>回复对象原文：{item.context.parent.content}</p>}
    <div className="flex flex-wrap gap-3">{item.evidence.proof_images?.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="text-primary underline">查看凭证 {index + 1}：{item.evidence.proof_captions?.[index]}</a>)}</div>
    {item.evidence.proof_video_url && <a href={item.evidence.proof_video_url} target="_blank" rel="noreferrer" className="text-primary underline">查看视频凭证</a>}
    {item.reviews.map((review, index) => <p key={index} className="text-sm text-muted-foreground">{labels[review.stage]}：{review.xp} XP{review.revoked_at ? '（已撤回）' : ''}；依据：{review.reason}</p>)}
    <fieldset className="space-y-2"><legend>逐项确认真实对应的内容，不按文件数量或字数评分</legend>
      {(item.type === 'comment' ? ['exchange', 'skip'] : ['process', 'discovery', 'final', 'skip']).map(stage => <label key={stage} className="flex gap-2"><input type="checkbox" checked={stages.includes(stage)} onChange={event => setStages(event.target.checked ? stage === 'skip' ? ['skip'] : [...stages.filter(s => s !== 'skip'), stage] : stages.filter(s => s !== stage))} />{labels[stage]}</label>)}
    </fieldset>
    <Textarea aria-label={`审核依据 ${item.id}`} value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} placeholder="逐阶段说明真实证据；交流需确认具体问题、尝试或建议，并排除重复、广告和自动账号。" />
    <Button disabled={busy || !stages.length || !reason.trim()} onClick={() => void save()}>保存价值审核</Button>
  </article>
}
export function GrowthReviews() {
  const [type, setType] = useState<'completion' | 'comment'>('completion')
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
    <h2 className="text-xl font-semibold">成长奖励人工审核</h2>
    <p className="text-sm text-muted-foreground">安全审核不代表价值审核。仅处理新规则生效后的已通过内容。一份记录可确认多阶段，无需三次提交；首次阶段按项目 / 课时终身去重。交流每天一次、每周四次、同作品每周一次，均按上海时间；编辑、删除或违规会撤回新奖励，不释放额度。不得审核自己的奖励。</p>
    <div className="flex gap-3"><select aria-label="成长审核类型" value={type} onChange={event => { setType(event.target.value as typeof type); setItems([]) }}><option value="completion">作品与记录</option><option value="comment">作品评论与回复</option></select><Button disabled={busy} onClick={() => void load()}>加载 / 刷新</Button></div>
    {error && <p role="alert">{error}</p>}
    {items.map(item => <ReviewItem key={`${item.type}-${item.id}-${item.hash}`} item={item} refresh={() => void load()} />)}
    {items.length === 30 && <Button disabled={busy} onClick={() => void load(items[items.length - 1].id)}>下一页</Button>}
  </section>
}
