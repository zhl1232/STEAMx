"use client"

import { Lightbulb } from 'lucide-react'

import type { ChallengeStage } from '@/lib/mappers/types'
import { cn } from '@/lib/utils'

interface StageGuideProps {
  stages: ChallengeStage[]
}

export function StageGuide({ stages }: StageGuideProps) {
  if (!stages || stages.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold tracking-tight">阶段引导</h3>
        <span className="text-xs text-muted-foreground">
          {stages.length} 步
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {stages.map((stage, i) => (
          <div key={i} className="rounded-[18px] bg-background/68 px-3.5 py-3 shadow-[0_18px_48px_-44px_rgba(15,23,42,0.12)]">
            <div className="flex gap-3.5">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] text-[13px] font-semibold',
                  i === 0
                    ? 'bg-primary/10 text-primary'
                    : 'bg-background/82 text-foreground',
                )}
              >
                {i + 1}
              </div>

              <div className="min-w-0">
                <h4 className="text-sm font-semibold">{stage.title}</h4>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{stage.description}</p>
                {stage.hint && (
                  <div className="mt-2.5 inline-flex items-start gap-1.5 rounded-full bg-primary/8 px-2.5 py-1 text-[11px] text-primary">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{stage.hint}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
