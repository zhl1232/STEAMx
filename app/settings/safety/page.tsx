'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Ban, CheckCircle2, Clock3, Loader2, ShieldAlert, UserRound } from 'lucide-react'

import { SettingsSubpageShell } from '@/app/settings/_components/settings-subpage-shell'
import { Button } from '@/components/ui/button'
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

const STATUS_LABELS: Record<string, string> = {
  pending: '处理中',
  resolved: '已处理',
  dismissed: '已驳回',
  approved: '申诉通过',
  rejected: '申诉驳回',
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
  const [appealActionId, setAppealActionId] = useState<number | null>(null)
  const [appealReason, setAppealReason] = useState('')
  const [submittingAppeal, setSubmittingAppeal] = useState(false)
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null)

  const loadSafety = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/safety')
      if (!response.ok) throw new Error('加载安全中心失败')
      setData(await response.json() as SafetyData)
    } catch (error) {
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
      description="查看账号安全状态、举报处理、屏蔽关系和处罚申诉。"
    >
      {loading || !data ? (
        <div className="flex min-h-56 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="surface-subtle flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              {data.profile.safety_status === 'active' ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">
                {data.profile.safety_status === 'active' ? '账号状态正常' : '账号存在安全限制'}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {data.profile.safety_restriction_reason || '你可以继续浏览公开内容，并管理自己的安全设置。'}
              </p>
              {data.profile.safety_restricted_until ? (
                <p className="mt-2 text-xs text-muted-foreground">预计结束：{formatDate(data.profile.safety_restricted_until)}</p>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">已屏蔽用户</h2>
            </div>
            {data.blocks.length === 0 ? (
              <p className="surface-subtle px-4 py-5 text-sm text-muted-foreground">暂时没有屏蔽用户。</p>
            ) : (
              <div className="space-y-2">
                {data.blocks.map((block) => (
                  <div key={block.blocked_user_id} className="surface-subtle flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-mono">{block.blocked_user_id}</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
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

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">我的举报</h2>
            </div>
            {data.reports.length === 0 ? (
              <p className="surface-subtle px-4 py-5 text-sm text-muted-foreground">还没有提交过举报。</p>
            ) : (
              <div className="space-y-2">
                {data.reports.map((report) => (
                  <div key={report.id} className="surface-subtle space-y-1 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span>举报 {report.content_type} #{report.content_id}</span>
                      <span className="text-xs text-muted-foreground">{STATUS_LABELS[report.status] || report.status}</span>
                    </div>
                    {report.reviewer_note ? <p className="text-xs leading-5 text-muted-foreground">处理说明：{report.reviewer_note}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">安全处罚与申诉</h2>
            </div>
            {data.actions.length === 0 ? (
              <p className="surface-subtle px-4 py-5 text-sm text-muted-foreground">没有处罚记录。</p>
            ) : (
              <div className="space-y-3">
                {data.actions.map((action) => {
                  const hasPendingAppeal = data.appeals.some((appeal) => appeal.action_id === action.id && appeal.status === 'pending')
                  return (
                    <div key={action.id} className="surface-subtle space-y-3 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{ACTION_LABELS[action.action_type] || action.action_type}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.reason}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{STATUS_LABELS[action.status] || action.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">开始：{formatDate(action.starts_at)} · 结束：{formatDate(action.ends_at)}</p>
                      {action.status === 'active' && !hasPendingAppeal ? (
                        appealActionId === action.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={appealReason}
                              onChange={(event) => setAppealReason(event.target.value.slice(0, 2000))}
                              placeholder="请说明你认为需要重新审核的原因"
                              rows={3}
                            />
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="ghost" size="sm" onClick={() => setAppealActionId(null)}>取消</Button>
                              <Button type="button" size="sm" disabled={submittingAppeal || !appealReason.trim()} onClick={() => void submitAppeal()}>
                                {submittingAppeal ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                                提交申诉
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button type="button" variant="outline" size="sm" onClick={() => setAppealActionId(action.id)}>提交申诉</Button>
                        )
                      ) : null}
                    </div>
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
