"use client"

import { Eye, EyeOff, Lock, Loader2, ShieldCheck } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { cn } from "@/lib/utils"
import type { JourneyRecord } from "@/lib/journeys/types"

function recordStatus(record: JourneyRecord) {
  if (record.visibility === "private") return { label: "仅自己可见", tone: "muted" as const }
  if (record.status === "pending") return { label: "公开审核中", tone: "warning" as const }
  if (record.status === "rejected") return { label: "待修改", tone: "danger" as const }
  return { label: "已公开", tone: "success" as const }
}

function formatRecordDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "刚刚"
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function JourneyRecordTimeline({
  records,
  onVisibilityChange,
}: {
  records: JourneyRecord[]
  onVisibilityChange: (record: JourneyRecord, visibility: "private" | "public") => Promise<void>
}) {
  const [workingId, setWorkingId] = useState<number | null>(null)
  const chronologicalRecords = [...records].sort((first, second) => {
    const firstTime = new Date(first.created_at).getTime()
    const secondTime = new Date(second.created_at).getTime()
    if (Number.isNaN(firstTime) || Number.isNaN(secondTime)) return first.id - second.id
    return firstTime - secondTime
  })

  if (records.length === 0) return null

  return (
    <section className="rounded-lg border border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--status-info-surface)/0.18)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-kicker">我的项目过程</p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">一步一步留下来</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">默认只有你能看到；想分享哪一步，再单独公开。</p>
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[hsl(var(--brand-blue)/0.12)] text-[hsl(var(--brand-blue))]">
          <ShieldCheck className="h-4 w-4" />
        </div>
      </div>

      <ol className="mt-5 space-y-0">
        {chronologicalRecords.map((record, index) => {
          const status = recordStatus(record)
          const nextVisibility = record.visibility === "public" ? "private" : "public"
          const isWorking = workingId === record.id
          const progressNumber = chronologicalRecords
            .slice(0, index + 1)
            .filter((item) => item.record_kind === "progress").length
          return (
            <li key={record.id} className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
              {index < records.length - 1 ? <span className="absolute bottom-0 left-[11px] top-6 w-px bg-[hsl(var(--brand-blue)/0.2)]" /> : null}
              <span className={cn(
                "relative z-10 mt-1 grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold",
                record.record_kind === "final"
                  ? "bg-[hsl(var(--brand-amber)/0.18)] text-[hsl(var(--brand-amber))]"
                  : "bg-[hsl(var(--brand-blue)/0.14)] text-[hsl(var(--brand-blue))]",
              )}>
                {record.record_kind === "final" ? "作" : progressNumber}
              </span>
              <article className="min-w-0 rounded-md border border-border/65 bg-background/75 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{record.title || (record.record_kind === "final" ? "最终作品" : "探索记录")}</span>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    status.tone === "muted" && "bg-muted text-muted-foreground",
                    status.tone === "warning" && "bg-[hsl(var(--status-warning-surface))] text-[hsl(var(--status-warning))]",
                    status.tone === "danger" && "bg-[hsl(var(--status-danger-surface))] text-[hsl(var(--status-danger))]",
                    status.tone === "success" && "bg-[hsl(var(--status-success-surface))] text-[hsl(var(--status-success))]",
                  )}>
                    {status.label}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{formatRecordDate(record.created_at)}</span>
                </div>

                {record.notes ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/80">{record.notes}</p> : null}

                {record.images.length > 0 ? (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {record.images.map((image, imageIndex) => (
                      <div key={`${record.id}-${image}`} className="relative aspect-square overflow-hidden rounded-sm bg-muted">
                        <OptimizedImage src={image} alt={`${record.title || "记录"}图片 ${imageIndex + 1}`} fill variant="thumbnail" className="object-cover" />
                      </div>
                    ))}
                  </div>
                ) : null}

                {record.rejection_reason ? (
                  <p className="mt-3 rounded-sm bg-[hsl(var(--status-danger-surface)/0.7)] px-2.5 py-2 text-xs leading-5 text-[hsl(var(--status-danger))]">
                    审核意见：{record.rejection_reason}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {record.visibility === "public" ? <Eye className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {record.visibility === "public" ? "公开动作会重新审核" : "这条记录只保存在你的项目里"}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11 rounded-full px-3 text-xs"
                    aria-label={record.visibility === "public" ? "将这条记录转为私密" : "公开这条记录"}
                    disabled={isWorking}
                    onClick={async () => {
                      setWorkingId(record.id)
                      try {
                        await onVisibilityChange(record, nextVisibility)
                      } finally {
                        setWorkingId(null)
                      }
                    }}
                  >
                    {isWorking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : record.visibility === "public" ? <EyeOff className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                    {record.visibility === "public" ? "转为私密" : "公开这一步"}
                  </Button>
                </div>
              </article>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
