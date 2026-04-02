"use client"

import type { ChallengeStage } from '@/lib/mappers/types'
import { cn } from '@/lib/utils'

interface StageGuideProps {
  stages: ChallengeStage[]
}

export function StageGuide({ stages }: StageGuideProps) {
  if (!stages || stages.length === 0) return null

  return (
    <div className="surface-subtle p-6">
      <h3 className="font-semibold mb-4">阶段引导</h3>
      <div className="relative">
        {stages.map((stage, i) => (
          <div key={i} className="flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                'bg-primary/10 text-primary border-2 border-primary/20'
              )}>
                {i + 1}
              </div>
              {i < stages.length - 1 && (
                <div className="w-0.5 flex-1 bg-border mt-1" />
              )}
            </div>
            <div className="pt-1 pb-2">
              <h4 className="font-medium">{stage.title}</h4>
              <p className="text-sm text-muted-foreground mt-1">{stage.description}</p>
              {stage.hint && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 bg-blue-50 dark:bg-blue-950/20 rounded px-2 py-1 inline-block">
                  💡 {stage.hint}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
