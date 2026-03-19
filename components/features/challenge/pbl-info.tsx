"use client"

import type { Challenge } from '@/lib/mappers/types'
import { Lightbulb, HelpCircle, Target, Lock, ExternalLink } from 'lucide-react'

interface PblInfoProps {
  challenge: Challenge
}

export function PblInfo({ challenge }: PblInfoProps) {
  const hasContent = challenge.scenario || challenge.drivingQuestion || challenge.expectedOutcome

  if (!hasContent) return null

  return (
    <div className="space-y-6">
      {challenge.scenario && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">情境</h3>
              <p className="text-amber-800 dark:text-amber-300 leading-relaxed">{challenge.scenario}</p>
            </div>
          </div>
        </div>
      )}

      {challenge.drivingQuestion && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">驱动问题</h3>
              <p className="text-xl font-medium text-blue-800 dark:text-blue-300 leading-relaxed">{challenge.drivingQuestion}</p>
            </div>
          </div>
        </div>
      )}

      {challenge.expectedOutcome && (
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold mb-2">预期目标</h3>
              <p className="text-muted-foreground leading-relaxed">{challenge.expectedOutcome}</p>
            </div>
          </div>
        </div>
      )}

      {challenge.constraints && challenge.constraints.length > 0 && (
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold mb-3">约束条件</h3>
              <ul className="space-y-2">
                {challenge.constraints.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {challenge.resources && challenge.resources.length > 0 && (
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-semibold mb-3">参考资源</h3>
          <div className="space-y-2">
            {challenge.resources.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline">
                <ExternalLink className="h-4 w-4 shrink-0" />
                {r.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
