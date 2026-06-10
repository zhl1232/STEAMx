"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Save, Search, ShieldCheck, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  getMembershipSummary,
  membershipPeriodLabels,
  type MembershipPeriod,
} from "@/lib/membership"
import { getApiErrorMessage } from "@/lib/utils/http"

type AdminUser = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  role: string
  xp: number
  coins: number
  ai_credit_balance?: number
  created_at: string
  membership_tier: string
  membership_period: string
  membership_started_at: string | null
  membership_expires_at: string | null
}

type CreditDraft = {
  amount: string
  note: string
}

type MembershipDraft = {
  period: MembershipPeriod
  expiresAt: string
}

const editablePeriods: MembershipPeriod[] = ['none', 'monthly', 'yearly', 'lifetime', 'founder']

function formatDateTime(value: string | null) {
  if (!value) return '长期有效'
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
}

function toDateInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function buildDefaultExpiry(period: MembershipPeriod) {
  const next = new Date()
  if (period === 'monthly') {
    next.setMonth(next.getMonth() + 1)
  } else if (period === 'yearly') {
    next.setFullYear(next.getFullYear() + 1)
  } else {
    return ''
  }
  return next.toISOString().slice(0, 10)
}

function buildDraft(user: AdminUser): MembershipDraft {
  const period = editablePeriods.includes(user.membership_period as MembershipPeriod)
    ? (user.membership_period as MembershipPeriod)
    : 'none'
  return {
    period,
    expiresAt: toDateInput(user.membership_expires_at) || buildDefaultExpiry(period),
  }
}

function resolveDisplayName(user: AdminUser) {
  return user.display_name || user.username || `用户 ${user.id.slice(0, 8)}`
}

function periodNeedsExpiry(period: MembershipPeriod) {
  return period === 'monthly' || period === 'yearly'
}

function toExpiryIso(dateValue: string) {
  return new Date(`${dateValue}T23:59:59`).toISOString()
}

export function UserMembershipManagement() {
  const { toast } = useToast()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, MembershipDraft>>({})
  const [loading, setLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [creditDrafts, setCreditDrafts] = useState<Record<string, CreditDraft>>({})
  const [adjustingUserId, setAdjustingUserId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      const response = await fetch(`/api/admin/users${params.size ? `?${params}` : ''}`)
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, '加载用户失败'))
      }
      const payload = await response.json() as { users?: AdminUser[] }
      const nextUsers = payload.users || []
      setUsers(nextUsers)
      setDrafts(Object.fromEntries(nextUsers.map((user) => [user.id, buildDraft(user)])))
    } catch (error) {
      toast({
        title: '加载用户失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [query, toast])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const activeCount = useMemo(
    () => users.filter((user) => getMembershipSummary(user).isActive).length,
    [users],
  )
  const founderCount = useMemo(
    () => users.filter((user) => getMembershipSummary(user).tier === 'founder').length,
    [users],
  )

  const updateDraft = (userId: string, draft: MembershipDraft) => {
    setDrafts((current) => ({ ...current, [userId]: draft }))
  }

  const updateCreditDraft = (userId: string, patch: Partial<CreditDraft>) => {
    setCreditDrafts((current) => {
      const prev = current[userId] ?? { amount: '', note: '' }
      return {
        ...current,
        [userId]: {
          amount: patch.amount ?? prev.amount,
          note: patch.note ?? prev.note,
        },
      }
    })
  }

  const adjustCredits = async (user: AdminUser) => {
    const draft = creditDrafts[user.id] ?? { amount: '', note: '' }
    const amount = Number.parseInt(draft.amount, 10)
    if (!Number.isFinite(amount) || amount === 0) {
      toast({ title: '请输入非零整数调整量', variant: 'destructive' })
      return
    }

    setAdjustingUserId(user.id)
    try {
      const response = await fetch(`/api/admin/users/${user.id}/credits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note: draft.note || null }),
      })
      if (!response.ok) throw new Error(await getApiErrorMessage(response, '调整失败'))
      const payload = await response.json() as { balance?: number }
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id ? { ...item, ai_credit_balance: payload.balance ?? item.ai_credit_balance } : item,
        ),
      )
      updateCreditDraft(user.id, { amount: '', note: '' })
      toast({ title: 'AI 代币已调整' })
    } catch (error) {
      toast({
        title: '调整失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setAdjustingUserId(null)
    }
  }

  const saveMembership = async (user: AdminUser) => {
    const draft = drafts[user.id] || buildDraft(user)
    if (periodNeedsExpiry(draft.period) && !draft.expiresAt) {
      toast({ title: '请选择会员到期日', variant: 'destructive' })
      return
    }

    setSavingUserId(user.id)
    try {
      const response = await fetch(`/api/admin/users/${user.id}/membership`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: draft.period,
          expires_at: periodNeedsExpiry(draft.period) ? toExpiryIso(draft.expiresAt) : null,
        }),
      })
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, '保存失败'))
      }

      const payload = await response.json() as { user?: Partial<AdminUser> & { id: string } }
      if (payload.user) {
        setUsers((current) =>
          current.map((item) => (item.id === user.id ? { ...item, ...payload.user } : item)),
        )
        setDrafts((current) => ({
          ...current,
          [user.id]: buildDraft({ ...user, ...payload.user }),
        }))
      }

      toast({ title: '会员状态已更新' })
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setSavingUserId(null)
    }
  }

  return (
    <Card className="surface-subtle shadow-none">
      <CardHeader>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <CardTitle>用户管理</CardTitle>
            <CardDescription>手动开通月度、年度、终身和创始会员</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1 rounded-full bg-background/78 px-3 py-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              {activeCount} 位有效会员
            </Badge>
            <Badge variant="secondary" className="gap-1 rounded-full bg-background/78 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--brand-amber))]" />
              {founderCount} 位创始会员
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索昵称或用户名"
              className="pl-9"
            />
          </div>
          <Button type="button" variant="outline" onClick={() => void loadUsers()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            刷新
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border border-border/70 bg-background/74">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[190px]">用户</TableHead>
                <TableHead>角色</TableHead>
                <TableHead className="min-w-[130px]">当前会员</TableHead>
                <TableHead className="min-w-[160px]">到期时间</TableHead>
                <TableHead className="min-w-[170px]">设置周期</TableHead>
                <TableHead className="min-w-[160px]">新的到期日</TableHead>
                <TableHead className="min-w-[90px]">AI 代币</TableHead>
                <TableHead className="min-w-[200px]">调整代币</TableHead>
                <TableHead className="w-[108px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
                    正在加载用户...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    当前筛选下暂无用户
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const summary = getMembershipSummary(user)
                  const draft = drafts[user.id] || buildDraft(user)
                  const isSaving = savingUserId === user.id
                  const creditDraft = creditDrafts[user.id] ?? { amount: '', note: '' }
                  const isAdjusting = adjustingUserId === user.id

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{resolveDisplayName(user)}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{user.id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={summary.isActive ? 'default' : 'secondary'}
                          className="rounded-full"
                        >
                          {summary.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {summary.isActive ? formatDateTime(user.membership_expires_at) : '无有效会员'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={draft.period}
                          onValueChange={(value) => {
                            const period = value as MembershipPeriod
                            updateDraft(user.id, {
                              period,
                              expiresAt: periodNeedsExpiry(period)
                                ? draft.expiresAt || buildDefaultExpiry(period)
                                : '',
                            })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {editablePeriods.map((period) => (
                              <SelectItem key={period} value={period}>
                                {membershipPeriodLabels[period]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={draft.expiresAt}
                          onChange={(event) => updateDraft(user.id, { ...draft, expiresAt: event.target.value })}
                          disabled={!periodNeedsExpiry(draft.period)}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">{user.ai_credit_balance ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <Input
                            type="number"
                            placeholder="±数量"
                            value={creditDraft.amount}
                            onChange={(event) => updateCreditDraft(user.id, { amount: event.target.value })}
                            className="h-8"
                          />
                          <Input
                            placeholder="原因（可选）"
                            value={creditDraft.note}
                            onChange={(event) => updateCreditDraft(user.id, { note: event.target.value })}
                            className="h-8"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void adjustCredits(user)}
                            disabled={isAdjusting}
                          >
                            {isAdjusting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '调整'}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void saveMembership(user)}
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                          保存
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
