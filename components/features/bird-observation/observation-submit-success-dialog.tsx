"use client"

import Link from "next/link"
import { CheckCircle2, Clock3, Sparkles } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { appendNatureFrom } from "@/lib/utils/nature-navigation"

interface ObservationSubmitSuccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  observationId: number | null
  imageUrl?: string | null
  speciesName?: string | null
  expectedXp: number
  count?: number
}

export function ObservationSubmitSuccessDialog({
  open,
  onOpenChange,
  observationId,
  imageUrl,
  speciesName,
  expectedXp,
  count = 1,
}: ObservationSubmitSuccessDialogProps) {
  const multiple = count > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-2rem)] max-w-md gap-0 overflow-hidden rounded-sm border border-[hsl(var(--surface-border)/0.86)] bg-background p-0 text-foreground shadow-[0_28px_80px_-48px_hsl(var(--surface-shadow)/0.55)] sm:max-w-lg">
        <DialogHeader className="border-b border-[hsl(var(--surface-border)/0.72)] bg-[hsl(var(--surface-muted)/0.48)] px-5 pb-4 pt-5 text-left">
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-[hsl(var(--primary)/0.28)] nature-media-placeholder px-3 py-1 text-xs font-semibold text-[hsl(var(--primary))]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            已提交
          </div>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {multiple ? `已提交 ${count} 条观察` : "观察已提交"}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">
            {multiple
              ? `这 ${count} 条观察已进入审核队列，审核通过后会出现在公开观察流。每条通过可获得经验。`
              : "本次观察已进入审核队列，审核通过后会出现在公开观察流。"}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(100dvh-14rem)] overflow-y-auto px-5 py-5">
          <div className="relative aspect-16/10 overflow-hidden rounded-sm border border-[hsl(var(--surface-border)/0.72)] bg-[hsl(var(--surface-muted)/0.56)]">
            {imageUrl ? (
              <OptimizedImage
                src={imageUrl}
                alt={speciesName || "观察照片"}
                fill
                variant="cover"
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-[hsl(var(--primary))]">
                <Sparkles className="h-10 w-10" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent p-4 text-white">
              <p className="text-xs text-white/80">{multiple ? `共 ${count} 条观察` : "本次观察"}</p>
              <h2 className="mt-1 line-clamp-1 text-lg font-semibold">
                {speciesName || "新的自然观察"}
              </h2>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-sm border border-[hsl(var(--surface-border)/0.72)] bg-[hsl(var(--surface-muted)/0.44)] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                审核状态
              </div>
              <div className="mt-3 text-2xl font-semibold text-foreground">待审核</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                管理员按张通过后，其他人才能在自然观察流里看到。
              </p>
            </div>
            <div className="rounded-sm border border-[hsl(var(--primary)/0.24)] bg-[hsl(var(--status-info-surface)/0.72)] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--primary))]">
                <Sparkles className="h-3.5 w-3.5" />
                奖励发放
              </div>
              <div className="mt-3 text-2xl font-semibold text-[hsl(var(--primary))]">+{expectedXp} XP</div>
              <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                {multiple
                  ? "每条观察审核通过后发放经验，徽章会自动同步。"
                  : "经验和观察徽章会在审核通过时自动同步。"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-t border-[hsl(var(--surface-border)/0.72)] bg-[hsl(var(--surface-muted)/0.34)] p-4 sm:grid-cols-2">
          <Link
            href={
              observationId
                ? appendNatureFrom(`/nature/observations/${observationId}`, "/nature/submit")
                : "/nature/observations"
            }
            className="inline-flex h-12 items-center justify-center rounded-full bg-[hsl(var(--primary))] px-5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)/0.9)]"
          >
            {multiple ? "查看第一条观察" : "查看这条观察"}
          </Link>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-12 items-center justify-center rounded-full border border-[hsl(var(--surface-border))] bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-[hsl(var(--surface-muted))]"
          >
            继续记录
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
