"use client"

import Link from "next/link"
import { Award, CheckCircle2, Sparkles, Stars } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { appendNatureFrom } from "@/lib/utils/nature-navigation"

interface ObservationSubmitSuccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  observationId: number | null
  imageUrl?: string | null
  speciesName?: string | null
  xpAwarded: number
  progressLabel: string
  progressValue: number
}

export function ObservationSubmitSuccessDialog({
  open,
  onOpenChange,
  observationId,
  imageUrl,
  speciesName,
  xpAwarded,
  progressLabel,
  progressValue,
}: ObservationSubmitSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto border-0 bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.28),transparent_30%),linear-gradient(180deg,rgba(7,10,14,0.98),rgba(14,16,20,1))] p-0 text-white shadow-none sm:left-[50%] sm:top-[50%] sm:h-auto sm:w-[min(32rem,calc(100vw-2rem))] sm:max-w-none sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-hidden sm:rounded-[32px] sm:border sm:border-white/10 sm:shadow-[0_28px_90px_-44px_rgba(15,23,42,0.75)]">
        <DialogHeader className="sr-only">
          <DialogTitle>观察记录已收录</DialogTitle>
          <DialogDescription>本次观察已收录，并展示成长反馈。</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[5/4]">
            {imageUrl ? (
              <OptimizedImage
                src={imageUrl}
                alt={speciesName || "观察记录头图"}
                fill
                variant="cover"
                className="object-cover"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/18 to-black/5" />
            <div className="absolute inset-x-0 top-0 p-6">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs font-medium tracking-[0.16em] text-white/88 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                OBSERVATION COMPLETE
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
              <div className="space-y-5">
                <div className="inline-flex rotate-[-9deg] items-center gap-2 rounded-2xl border border-emerald-200/30 bg-emerald-400/18 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-100 shadow-[0_14px_32px_-24px_rgba(16,185,129,0.9)] backdrop-blur">
                  <CheckCircle2 className="h-4 w-4" />
                  已收录
                </div>

                <div>
                  <p className="text-sm text-white/72">本次记录</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                    {speciesName || "新的自然观察"}
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-white/76">
                    这条记录已经进入你的观察档案，可以继续积累同一地点或同一物种的连续样本。
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[var(--radius-lg)] border border-white/10 bg-white/8 p-4 backdrop-blur">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/58">
                      <Award className="h-3.5 w-3.5" />
                      探索经验
                    </div>
                    <div className="mt-3 text-3xl font-semibold text-emerald-200">+{xpAwarded} XP</div>
                    <p className="mt-2 text-xs leading-5 text-white/62">
                      本次提交的经验奖励已经记入成长系统。
                    </p>
                  </div>
                  <div className="rounded-[var(--radius-lg)] border border-white/10 bg-white/8 p-4 backdrop-blur">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/58">
                      <Stars className="h-3.5 w-3.5" />
                      徽章进度
                    </div>
                    <div className="mt-3 text-sm font-medium text-white">{progressLabel}</div>
                    <Progress value={progressValue} className="mt-3 h-2 bg-white/10 [&>div]:bg-emerald-300" />
                    <p className="mt-2 text-xs leading-5 text-white/62">
                      再多记录几次，你的观察家系列会继续升级。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/10 bg-black/26 p-4 sm:grid-cols-2 sm:p-5">
            <Link
              href={
                observationId
                  ? appendNatureFrom(`/nature/observations/${observationId}`, "/nature/submit")
                  : "/nature/observations"
              }
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-white/90"
            >
              查看这条记录
            </Link>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/14 bg-white/6 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              继续记录下一条
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
