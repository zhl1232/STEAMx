'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Ban, CheckCircle2, Clock3, Loader2, RefreshCcw, ShieldAlert, UserRound } from 'lucide-react'

import { SettingsSubpageShell } from '@/app/settings/_components/settings-subpage-shell'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

type SafetyAction = {
  id: number
  action_type: string
  status: string
  reason: string
  starts_at: string
  ends_at: string | null
  created_at: string
}

type SafetyData = {
  profile: {
    safety_status: string
    safety_restricted_until: string | null
    safety_restriction_reason: string | null
  }
  actions: SafetyAction[]
  reports: Array<{
    id: number
    content_type: string
    content_id: number
    reason: string
    status: string
    reviewer_note: string | null
    created_at: string
    reviewed_at: string | null
  }>
  appeals: Array<{
    id: number
    action_id: number
    reason: string
    status: string
    reviewer_note: string | null
    created_at: string
    reviewed_at: string | null
  }>
  blocks: Array<{ blocked_user_id: string; created_at: string }>
}

const ACTION_LABELS: Record<string, string> = {
  warning: '社区安全提醒',
  interaction_restriction: '互动限制',
  account_suspension: '账号暂时停用',
  account_ban: '账号永久停用',
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  observation: '观察记录',
  project: '项目',
  completion: '作品',
  discussion: '讨论',
}

const REPORT_REASON_LABELS: Record<string, string> = {
  spam: '垃圾信息',
  harassment: '骚扰或辱骂',
  inappropriate: '不当内容',
  illegal: '违法违规',
  other: '其他',
}

const STATUS_LABELS: Record<string, string> = {
  active: '进行中',
  pending: '处理中',
  resolved: '已处理',
  dismissed: '已驳回',
  approved: '申诉通过',
  rejected: '申诉驳回',
  expired: '已结束',
}

function statusTone(status: string) {
  if (status === 'active' || status === 'approved') {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  }
  if (status === 'pending') {
    return 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
  }
  if (status === 'dismissed' || status === 'rejected' || status === 'expired') {
    return 'bg-muted text-muted-foreground'
  }
  return 'bg-primary/10 text-primary'
}

function formatDate(value: string | null) {
  if (!value) return '暂未结束'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString('zh-CN')
}

export default function SafetySettingsPage() {
  const { toast } = useToast()
  const [data, setData] = useState<SafetyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [appealActionId, setAppealActionId] = useState<number | null>(null)
  const [appealReason, setAppealReason] = useState('')
  const [submittingAppeal, setSubmittingAppeal] = useState(false)
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null)

  const loadSafety = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch('/api/settings/safety')
      if (!response.ok) throw new Error('加载安全中心失败')
      setData(await response.json() as SafetyData)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '加载安全中心失败')
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadSafety()
  }, [loadSafety])

  const safetyIsActive = data?.profile.safety_status === 'active'

  const submitAppeal = async () => {
    if (!appealActionId || !appealReason.trim()) return
    setSubmittingAppeal(true)
    try {
      const response = await fetch('/api/settings/safety/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId: appealActionId, reason: appealReason.trim() }),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || '提交申诉失败')
      toast({ title: '申诉已提交' })
      setAppealActionId(null)
      setAppealReason('')
      await loadSafety()
    } catch (error) {
      toast({ title: '提交失败', description: error instanceof Error ? error.message : '请稍后重试', variant: 'destructive' })
    } finally {
      setSubmittingAppeal(false)
    }
  }

  const unblock = async (userId: string) => {
    setUnblockingUserId(userId)
    try {
      const response = await fetch(`/api/blocks/${userId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('取消屏蔽失败')
      toast({ title: '已取消屏蔽' })
      await loadSafety()
    } catch (error) {
      toast({ title: '操作失败', description: error instanceof Error ? error.message : '请稍后重试', variant: 'destructive' })
    } finally {
      setUnblockingUserId(null)
    }
  }

  return (
    <SettingsSubpageShell
      title="社区安全中心"
      kicker="安全与治理"
      description="管理账号状态、举报与处罚记录。"
    >
      {loading ? (
        <div className="flex min-h-56 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : loadError || !data ? (
        <div className="settings-section flex min-h-56 flex-col items-center justify-center gap-4 px-5 py-8 text-center">
          <p role="alert" className="max-w-sm text-sm leading-6 text-muted-foreground">
            {loadError || '安全中心暂时无法加载。'}
          </p>
          <Button type="button" variant="secondary" shape="soft" onClick={() => void loadSafety()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            重新加载
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          <section className={`settings-section flex items-start gap-3 p-4 sm:p-5 ${safetyIsActive ? 'bg-emerald-500/[0.06]' : 'bg-amber-500/[0.08]'}`}>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${safetyIsActive ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/12 text-amber-700 dark:text-amber-300'}`}>
              {safetyIsActive ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">
                  {safetyIsActive ? '账号状态正常' : '账号存在安全限制'}
                </h2>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${safetyIsActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/12 text-amber-700 dark:text-amber-300'}`}>
                  {safetyIsActive ? '可正常互动' : '需要关注'}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {data.profile.safety_restriction_reason || '当前账号没有安全限制。'}
              </p>
              {data.profile.safety_restricted_until ? (
                <p className="mt-2 text-xs text-muted-foreground">预计结束：{formatDate(data.profile.safety_restricted_until)}</p>
              ) : null}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">已屏蔽用户</h2>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">{data.blocks.length}</span>
            </div>
            {data.blocks.length === 0 ? (
              <div className="settings-group">
                <p className="px-4 py-5 text-sm text-muted-foreground">暂时没有屏蔽用户。</p>
              </div>
            ) : (
              <div className="settings-group divide-y divide-border/50">
                {data.blocks.map((block) => (
                  <div key={block.blocked_user_id} className="flex min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-mono">{block.blocked_user_id}</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      shape="soft"
                      className="self-start sm:self-auto"
                      disabled={unblockingUserId === block.blocked_user_id}
                      onClick={() => void unblock(block.blocked_user_id)}
                    >
                      {unblockingUserId === block.blocked_user_id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                      取消屏蔽
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">举报记录</h2>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">{data.reports.length}</span>
            </div>
            {data.reports.length === 0 ? (
              <div className="settings-group">
                <p className="px-4 py-5 text-sm text-muted-foreground">暂无举报记录。</p>
              </div>
            ) : (
              <div className="settings-group divide-y divide-border/50">
                {data.reports.map((report) => (
                  <div key={report.id} className="space-y-1 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>举报 {CONTENT_TYPE_LABELS[report.content_type] || report.content_type} #{report.content_id}</span>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone(report.status)}`}>
                        {STATUS_LABELS[report.status] || report.status}
                      </span>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">举报原因：{REPORT_REASON_LABELS[report.reason] || report.reason}</p>
                    {report.reviewer_note ? <p className="text-xs leading-5 text-muted-foreground">处理说明：{report.reviewer_note}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">处罚与申诉</h2>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">{data.actions.length}</span>
            </div>
            {data.actions.length === 0 ? (
              <div className="settings-group">
                <p className="px-4 py-5 text-sm text-muted-foreground">暂无处罚记录。</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.actions.map((action) => {
                  const hasPendingAppeal = data.appeals.some((appeal) => appeal.action_id === action.id && appeal.status === 'pending')
                  return (
                    <article key={action.id} className="settings-group p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{ACTION_LABELS[action.action_type] || action.action_type}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.reason}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone(action.status)}`}>
                          {STATUS_LABELS[action.status] || action.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>开始：{formatDate(action.starts_at)}</span>
                        <span>结束：{formatDate(action.ends_at)}</span>
                      </div>
                      {action.status === 'active' && hasPendingAppeal ? (
                        <p className="mt-4 rounded-md bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-300">申诉已提交，等待审核。</p>
                      ) : null}
                      {action.status === 'active' && !hasPendingAppeal ? (
                        appealActionId === action.id ? (
                          <div className="mt-4 rounded-md bg-background/60 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <Label htmlFor={`appeal-reason-${action.id}`} className="text-xs font-semibold">申诉说明</Label>
                              <span className="text-[11px] text-muted-foreground">{appealReason.length}/2000</span>
                            </div>
                            <Textarea
                              id={`appeal-reason-${action.id}`}
                              value={appealReason}
                              onChange={(event) => setAppealReason(event.target.value.slice(0, 2000))}
                              placeholder="请说明你认为需要重新审核的原因"
                              rows={4}
                              maxLength={2000}
                              className="mt-2 min-h-[104px] resize-y"
                            />
                            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                              <Button type="button" variant="ghost" size="sm" onClick={() => { setAppealActionId(null); setAppealReason('') }}>取消</Button>
                              <Button type="button" tone="brand" shape="soft" size="sm" disabled={submittingAppeal || !appealReason.trim()} onClick={() => void submitAppeal()}>
                                {submittingAppeal ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                                提交申诉
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button type="button" variant="secondary" shape="soft" size="sm" className="mt-4" onClick={() => { setAppealActionId(action.id); setAppealReason('') }}>
                            提交申诉
                          </Button>
                        )
                      ) : null}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </SettingsSubpageShell>
  )
}
