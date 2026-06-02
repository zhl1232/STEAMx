"use client"

import { useState, useEffect, useCallback } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/utils/http'
import { Plus, Trash2, Play, StopCircle, Archive } from 'lucide-react'
import type { ChallengeType, ChallengeStatus } from '@/lib/mappers/types'

interface AdminChallenge {
  id: number
  title: string
  description: string | null
  image_url: string | null
  challenge_type: ChallengeType
  status: ChallengeStatus
  difficulty_stars: number
  participants_count: number
  completions_count: number
  tags: string[] | null
  start_date: string | null
  end_date: string | null
  scenario: string | null
  driving_question: string | null
  expected_outcome: string | null
  constraints: string[] | null
  resources: { title: string; url: string; type: string }[] | null
  stages: { title: string; description: string; hint?: string }[] | null
  steam_weights: { S: number; T: number; E: number; A: number; M: number } | null
  created_at: string
}

const EMPTY_FORM = {
  title: '',
  description: '',
  image_url: '',
  challenge_type: 'timed' as ChallengeType,
  difficulty_stars: 3,
  tags: '',
  start_date: '',
  end_date: '',
  scenario: '',
  driving_question: '',
  expected_outcome: '',
  constraints: [''],
  resources: [{ title: '', url: '', type: 'link' }],
  stages: [{ title: '', description: '', hint: '' }] as { title: string; description: string; hint: string }[],
  steam_weights: { S: 0, T: 0, E: 0, A: 0, M: 0 },
}

const STATUS_LABELS: Record<ChallengeStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-800' },
  active: { label: '进行中', color: 'status-success-surface border text-[hsl(var(--status-success))]' },
  ended: { label: '已结束', color: 'bg-red-100 text-red-800' },
  archived: { label: '已归档', color: 'bg-yellow-100 text-yellow-800' },
}

const TYPE_LABELS: Record<ChallengeType, string> = {
  timed: '限时挑战',
  evergreen: '长期挑战',
}

const STEAM_DIMS = ['S', 'T', 'E', 'A', 'M'] as const
const STEAM_LABELS: Record<string, string> = { S: '科学', T: '技术', E: '工程', A: '艺术', M: '数学' }
const FIELD_CLASS = 'rounded-md border-border/70 bg-background/95 shadow-none'
const FILTER_TRIGGER_CLASS = 'h-11 w-[148px] rounded-full border-border/70 bg-background/95 px-4 shadow-none'
const SECTION_CLASS = 'admin-section'

export function ChallengeManagement() {
  const [challenges, setChallenges] = useState<AdminChallenge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const { toast } = useToast()

  const fetchChallenges = useCallback(async () => {
    setIsLoading(true)
    try {
      const url = typeFilter === 'all' ? '/api/admin/challenges' : `/api/admin/challenges?type=${typeFilter}`
      const res = await fetch(url)

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, '加载挑战失败'))
      }

      const data = await res.json()
      setChallenges(data.challenges || [])
    } catch (error) {
      setChallenges([])
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '加载挑战失败',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast, typeFilter])

  useEffect(() => { fetchChallenges() }, [fetchChallenges])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const openEdit = (ch: AdminChallenge) => {
    setEditingId(ch.id)
    setForm({
      title: ch.title,
      description: ch.description || '',
      image_url: ch.image_url || '',
      challenge_type: ch.challenge_type,
      difficulty_stars: ch.difficulty_stars,
      tags: ch.tags?.join(', ') || '',
      start_date: ch.start_date?.slice(0, 16) || '',
      end_date: ch.end_date?.slice(0, 16) || '',
      scenario: ch.scenario || '',
      driving_question: ch.driving_question || '',
      expected_outcome: ch.expected_outcome || '',
      constraints: ch.constraints?.length ? ch.constraints : [''],
      resources: ch.resources?.length ? ch.resources : [{ title: '', url: '', type: 'link' }],
      stages: ch.stages?.length ? ch.stages.map(s => ({ ...s, hint: s.hint || '' })) : [{ title: '', description: '', hint: '' }],
      steam_weights: ch.steam_weights || { S: 0, T: 0, E: 0, A: 0, M: 0 },
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description,
      image_url: form.image_url || null,
      challenge_type: form.challenge_type,
      difficulty_stars: form.difficulty_stars,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      scenario: form.scenario || null,
      driving_question: form.driving_question || null,
      expected_outcome: form.expected_outcome || null,
      constraints: form.constraints.filter(Boolean),
      resources: form.resources.filter(r => r.title && r.url),
      stages: form.stages.filter(s => s.title),
      steam_weights: form.steam_weights,
    }

    if (form.challenge_type === 'timed') {
      payload.start_date = form.start_date || null
      payload.end_date = form.end_date || null
    }

    const url = editingId ? `/api/admin/challenges/${editingId}` : '/api/admin/challenges'
    const method = editingId ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, '操作失败'))
      }

      toast({ title: editingId ? '挑战已更新' : '挑战已创建' })
      setDialogOpen(false)
      resetForm()
      fetchChallenges()
    } catch (error) {
      toast({
        title: '操作失败',
        description: error instanceof Error ? error.message : '操作失败',
        variant: 'destructive',
      })
    }
  }

  const handleStatusChange = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/admin/challenges/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, '操作失败'))
      }

      const data = await res.json()
      toast({ title: `状态已更新为 ${status}` })
      if (data.settlement) {
        toast({ title: '结算完成', description: `共 ${data.settlement.total_submissions} 个作品参与排名` })
      }
      fetchChallenges()
    } catch (error) {
      toast({
        title: '操作失败',
        description: error instanceof Error ? error.message : '操作失败',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除该挑战？')) return
    try {
      const res = await fetch(`/api/admin/challenges/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, '删除失败'))
      }

      toast({ title: '挑战已删除' })
      fetchChallenges()
    } catch (error) {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '删除失败',
        variant: 'destructive',
      })
    }
  }

  const updateConstraint = (i: number, val: string) => {
    const next = [...form.constraints]
    next[i] = val
    setForm(f => ({ ...f, constraints: next }))
  }

  const updateResource = (i: number, field: string, val: string) => {
    const next = [...form.resources]
    next[i] = { ...next[i], [field]: val }
    setForm(f => ({ ...f, resources: next }))
  }

  const updateStage = (i: number, field: string, val: string) => {
    const next = [...form.stages]
    next[i] = { ...next[i], [field]: val }
    setForm(f => ({ ...f, stages: next }))
  }

  const renderStatusActions = (ch: AdminChallenge) => {
    if (ch.challenge_type === 'timed') {
      if (ch.status === 'draft') return <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleStatusChange(ch.id, 'active')}><Play className="mr-1 h-3 w-3" />发布</Button>
      if (ch.status === 'active') return <Button size="sm" variant="destructive" className="rounded-full" onClick={() => { if (confirm('确认结束并结算此挑战？')) handleStatusChange(ch.id, 'ended') }}><StopCircle className="mr-1 h-3 w-3" />结束并结算</Button>
    } else {
      if (ch.status === 'draft') return <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleStatusChange(ch.id, 'active')}><Play className="mr-1 h-3 w-3" />上线</Button>
      if (ch.status === 'active') return <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleStatusChange(ch.id, 'archived')}><Archive className="mr-1 h-3 w-3" />归档</Button>
    }
    return null
  }

  return (
    <section className="surface-subtle space-y-6 rounded-xl border border-border/70 p-5 shadow-none sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="section-kicker">挑战运营</p>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">挑战管理</h2>
            <p className="mt-2 text-sm text-muted-foreground">创建、发布和维护平台挑战内容</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className={FILTER_TRIGGER_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="timed">限时挑战</SelectItem>
              <SelectItem value="evergreen">长期挑战</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
            <DialogTrigger asChild>
              <Button className="rounded-full px-5"><Plus className="mr-1 h-4 w-4" />创建挑战</Button>
            </DialogTrigger>
            <DialogContent size="lg" chrome="review" className="p-0">
              <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-6 sm:px-7">
                <DialogTitle>{editingId ? '编辑挑战' : '创建挑战'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 px-6 pb-6 pt-5 sm:px-7">
                <div className={SECTION_CLASS}>
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">挑战类型</h3>
                    <p className="text-xs text-muted-foreground">确定这是限时活动还是长期开放的学习挑战。</p>
                  </div>
                  <Select value={form.challenge_type} onValueChange={v => setForm(f => ({ ...f, challenge_type: v as ChallengeType }))} disabled={!!editingId}>
                    <SelectTrigger className={FIELD_CLASS}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="timed">限时竞赛</SelectItem>
                      <SelectItem value="evergreen">长期学习</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className={SECTION_CLASS}>
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">基础信息</h3>
                    <p className="text-xs text-muted-foreground">标题、摘要、封面和标签会直接影响挑战卡片的可读性。</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="col-span-2">
                    <Label>标题</Label>
                    <Input className={FIELD_CLASS} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <Label>描述</Label>
                    <Textarea className={FIELD_CLASS} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
                  </div>
                  <div>
                    <Label>封面图 URL</Label>
                    <Input className={FIELD_CLASS} value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
                  </div>
                  <div>
                    <Label>标签（逗号分隔）</Label>
                    <Input className={FIELD_CLASS} value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
                  </div>
                  <div>
                    <Label>难度（1-6 星）</Label>
                    <Select value={String(form.difficulty_stars)} onValueChange={v => setForm(f => ({ ...f, difficulty_stars: Number(v) }))}>
                      <SelectTrigger className={FIELD_CLASS}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n} 星</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                </div>

                {form.challenge_type === 'timed' && (
                  <div className={SECTION_CLASS}>
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium">时间安排</h3>
                      <p className="text-xs text-muted-foreground">限时挑战需要明确发布时间与结束结算时间。</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label>开始时间</Label>
                      <Input className={FIELD_CLASS} type="datetime-local" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                    </div>
                    <div>
                      <Label>截止时间</Label>
                      <Input className={FIELD_CLASS} type="datetime-local" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                    </div>
                    </div>
                  </div>
                )}

                <div className={SECTION_CLASS}>
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">PBL 内容</h3>
                    <p className="text-xs text-muted-foreground">补充情境、核心问题和预期成果，帮助挑战目标更聚焦。</p>
                  </div>
                  <div>
                    <Label>情境故事</Label>
                    <Textarea className={FIELD_CLASS} value={form.scenario} onChange={e => setForm(f => ({ ...f, scenario: e.target.value }))} rows={2} placeholder="描述一个引人入胜的问题情境..." />
                  </div>
                  <div>
                    <Label>驱动问题</Label>
                    <Textarea className={FIELD_CLASS} value={form.driving_question} onChange={e => setForm(f => ({ ...f, driving_question: e.target.value }))} rows={2} placeholder="学生需要探究的核心问题..." />
                  </div>
                  <div>
                    <Label>预期目标</Label>
                    <Textarea className={FIELD_CLASS} value={form.expected_outcome} onChange={e => setForm(f => ({ ...f, expected_outcome: e.target.value }))} rows={2} placeholder="完成挑战后应产出什么..." />
                  </div>
                </div>

                <div className={SECTION_CLASS}>
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">约束条件</h3>
                    <p className="text-xs text-muted-foreground">用简短语句说明材料、时间或提交形式限制。</p>
                  </div>
                  {form.constraints.map((c, i) => (
                    <div key={i} className="flex gap-2 rounded-md border border-border/60 bg-background/80 p-2">
                      <Input className={FIELD_CLASS} value={c} onChange={e => updateConstraint(i, e.target.value)} placeholder={`条件 ${i + 1}`} />
                      {form.constraints.length > 1 && (
                        <Button variant="ghost" size="icon" className="rounded-full" aria-label={`删除条件 ${i + 1}`} onClick={() => setForm(f => ({ ...f, constraints: f.constraints.filter((_, idx) => idx !== i) }))}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => setForm(f => ({ ...f, constraints: [...f.constraints, ''] }))}>+ 添加条件</Button>
                </div>

                <div className={SECTION_CLASS}>
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">参考资源</h3>
                    <p className="text-xs text-muted-foreground">补充资料链接，帮助用户更快进入挑战情境。</p>
                  </div>
                  {form.resources.map((r, i) => (
                    <div key={i} className="grid gap-2 rounded-md border border-border/60 bg-background/80 p-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto]">
                      <Input className={FIELD_CLASS} value={r.title} onChange={e => updateResource(i, 'title', e.target.value)} placeholder="标题" />
                      <Input className={FIELD_CLASS} value={r.url} onChange={e => updateResource(i, 'url', e.target.value)} placeholder="URL" />
                      {form.resources.length > 1 && (
                        <Button variant="ghost" size="icon" className="rounded-full md:self-center" aria-label={`删除资源 ${i + 1}`} onClick={() => setForm(f => ({ ...f, resources: f.resources.filter((_, idx) => idx !== i) }))}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => setForm(f => ({ ...f, resources: [...f.resources, { title: '', url: '', type: 'link' }] }))}>+ 添加资源</Button>
                </div>

                <div className={SECTION_CLASS}>
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">阶段引导</h3>
                    <p className="text-xs text-muted-foreground">为长期挑战或复杂任务拆分清晰的推进步骤。</p>
                  </div>
                  {form.stages.map((s, i) => (
                    <div key={i} className="space-y-3 rounded-lg border border-border/60 bg-background/80 p-3">
                      <div className="flex gap-2 items-center">
                        <span className="text-sm font-medium">阶段 {i + 1}</span>
                        {form.stages.length > 1 && (
                          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 rounded-full" aria-label={`删除阶段 ${i + 1}`} onClick={() => setForm(f => ({ ...f, stages: f.stages.filter((_, idx) => idx !== i) }))}><Trash2 className="h-3 w-3" aria-hidden /></Button>
                        )}
                      </div>
                      <Input className={FIELD_CLASS} value={s.title} onChange={e => updateStage(i, 'title', e.target.value)} placeholder="阶段标题" />
                      <Textarea className={FIELD_CLASS} value={s.description} onChange={e => updateStage(i, 'description', e.target.value)} placeholder="阶段描述" rows={2} />
                      <Input className={FIELD_CLASS} value={s.hint || ''} onChange={e => updateStage(i, 'hint', e.target.value)} placeholder="提示（可选）" />
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => setForm(f => ({ ...f, stages: [...f.stages, { title: '', description: '', hint: '' }] }))}>+ 添加阶段</Button>
                </div>

                <div className={SECTION_CLASS}>
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">STEAM 权重</h3>
                    <p className="text-xs text-muted-foreground">用权重描述挑战更偏向的学科维度，便于后续筛选和展示。</p>
                  </div>
                  {STEAM_DIMS.map(dim => (
                    <div key={dim} className="flex items-center gap-3 rounded-md border border-border/60 bg-background/80 px-3 py-2">
                      <span className="w-20 text-sm">{STEAM_LABELS[dim]} ({dim})</span>
                      <Slider
                        min={0} max={100} step={5}
                        value={[form.steam_weights[dim]]}
                        onValueChange={([v]) => setForm(f => ({ ...f, steam_weights: { ...f.steam_weights, [dim]: v } }))}
                        className="flex-1"
                      />
                      <span className="w-8 text-sm text-right">{form.steam_weights[dim]}</span>
                    </div>
                  ))}
                </div>

                <Button onClick={handleSubmit} className="w-full rounded-md py-6 text-base">{editingId ? '保存修改' : '创建挑战'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div>
        {isLoading ? (
          <div className="admin-panel-card py-10 text-center shadow-none">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : challenges.length === 0 ? (
          <div className="admin-panel-card py-10 text-center shadow-none">
            <p className="text-muted-foreground">暂无挑战</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border/70 bg-background/95">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>标题</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>难度</TableHead>
                    <TableHead>参与/完成</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {challenges.map(ch => (
                    <TableRow key={ch.id}>
                      <TableCell className="max-w-[240px] font-medium">
                        <div className="space-y-1">
                          <p className="truncate">{ch.title}</p>
                          {ch.description && <p className="line-clamp-1 text-xs text-muted-foreground">{ch.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full border-border/70 bg-background/80">{TYPE_LABELS[ch.challenge_type]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`${STATUS_LABELS[ch.status].color} rounded-full`}>
                          {STATUS_LABELS[ch.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>{'★'.repeat(ch.difficulty_stars)}</TableCell>
                      <TableCell>
                        {ch.challenge_type === 'timed'
                          ? `${ch.participants_count} 人参与`
                          : `${ch.completions_count} 人完成`
                        }
                      </TableCell>
                      <TableCell>{new Date(ch.created_at).toLocaleDateString('zh-CN')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {renderStatusActions(ch)}
                          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => openEdit(ch)}>编辑</Button>
                          {ch.status === 'draft' && (
                            <Button size="sm" variant="ghost" className="rounded-full text-red-600 hover:text-red-700" onClick={() => handleDelete(ch.id)}><Trash2 className="h-3 w-3" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
