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
}

export function ObservationSubmitSuccessDialog({
  open,
  onOpenChange,
  observationId,
  imageUrl,
  speciesName,
  expectedXp,
}: ObservationSubmitSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-2rem)] max-w-md gap-0 overflow-hidden rounded-[var(--radius-sm)] border border-[hsl(var(--surface-border)/0.86)] bg-background p-0 text-foreground shadow-[0_28px_80px_-48px_hsl(var(--surface-shadow)/0.55)] sm:max-w-lg">
        <DialogHeader className="border-b border-[hsl(var(--surface-border)/0.72)] bg-[hsl(var(--surface-muted)/0.48)] px-5 pb-4 pt-5 text-left">
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-[hsl(var(--nature-accent)/0.28)] bg-[hsl(var(--nature-accent-soft))] px-3 py-1 text-xs font-semibold text-[hsl(var(--nature-accent))]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            已提交
          </div>
          <DialogTitle className="text-xl font-semibold tracking-tight">观察记录已提交</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">
            本次观察已进入审核队列，审核通过后会出现在公开观察流。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(100dvh-14rem)] overflow-y-auto px-5 py-5">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-sm)] border border-[hsl(var(--surface-border)/0.72)] bg-[hsl(var(--surface-muted)/0.56)]">
            {imageUrl ? (
              <OptimizedImage
                src={imageUrl}
                alt={speciesName || "观察记录头图"}
                fill
                variant="cover"
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-[hsl(var(--nature-accent))]">
                <Sparkles className="h-10 w-10" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-white">
              <p className="text-xs text-white/80">本次记录</p>
              <h2 className="mt-1 line-clamp-1 text-lg font-semibold">
                {speciesName || "新的自然观察"}
              </h2>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--radius-sm)] border border-[hsl(var(--surface-border)/0.72)] bg-[hsl(var(--surface-muted)/0.44)] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                审核状态
              </div>
              <div className="mt-3 text-2xl font-semibold text-foreground">待审核</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                管理员通过后，其他人才能在自然观察流里看到。
              </p>
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[hsl(var(--nature-accent)/0.24)] bg-[hsl(var(--nature-accent-soft)/0.72)] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--nature-accent))]">
                <Sparkles className="h-3.5 w-3.5" />
                奖励发放
              </div>
              <div className="mt-3 text-2xl font-semibold text-[hsl(var(--nature-accent))]">+{expectedXp} XP</div>
              <p className="mt-2 text-xs leading-5 text-[hsl(var(--nature-muted))]">
                经验和观察徽章会在审核通过时自动同步。
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
            className="inline-flex h-12 items-center justify-center rounded-full bg-[hsl(var(--nature-accent))] px-5 text-sm font-semibold text-[hsl(var(--nature-accent-foreground))] transition-colors hover:bg-[hsl(var(--nature-accent)/0.9)]"
          >
            查看这条记录
          </Link>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-12 items-center justify-center rounded-full border border-[hsl(var(--surface-border))] bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-[hsl(var(--surface-muted))]"
          >
            继续记录下一条
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
