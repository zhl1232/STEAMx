'use client'

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Flag,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { DIFFICULTY_BAND_LABELS, SUPPORT_LEVEL_LABELS } from '@/lib/content-classification/constants'
import type {
  AdminClassification,
  ClassificationCandidate,
  ContentType,
  DifficultyBand,
  SupportLevel,
} from '@/lib/content-classification/types'
import { getApiErrorMessage } from '@/lib/utils/http'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  course: '技能课程',
  project: '项目',
  challenge: '挑战',
}

const CONTENT_TYPE_ICONS: Record<ContentType, typeof BookOpen> = {
  course: BookOpen,
  project: Boxes,
  challenge: Target,
}

const SUPPORT_LEVEL_DESCRIPTIONS: Record<SupportLevel, string> = {
  independent: '孩子可以独立完成，材料和工具风险低。',
  guided: '孩子完成主要任务，成人需要在旁提醒、准备或观察。',
  adult_required: '成人必须参与关键工具、热源、电、化学品或高风险步骤。',
}

const DIFFICULTY_DESCRIPTIONS: Record<DifficultyBand, string> = {
  beginner: '步骤少，先备能力和推理负荷较低。',
  intermediate: '需要多步计划、基础知识或反复调试。',
  challenge: '任务开放度高，要求组合多项能力并处理不确定性。',
}

type QueueItem = {
  contentType: ContentType
  id: number
  title: string
  status: string | null
  moderationState: string | null
  updatedAt: string | null
  classification: AdminClassification
  candidate: ClassificationCandidate
}

type QueueResponse = {
  items: QueueItem[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

type DetailResponse = {
  contentType: ContentType
  id: number
  content: Record<string, unknown>
  classification: AdminClassification
  candidate: ClassificationCandidate
  history: Record<string, unknown>[]
  inheritance: { source: string; description: string } | null
}

type FilterValue = 'all' | 'course' | 'project' | 'challenge'
type StatusFilter = 'unreviewed' | 'reviewed' | 'all'
type SafetyFilter = 'all' | 'true' | 'false'

type FormState = {
  recommendedMinAge: string
  recommendedMaxAge: string
  supportLevel: '' | SupportLevel
  difficultyStars: string
  note: string
}

const EMPTY_FORM: FormState = {
  recommendedMinAge: '',
  recommendedMaxAge: '',
  supportLevel: '',
  difficultyStars: '',
  note: '',
}

function itemKey(item: Pick<QueueItem, 'contentType' | 'id'>) {
  return `${item.contentType}:${item.id}`
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function readRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)))
    : []
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : []
}

function compactValue(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const strings = value.filter((entry): entry is string => typeof entry === 'string')
    if (strings.length === value.length) return strings.join('、')
  }
  return null
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '未记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatStatus(value: string | null | undefined) {
  const labels: Record<string, string> = {
    approved: '已发布',
    active: '进行中',
    ended: '已结束',
    draft: '草稿',
    pending: '待处理',
    rejected: '已退回',
  }
  return value ? labels[value] || value : '未标记'
}

function publicHref(type: ContentType, id: number) {
  if (type === 'course') return `/courses/${id}`
  if (type === 'challenge') return `/pbl/${id}`
  return `/project/${id}`
}

function getFormState(detail: DetailResponse): FormState {
  const classification = detail.classification
  const candidate = detail.candidate
  const contentDifficulty = readNumber(detail.content.difficulty_stars)

  return {
    recommendedMinAge: String(classification.recommendedMinAge ?? candidate.recommendedMinAge ?? ''),
    recommendedMaxAge: String(classification.recommendedMaxAge ?? candidate.recommendedMaxAge ?? ''),
    supportLevel: classification.supportLevel ?? candidate.supportLevel ?? '',
    difficultyStars: String(classification.difficultyStars ?? candidate.difficultyStars ?? contentDifficulty ?? ''),
    note: '',
  }
}

function classificationPayload(form: FormState) {
  const recommendedMinAge = form.recommendedMinAge.trim() ? Number(form.recommendedMinAge) : null
  const recommendedMaxAge = form.recommendedMaxAge.trim() ? Number(form.recommendedMaxAge) : null
  const difficultyStars = form.difficultyStars.trim() ? Number(form.difficultyStars) : null

  return {
    recommendedMinAge,
    recommendedMaxAge,
    supportLevel: form.supportLevel || null,
    difficultyStars,
  }
}

function validateForm(form: FormState, decision: 'approve' | 'return') {
  const payload = classificationPayload(form)
  const errors: string[] = []

  if (!Number.isInteger(payload.recommendedMinAge) || payload.recommendedMinAge! < 3 || payload.recommendedMinAge! > 16) {
    errors.push('推荐起始年龄需要是 3–16 的整数')
  }
  if (payload.recommendedMaxAge !== null && (!Number.isInteger(payload.recommendedMaxAge) || payload.recommendedMaxAge < payload.recommendedMinAge! || payload.recommendedMaxAge > 16)) {
    errors.push('推荐年龄上限需要不小于起始年龄且不超过 16')
  }
  if (!payload.supportLevel || !Object.prototype.hasOwnProperty.call(SUPPORT_LEVEL_LABELS, payload.supportLevel)) {
    errors.push('请选择成人支持度')
  }
  if (!Number.isInteger(payload.difficultyStars) || payload.difficultyStars! < 1 || payload.difficultyStars! > 6) {
    errors.push('内部难度星级需要是 1–6 的整数')
  }
  if (decision === 'return' && !form.note.trim()) {
    errors.push('退回时请写明原因')
  }

  return { errors, payload }
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const reviewed = status === 'reviewed'
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
      reviewed
        ? 'border-[hsl(var(--status-success)/0.28)] bg-[hsl(var(--status-success)/0.1)] text-[hsl(var(--status-success))]'
        : 'border-[hsl(var(--status-warning)/0.3)] bg-[hsl(var(--status-warning)/0.12)] text-[hsl(var(--status-warning))]',
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', reviewed ? 'bg-[hsl(var(--status-success))]' : 'bg-[hsl(var(--status-warning))]')} />
      {reviewed ? '已复核' : '待复核'}
    </span>
  )
}

function EmptyState({ title, description, icon: Icon = ScanSearch }: { title: string; description: string; icon?: typeof ScanSearch }) {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-(--radius-lg) border border-dashed border-border/80 bg-[linear-gradient(145deg,hsl(var(--surface-muted)/0.55),transparent)] p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]">
          <Icon className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function StructuredBlock({ value, emptyLabel = '暂无内容' }: { value: unknown; emptyLabel?: string }) {
  const text = compactValue(value)
  if (text) {
    return <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/85">{text}</p>
  }

  if (Array.isArray(value) && value.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  if (value === null || value === undefined) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[hsl(var(--surface-muted)/0.65)] p-3 font-mono text-xs leading-6 text-muted-foreground">{prettyJson(value)}</pre>
}

function ContentSection({ title, eyebrow, children, icon: Icon = FileText }: { title: string; eyebrow?: string; children: React.ReactNode; icon?: typeof FileText }) {
  return (
    <section className="rounded-(--radius-lg) border border-border/70 bg-background/70 p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          {eyebrow ? <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p> : null}
          <h3 className="mt-1 text-base font-semibold tracking-tight">{title}</h3>
        </div>
      </div>
      {children}
    </section>
  )
}

function ContentDossier({ detail }: { detail: DetailResponse }) {
  const content = detail.content
  const tags = readStringArray(content.tags)
  const lessons = readRecords(content.course_lessons)
  const materials = readRecords(content.project_materials)
  const steps = readRecords(content.project_steps)
  const type = detail.contentType

  return (
    <div className="space-y-4">
      <ContentSection title="内容摘要" eyebrow="CONTENT BRIEF" icon={FileText}>
        <div className="space-y-4">
          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/85">
            {readText(content.description) || '暂无描述，请结合下方正文、步骤或阶段判断。'}
          </p>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => <Badge key={tag} variant="outline" className="bg-background/60 font-normal">{tag}</Badge>)}
            </div>
          ) : null}
          <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-3">
            <MetaValue label="内容状态" value={formatStatus(readText(content.status))} />
            <MetaValue label="原内部星级" value={readNumber(content.difficulty_stars)?.toString() || '缺失'} />
            <MetaValue label="最近更新" value={formatDate(readText(content.updated_at))} />
          </div>
        </div>
      </ContentSection>

      {type === 'course' ? (
        <ContentSection title={`课程课时 · ${lessons.length} 节`} eyebrow="LESSON INHERITANCE" icon={BookOpen}>
          {detail.inheritance ? <p className="mb-4 rounded-lg border border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--brand-blue)/0.06)] px-3 py-2.5 text-xs leading-6 text-muted-foreground">{detail.inheritance.description}</p> : null}
          {lessons.length === 0 ? <p className="text-sm text-muted-foreground">暂无课时内容。</p> : (
            <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
              {lessons.map((lesson, index) => (
                <details key={`${String(lesson.id ?? index)}-${index}`} className="group rounded-lg border border-border/60 bg-[hsl(var(--surface-muted)/0.35)] open:bg-[hsl(var(--surface-muted)/0.58)]">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-background font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1 truncate">{readText(lesson.title) || `第 ${index + 1} 节课`}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="space-y-3 border-t border-border/50 px-3 pb-4 pt-3">
                    {readText(lesson.content) ? <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/80">{lesson.content as string}</p> : null}
                    {lesson.steps !== null && lesson.steps !== undefined ? <StructuredBlock value={lesson.steps} /> : null}
                    {lesson.resources !== null && lesson.resources !== undefined ? <StructuredBlock value={lesson.resources} /> : null}
                    {!readText(lesson.content) && lesson.steps === undefined && lesson.resources === undefined ? <p className="text-sm text-muted-foreground">暂无可读正文。</p> : null}
                  </div>
                </details>
              ))}
            </div>
          )}
        </ContentSection>
      ) : null}

      {type === 'project' ? (
        <>
          <ContentSection title={`材料清单 · ${materials.length} 项`} eyebrow="MATERIALS" icon={Boxes}>
            {materials.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {materials.map((material, index) => (
                  <li key={`${String(material.id ?? index)}-${index}`} className="flex items-start gap-2 rounded-lg bg-[hsl(var(--surface-muted)/0.5)] px-3 py-2.5 text-sm">
                    <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                    <span className="leading-6">{readText(material.material) || '未命名材料'}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">暂无材料清单。</p>}
          </ContentSection>
          <ContentSection title={`操作步骤 · ${steps.length} 步`} eyebrow="PROCESS" icon={ClipboardCheck}>
            {steps.length > 0 ? (
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={`${String(step.id ?? index)}-${index}`} className="flex gap-3 rounded-lg border border-border/55 bg-[hsl(var(--surface-muted)/0.35)] p-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--brand-blue)/0.1)] font-mono text-xs font-semibold text-[hsl(var(--brand-blue))]">{index + 1}</span>
                    <div className="min-w-0 space-y-1">
                      <h4 className="text-sm font-semibold">{readText(step.title) || `第 ${index + 1} 步`}</h4>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{readText(step.description) || '暂无步骤说明。'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">暂无步骤。</p>}
          </ContentSection>
        </>
      ) : null}

      {type === 'challenge' ? (
        <ContentSection title="挑战任务结构" eyebrow="CHALLENGE BRIEF" icon={Target}>
          <div className="space-y-4">
            {([
              ['情境', content.scenario],
              ['驱动问题', content.driving_question],
              ['预期成果', content.expected_outcome],
              ['约束条件', content.constraints],
            ] as Array<[string, unknown]>).map(([label, value]) => (
              <div key={label} className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                <StructuredBlock value={value} />
              </div>
            ))}
            <div className="grid gap-4 border-t border-border/60 pt-4 md:grid-cols-2">
              <div className="space-y-1.5"><p className="text-xs font-semibold text-muted-foreground">资源</p><StructuredBlock value={content.resources} /></div>
              <div className="space-y-1.5"><p className="text-xs font-semibold text-muted-foreground">阶段</p><StructuredBlock value={content.stages} /></div>
            </div>
          </div>
        </ContentSection>
      ) : null}
    </div>
  )
}

function MetaValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  )
}

function CandidatePanel({ candidate, classification }: { candidate: ClassificationCandidate; classification: AdminClassification }) {
  const difficultyLabel = candidate.difficultyBand ? DIFFICULTY_BAND_LABELS[candidate.difficultyBand] : '待确认'
  const supportLabel = candidate.supportLevel ? SUPPORT_LEVEL_LABELS[candidate.supportLevel] : '待确认'

  return (
    <div className="rounded-(--radius-lg) border border-[hsl(var(--brand-amber)/0.24)] bg-[linear-gradient(135deg,hsl(var(--brand-amber)/0.1),hsl(var(--surface-raised)/0.72))] p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-amber)/0.16)] text-[hsl(var(--brand-amber))]"><Sparkles className="h-4 w-4" /></div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--brand-amber))]">RULES V1 CANDIDATE</p>
          <h3 className="mt-1 text-sm font-semibold">候选只负责提醒，不能代替人工结论</h3>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <CandidateValue label="建议年龄" value={candidate.recommendedMinAge ? `${candidate.recommendedMinAge} 岁起` : '待确认'} />
        <CandidateValue label="难度" value={`${candidate.difficultyStars ?? classification.difficultyStars ?? '—'} · ${difficultyLabel}`} />
        <CandidateValue label="成人支持" value={supportLabel} />
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>置信度</span>
          <Badge variant="outline" className="bg-background/50 font-medium">{candidate.confidence === 'high' ? '高' : candidate.confidence === 'low' ? '低' : '中'}</Badge>
          {candidate.matchedRules.map((rule) => <Badge key={rule} variant="outline" className="bg-background/35 font-mono text-[10px] font-normal">{rule}</Badge>)}
        </div>
        {candidate.safetyKeywords.length > 0 ? (
          <div className="flex flex-wrap items-start gap-2 rounded-lg border border-[hsl(var(--status-warning)/0.24)] bg-[hsl(var(--status-warning)/0.08)] px-3 py-2.5 text-xs text-[hsl(var(--status-warning))]">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>命中安全提示词：{candidate.safetyKeywords.join('、')}。请结合实际工具和步骤判断支持度。</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function CandidateValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/55 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}

function ReviewForm({
  detail,
  form,
  setForm,
  busy,
  onSaveCandidate,
  onDecision,
}: {
  detail: DetailResponse
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  busy: boolean
  onSaveCandidate: () => void
  onDecision: (decision: 'approve' | 'return') => void
}) {
  const currentBand = form.difficultyStars && Number(form.difficultyStars) >= 1 && Number(form.difficultyStars) <= 6
    ? Number(form.difficultyStars) <= 2 ? 'beginner' : Number(form.difficultyStars) <= 4 ? 'intermediate' : 'challenge'
    : null

  return (
    <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
      <CandidatePanel candidate={detail.candidate} classification={detail.classification} />

      <Card className="overflow-hidden border-border/75 shadow-[0_20px_54px_-42px_hsl(var(--surface-shadow)/0.55)]">
        <CardHeader className="border-b border-border/60 bg-[hsl(var(--surface-muted)/0.36)] px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]"><ClipboardCheck className="h-4 w-4" /></div>
            <div>
              <CardTitle className="text-base">确认三轴结论</CardTitle>
              <CardDescription className="mt-1 text-xs leading-5">请以实际正文、材料和步骤为准。通过后会写入 manual 审核结论。</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 px-4 py-5 sm:px-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recommended-min-age">推荐起始年龄</Label>
              <div className="relative"><Input id="recommended-min-age" inputMode="numeric" min={3} max={16} value={form.recommendedMinAge} onChange={(event) => setForm((current) => ({ ...current, recommendedMinAge: event.target.value }))} placeholder="3–16" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">岁起</span></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recommended-max-age">推荐年龄上限 <span className="font-normal text-muted-foreground">（可不填）</span></Label>
              <div className="relative"><Input id="recommended-max-age" inputMode="numeric" min={3} max={16} value={form.recommendedMaxAge} onChange={(event) => setForm((current) => ({ ...current, recommendedMaxAge: event.target.value }))} placeholder="无明确上限" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">岁</span></div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>成人支持度</Label>
            <Select value={form.supportLevel} onValueChange={(value) => setForm((current) => ({ ...current, supportLevel: value as SupportLevel }))}>
              <SelectTrigger><SelectValue placeholder="选择完成时需要的成人支持" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SUPPORT_LEVEL_LABELS) as SupportLevel[]).map((level) => (
                  <SelectItem key={level} value={level}>{SUPPORT_LEVEL_LABELS[level]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.supportLevel ? <p className="text-xs leading-5 text-muted-foreground">{SUPPORT_LEVEL_DESCRIPTIONS[form.supportLevel]}</p> : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3"><Label htmlFor="difficulty-stars">内部难度星级</Label>{currentBand ? <span className="text-xs font-semibold text-[hsl(var(--brand-blue))]">{DIFFICULTY_BAND_LABELS[currentBand]}</span> : null}</div>
            <Select value={form.difficultyStars} onValueChange={(value) => setForm((current) => ({ ...current, difficultyStars: value }))}>
              <SelectTrigger id="difficulty-stars"><SelectValue placeholder="选择 1–6 星" /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((stars) => {
                  const band: DifficultyBand = stars <= 2 ? 'beginner' : stars <= 4 ? 'intermediate' : 'challenge'
                  return <SelectItem key={stars} value={String(stars)}>{stars} 星 · {DIFFICULTY_BAND_LABELS[band]}</SelectItem>
                })}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-muted-foreground">{currentBand ? DIFFICULTY_DESCRIPTIONS[currentBand] : '星级只用于内部校准，不能代替成人支持度判断。'}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-note">审核备注</Label>
            <Textarea id="review-note" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="记录你对年龄、工具风险或支持度的判断；退回时必须填写。" className="min-h-24 resize-y" maxLength={2000} />
            <p className="text-right text-[11px] text-muted-foreground">{form.note.length}/2000</p>
          </div>

          <Separator />

          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={onSaveCandidate} disabled={busy} className="w-full"><Save className="mr-2 h-4 w-4" />保存候选</Button>
            <Button type="button" tone="success" onClick={() => onDecision('approve')} disabled={busy} className="w-full"><Check className="mr-2 h-4 w-4" />通过并标记已复核</Button>
          </div>
          <Button type="button" variant="ghost" onClick={() => onDecision('return')} disabled={busy} className="w-full text-muted-foreground hover:text-[hsl(var(--status-warning))]"><RotateCcw className="mr-2 h-4 w-4" />退回，要求重新确认</Button>
          {busy ? <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />正在保存审核结果…</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}

function HistoryPanel({ history }: { history: Record<string, unknown>[] }) {
  if (history.length === 0) return null

  return (
    <ContentSection title="审核轨迹" eyebrow="AUDIT TRAIL" icon={History}>
      <div className="space-y-3">
        {history.map((event, index) => {
          const decision = readText(event.decision) || 'event'
          const label = decision === 'approve' ? '通过' : decision === 'return' ? '退回' : decision === 'candidate' ? '候选' : decision === 'invalidate' ? '失效' : decision
          return (
            <div key={`${String(event.id ?? index)}-${index}`} className="flex gap-3 rounded-lg border border-border/55 bg-[hsl(var(--surface-muted)/0.35)] p-3">
              <span className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full', decision === 'approve' ? 'bg-[hsl(var(--status-success)/0.12)] text-[hsl(var(--status-success))]' : 'bg-[hsl(var(--status-warning)/0.12)] text-[hsl(var(--status-warning))]')}>
                {decision === 'approve' ? <CheckCircle2 className="h-4 w-4" /> : <History className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-sm font-semibold">{label}</span><span className="text-xs text-muted-foreground">{formatDate(readText(event.created_at))}</span></div>
                {readText(event.reason) ? <p className="mt-1 text-xs text-muted-foreground">{event.reason as string}</p> : null}
                {readText(event.actor_label) ? <p className="mt-1 text-xs text-muted-foreground">操作人：{event.actor_label as string}</p> : null}
              </div>
            </div>
          )
        })}
      </div>
    </ContentSection>
  )
}

export function ContentClassificationReview() {
  const { toast } = useToast()
  const [typeFilter, setTypeFilter] = useState<FilterValue>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unreviewed')
  const [safetyFilter, setSafetyFilter] = useState<SafetyFilter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [queue, setQueue] = useState<QueueResponse | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [queueLoading, setQueueLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [mutationLoading, setMutationLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadQueue = useCallback(async (requestedPage = 1) => {
    setQueueLoading(true)
    setLoadError(null)
    const params = new URLSearchParams({
      contentType: typeFilter,
      status: statusFilter,
      page: String(requestedPage),
      pageSize: String(PAGE_SIZE),
    })
    if (safetyFilter !== 'all') params.set('hasSafetyFlag', safetyFilter)

    try {
      const response = await fetch(`/api/admin/content-classifications?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(await getApiErrorMessage(response, '加载分级队列失败'))
      const data = await response.json() as QueueResponse
      setQueue(data)
      setPage(requestedPage)
      setSelectedKey((current) => current && data.items.some((item) => itemKey(item) === current) ? current : data.items[0] ? itemKey(data.items[0]) : null)
    } catch (error) {
      setQueue(null)
      setSelectedKey(null)
      setLoadError(error instanceof Error ? error.message : '加载分级队列失败')
    } finally {
      setQueueLoading(false)
    }
  }, [safetyFilter, statusFilter, typeFilter])

  useEffect(() => {
    void loadQueue(1)
  }, [loadQueue])

  const selectedItem = useMemo(() => queue?.items.find((item) => itemKey(item) === selectedKey) || null, [queue, selectedKey])

  const loadDetail = useCallback(async (item: QueueItem, signal?: AbortSignal) => {
    setDetailLoading(true)
    try {
      const response = await fetch(`/api/admin/content-classifications/${item.contentType}/${item.id}`, { cache: 'no-store', signal })
      if (!response.ok) throw new Error(await getApiErrorMessage(response, '加载内容详情失败'))
      const data = await response.json() as DetailResponse
      setDetail(data)
      setForm(getFormState(data))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setDetail(null)
      toast({ title: '详情加载失败', description: error instanceof Error ? error.message : '加载内容详情失败', variant: 'destructive' })
    } finally {
      if (!signal?.aborted) setDetailLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (!selectedItem) {
      setDetail(null)
      setDetailLoading(false)
      return
    }

    const controller = new AbortController()
    void loadDetail(selectedItem, controller.signal)
    return () => controller.abort()
  }, [loadDetail, selectedItem])

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return queue?.items || []
    return (queue?.items || []).filter((item) => `${item.title} ${item.contentType} ${item.id}`.toLowerCase().includes(normalizedQuery))
  }, [query, queue?.items])

  const handleSaveCandidate = async () => {
    if (!detail) return
    const { errors, payload } = validateForm(form, 'approve')
    if (errors.length > 0) {
      toast({ title: '请先补完整候选值', description: errors.join('；'), variant: 'destructive' })
      return
    }

    setMutationLoading(true)
    try {
      const response = await fetch(`/api/admin/content-classifications/${detail.contentType}/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(await getApiErrorMessage(response, '保存候选失败'))
      toast({ title: '候选值已保存', description: '状态仍保持待复核，未写入人工审核结论。' })
      await loadQueue(page)
    } catch (error) {
      toast({ title: '保存候选失败', description: error instanceof Error ? error.message : '保存候选失败', variant: 'destructive' })
    } finally {
      setMutationLoading(false)
    }
  }

  const handleDecision = async (decision: 'approve' | 'return') => {
    if (!detail) return
    const { errors, payload } = validateForm(form, decision)
    if (errors.length > 0) {
      toast({ title: decision === 'approve' ? '还不能通过' : '还不能退回', description: errors.join('；'), variant: 'destructive' })
      return
    }

    setMutationLoading(true)
    try {
      const response = await fetch(`/api/admin/content-classifications/${detail.contentType}/${detail.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          decision,
          note: form.note.trim() || null,
          expectedRevision: detail.classification.revision,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      if (!response.ok) throw new Error(await getApiErrorMessage(response, decision === 'approve' ? '提交审核失败' : '退回失败'))
      toast({ title: decision === 'approve' ? '内容已通过复核' : '内容已退回', description: decision === 'approve' ? '已写入人工审核结论。' : '状态保持待复核，审核备注已记录。' })
      await loadQueue(page)
    } catch (error) {
      toast({ title: decision === 'approve' ? '提交审核失败' : '退回失败', description: error instanceof Error ? error.message : '审核操作失败', variant: 'destructive' })
    } finally {
      setMutationLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="section-kicker">REVIEW DESK / CONTENT CLASSIFICATION V1</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">逐条确认内容分级</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">先读内容，再确认「适龄、难度、成人支持」三条轴。关键词和规则候选只用于排队提醒，不会自动决定安全等级。</p>
        </div>
        <Button variant="outline" onClick={() => void loadQueue(page)} disabled={queueLoading} className="shrink-0"><RefreshCw className={cn('mr-2 h-4 w-4', queueLoading && 'animate-spin')} />刷新队列</Button>
      </div>

      {loadError ? (
        <div role="alert" className="flex items-start gap-3 rounded-(--radius-lg) border border-[hsl(var(--status-warning)/0.3)] bg-[hsl(var(--status-warning)/0.1)] px-4 py-3.5 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--status-warning))]" />
          <div className="min-w-0">
            <p className="font-semibold">审核队列暂时不可用</p>
            <p className="mt-1 break-words text-xs leading-6 text-muted-foreground">{loadError}</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">如果这是首次部署，请先按项目 runbook 应用内容分级迁移；页面不会通过旧字段绕过审核状态。</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-(--radius-lg) border border-border/70 bg-[hsl(var(--surface-muted)/0.55)] px-4 py-3.5"><p className="text-[11px] font-medium text-muted-foreground">当前批次</p><p className="mt-1 text-xl font-semibold">{queueLoading ? '—' : visibleItems.length}<span className="ml-1 text-sm font-normal text-muted-foreground">条</span></p></div>
        <div className="rounded-(--radius-lg) border border-[hsl(var(--status-warning)/0.22)] bg-[hsl(var(--status-warning)/0.07)] px-4 py-3.5"><p className="text-[11px] font-medium text-muted-foreground">当前批次安全提示</p><p className="mt-1 text-xl font-semibold text-[hsl(var(--status-warning))]">{queueLoading ? '—' : (queue?.items || []).filter((item) => item.candidate.safetyKeywords.length > 0).length}<span className="ml-1 text-sm font-normal text-muted-foreground">条</span></p></div>
        <div className="rounded-(--radius-lg) border border-[hsl(var(--brand-blue)/0.2)] bg-[hsl(var(--brand-blue)/0.06)] px-4 py-3.5"><p className="text-[11px] font-medium text-muted-foreground">排序逻辑</p><p className="mt-1 text-sm font-semibold">已发布 → 风险 → 低置信</p></div>
      </div>

      <div className="grid min-h-[680px] gap-4 xl:grid-cols-[minmax(19rem,0.37fr)_minmax(0,0.63fr)]">
        <aside className="surface-subtle min-w-0 overflow-hidden rounded-(--radius-lg) border p-3 shadow-none sm:p-4">
          <div className="flex items-start justify-between gap-3 px-1 pb-3">
            <div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">QUEUE</p><h3 className="mt-1 text-base font-semibold">待处理内容</h3></div>
            <Badge variant="outline" className="shrink-0 bg-background/60">第 {page} 页</Badge>
          </div>
          <div className="space-y-2 border-b border-border/60 pb-3">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或 ID" aria-label="搜索内容标题或 ID" />
            <div className="grid grid-cols-2 gap-2">
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as FilterValue)}><SelectTrigger aria-label="内容类型"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部类型</SelectItem><SelectItem value="course">技能课程</SelectItem><SelectItem value="project">项目</SelectItem><SelectItem value="challenge">挑战</SelectItem></SelectContent></Select>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}><SelectTrigger aria-label="复核状态"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unreviewed">待复核</SelectItem><SelectItem value="reviewed">已复核</SelectItem><SelectItem value="all">全部状态</SelectItem></SelectContent></Select>
            </div>
            <Select value={safetyFilter} onValueChange={(value) => setSafetyFilter(value as SafetyFilter)}><SelectTrigger aria-label="安全提示筛选"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">安全提示：全部</SelectItem><SelectItem value="true">只看有安全提示</SelectItem><SelectItem value="false">只看无安全提示</SelectItem></SelectContent></Select>
          </div>

          <div className="mt-3 space-y-1.5 xl:max-h-[calc(100vh-27rem)] xl:overflow-y-auto xl:pr-1">
            {queueLoading ? Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-20 rounded-xl" />) : visibleItems.length === 0 ? <div className="px-3 py-12 text-center"><ScanSearch className="mx-auto h-7 w-7 text-muted-foreground/50" /><p className="mt-3 text-sm font-medium">没有匹配内容</p><p className="mt-1 text-xs leading-5 text-muted-foreground">尝试调整类型、状态或安全提示筛选。</p></div> : visibleItems.map((item) => {
              const Icon = CONTENT_TYPE_ICONS[item.contentType]
              const selected = itemKey(item) === selectedKey
              return (
                <button key={itemKey(item)} type="button" onClick={() => setSelectedKey(itemKey(item))} aria-pressed={selected} className={cn('group w-full rounded-xl border px-3 py-3 text-left transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-px hover:border-[hsl(var(--brand-blue)/0.35)] hover:bg-background/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring', selected ? 'border-[hsl(var(--brand-blue)/0.45)] bg-background/90 shadow-[0_14px_30px_-24px_hsl(var(--brand-blue)/0.75)]' : 'border-transparent bg-background/35')}>
                  <div className="flex items-start gap-2.5"><div className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', selected ? 'bg-[hsl(var(--brand-blue)/0.12)] text-[hsl(var(--brand-blue))]' : 'bg-[hsl(var(--surface-muted)/0.85)] text-muted-foreground')}><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{item.title || '未命名内容'}</p>{item.candidate.safetyKeywords.length > 0 ? <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--status-warning))]" /> : null}</div><div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"><span>{CONTENT_TYPE_LABELS[item.contentType]}</span><span>·</span><span>#{item.id}</span><span>·</span><StatusPill status={item.classification.status} /></div></div><ChevronDown className="mt-1 h-4 w-4 shrink-0 -rotate-90 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div>
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border/60 px-1 pt-3">
            <Button variant="ghost" size="sm" onClick={() => void loadQueue(page - 1)} disabled={queueLoading || page <= 1}><ArrowLeft className="mr-1.5 h-4 w-4" />上一页</Button>
            <span className="text-xs text-muted-foreground">{queue?.hasMore ? '还有更多' : '已到末页'}</span>
            <Button variant="ghost" size="sm" onClick={() => void loadQueue(page + 1)} disabled={queueLoading || !queue?.hasMore}><ArrowRight className="ml-1.5 h-4 w-4" />下一页</Button>
          </div>
        </aside>

        <main className="min-w-0">
          {detailLoading ? <div className="space-y-4"><Skeleton className="h-28 rounded-(--radius-lg)" /><Skeleton className="h-72 rounded-(--radius-lg)" /><Skeleton className="h-56 rounded-(--radius-lg)" /></div> : detail && selectedItem ? (
            <div className="space-y-4">
              <div className="surface-panel overflow-hidden rounded-(--radius-lg) border px-4 py-4 shadow-none sm:px-5 sm:py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="bg-[hsl(var(--brand-blue)/0.07)] text-[hsl(var(--brand-blue))]">{CONTENT_TYPE_LABELS[detail.contentType]}</Badge><span className="font-mono text-xs text-muted-foreground">#{detail.id}</span><StatusPill status={detail.classification.status} /></div><h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{readText(detail.content.title) || selectedItem.title}</h2><p className="mt-2 text-sm text-muted-foreground">内容状态：{formatStatus(selectedItem.status)}{selectedItem.moderationState ? ` · 安全审核：${formatStatus(selectedItem.moderationState)}` : ''} · revision {detail.classification.revision}</p></div>
                  <Button asChild variant="outline" size="sm" className="shrink-0"><a href={publicHref(detail.contentType, detail.id)} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />打开公开页</a></Button>
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]">
                <ContentDossier detail={detail} />
                <ReviewForm detail={detail} form={form} setForm={setForm} busy={mutationLoading} onSaveCandidate={() => void handleSaveCandidate()} onDecision={(decision) => void handleDecision(decision)} />
              </div>
              <HistoryPanel history={detail.history} />
            </div>
          ) : <EmptyState title={loadError ? '等待分级字段部署' : '选择一条内容开始复核'} description={loadError ? '审核页面已经就绪；迁移应用后刷新本页即可加载队列。' : '从左侧队列选择课程、项目或挑战，先阅读内容档案，再确认三轴结论。'} icon={loadError ? Flag : ScanSearch} />}
        </main>
      </div>
    </div>
  )
}
