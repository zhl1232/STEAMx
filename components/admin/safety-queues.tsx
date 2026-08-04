"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Clock3, Loader2, ShieldAlert, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

type ModerationCase = {
  id: number
  content_type: string
  content_id: number
  status: string
  risk_level: string
  category: string | null
  reason: string | null
  snapshot_text: string | null
  created_at: string
  author?: { display_name: string | null; avatar_url: string | null } | null
}

type Appeal = {
  id: number
  action_id: number
  reason: string
  status: string
  created_at: string
  appellant?: { display_name: string | null; avatar_url: string | null } | null
  action?: {
    action_type: string
    reason: string
    status: string
    ends_at: string | null
  } | null
}

const ACTION_LABELS: Record<string, string> = {
  approve: "通过内容",
  reject: "拒绝内容",
  hide: "下架内容",
  warning: "发出警告",
  restrict_24h: "限制互动 24 小时",
  restrict_7d: "限制互动 7 天",
  restrict_30d: "限制互动 30 天",
  ban: "永久封禁",
}

const CONTENT_LABELS: Record<string, string> = {
  project: "项目",
  comment: "评论",
  completion_comment: "完成评论",
  observation_comment: "观察评论",
  completion: "作品",
  challenge_submission: "挑战作品",
  observation: "观察记录",
  message: "私信",
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  warning: "社区安全提醒",
  interaction_restriction: "互动限制",
  account_suspension: "账号暂时停用",
  account_ban: "账号永久停用",
}

function formatDate(value: string | null | undefined) {
  if (!value) return "时间未知"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN")
}

function riskClass(risk: string) {
  if (risk === "high") return "status-danger-surface text-[hsl(var(--status-danger))]"
  if (risk === "low") return "status-success-surface text-[hsl(var(--status-success))]"
  return "status-warning-surface text-[hsl(var(--status-warning))]"
}

export function SafetyQueues() {
  const { toast } = useToast()
  const [cases, setCases] = useState<ModerationCase[]>([])
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [loading, setLoading] = useState(true)
  const [caseAction, setCaseAction] = useState<Record<number, string>>({})
  const [caseNote, setCaseNote] = useState<Record<number, string>>({})
  const [appealNote, setAppealNote] = useState<Record<number, string>>({})
  const [workingKey, setWorkingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [casesResponse, appealsResponse] = await Promise.all([
        fetch("/api/admin/moderation/cases?status=pending"),
        fetch("/api/admin/safety/appeals?status=pending"),
      ])
      if (!casesResponse.ok || !appealsResponse.ok) throw new Error("加载安全队列失败")
      const [casesPayload, appealsPayload] = await Promise.all([
        casesResponse.json() as Promise<{ cases?: ModerationCase[] }>,
        appealsResponse.json() as Promise<{ appeals?: Appeal[] }>,
      ])
      setCases(casesPayload.cases ?? [])
      setAppeals(appealsPayload.appeals ?? [])
    } catch (error) {
      toast({
        title: "加载失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const reviewCase = async (item: ModerationCase) => {
    const action = caseAction[item.id] || "approve"
    const key = `case:${item.id}`
    setWorkingKey(key)
    try {
      const response = await fetch("/api/admin/moderation/cases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: item.id, action, note: caseNote[item.id]?.trim() || undefined }),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || "处理审核案件失败")
      toast({ title: "审核案件已处理" })
      await load()
    } catch (error) {
      toast({ title: "处理失败", description: error instanceof Error ? error.message : "请稍后重试", variant: "destructive" })
    } finally {
      setWorkingKey(null)
    }
  }

  const reviewAppeal = async (appeal: Appeal, status: "approved" | "rejected") => {
    const key = `appeal:${appeal.id}`
    setWorkingKey(key)
    try {
      const response = await fetch(`/api/admin/safety/appeals/${appeal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewer_note: appealNote[appeal.id]?.trim() || undefined }),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || "处理申诉失败")
      toast({ title: status === "approved" ? "申诉已通过" : "申诉已驳回" })
      await load()
    } catch (error) {
      toast({ title: "处理失败", description: error instanceof Error ? error.message : "请稍后重试", variant: "destructive" })
    } finally {
      setWorkingKey(null)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="surface-subtle shadow-none">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" />自动审核案件</CardTitle>
              <CardDescription>审核服务异常、联系方式风险和自动隐藏内容会进入这里。</CardDescription>
            </div>
            <Badge variant="secondary">{cases.length} 待处理</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : cases.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无待审核案件</p>
          ) : cases.map((item) => {
            const action = caseAction[item.id] || "approve"
            const key = `case:${item.id}`
            return (
              <div key={item.id} className="rounded-md border border-border/70 bg-background/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{CONTENT_LABELS[item.content_type] || item.content_type} #{item.content_id}</span>
                  <Badge variant="secondary" className={riskClass(item.risk_level)}>{item.risk_level === "high" ? "高风险" : item.risk_level === "low" ? "低风险" : "中风险"}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.reason || item.category || "需要人工确认"}</p>
                {item.snapshot_text ? <p className="mt-2 line-clamp-3 whitespace-pre-wrap rounded-sm bg-muted/50 p-2 text-sm">{item.snapshot_text}</p> : null}
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <Select value={action} onValueChange={(value) => setCaseAction((current) => ({ ...current, [item.id]: value }))}>
                    <SelectTrigger className="rounded-md"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(ACTION_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Textarea value={caseNote[item.id] || ""} onChange={(event) => setCaseNote((current) => ({ ...current, [item.id]: event.target.value.slice(0, 1000) }))} placeholder="审核备注（选填）" rows={1} className="resize-none" />
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={() => void reviewCase(item)} disabled={workingKey === key}>
                    {workingKey === key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    处理案件
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="surface-subtle shadow-none">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Clock3 className="h-4 w-4" />申诉队列</CardTitle>
              <CardDescription>用户可以针对安全提醒、互动限制和账号处罚提交一次申诉。</CardDescription>
            </div>
            <Badge variant="secondary">{appeals.length} 待处理</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : appeals.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无待处理申诉</p>
          ) : appeals.map((appeal) => {
            const key = `appeal:${appeal.id}`
            return (
              <div key={appeal.id} className="rounded-md border border-border/70 bg-background/70 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{appeal.appellant?.display_name || "未知用户"}</span>
                  <Badge variant="outline">{ACTION_TYPE_LABELS[appeal.action?.action_type || ""] || "安全处罚"}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(appeal.created_at)}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">原处罚：{appeal.action?.reason || "未填写原因"}</p>
                <p className="mt-2 whitespace-pre-wrap rounded-sm bg-muted/50 p-2 text-sm">{appeal.reason}</p>
                <Textarea value={appealNote[appeal.id] || ""} onChange={(event) => setAppealNote((current) => ({ ...current, [appeal.id]: event.target.value.slice(0, 1000) }))} placeholder="审核备注（选填）" rows={2} className="mt-3 resize-none" />
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => void reviewAppeal(appeal, "rejected")} disabled={workingKey === key}><XCircle className="mr-2 h-4 w-4" />驳回</Button>
                  <Button size="sm" onClick={() => void reviewAppeal(appeal, "approved")} disabled={workingKey === key}>{workingKey === key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}通过</Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
