"use client"

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import type { Challenge, ChallengeResource, ChallengeResourceType } from '@/lib/mappers/types'

interface PblInfoProps {
  challenge: Challenge
}

const RESOURCE_GROUPS: Array<{
  type: ChallengeResourceType
  label: string
  hint: string
}> = [
  { type: 'project', label: '参考项目', hint: '给灵感，不要求照做' },
  { type: 'skill', label: '前置技能', hint: '卡住时回来补一个具体能力' },
  { type: 'reference', label: '资料卡', hint: '过程中随查随用' },
]

function ResourceItem({ resource }: { resource: ChallengeResource }) {
  const isExternal = !resource.url.startsWith('/')

  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
          {resource.title}
        </p>
        {resource.description ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{resource.description}</p>
        ) : null}
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
    </>
  )

  if (isExternal) {
    return (
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3 py-2.5"
      >
        {content}
      </a>
    )
  }

  return (
    <Link href={resource.url} className="group flex items-center gap-3 py-2.5">
      {content}
    </Link>
  )
}

export function PblInfo({ challenge }: PblInfoProps) {
  const hasContent =
    challenge.scenario ||
    challenge.drivingQuestion ||
    challenge.expectedOutcome ||
    (challenge.constraints && challenge.constraints.length > 0)
  const resources = challenge.resources || []
  const hasResourceContent = resources.length > 0

  if (!hasContent && !hasResourceContent) return null

  return (
    <div className="space-y-8">
      {hasContent && (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">任务说明</h2>

          {challenge.drivingQuestion && (
            <div className="mt-5">
              <p className="text-[13px] font-semibold text-[hsl(var(--brand-blue))]">驱动问题</p>
              <p className="mt-2 max-w-136 text-lg font-semibold leading-8 tracking-tight text-foreground sm:text-[1.35rem] sm:leading-9">
                {challenge.drivingQuestion}
              </p>
            </div>
          )}

          {(challenge.scenario || challenge.expectedOutcome) && (
            <div className="mt-6 grid gap-6 border-t border-[hsl(var(--surface-border)/0.55)] pt-5 md:grid-cols-2 md:gap-10">
              {challenge.scenario && (
                <div>
                  <h3 className="text-sm font-semibold">情境</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{challenge.scenario}</p>
                </div>
              )}
              {challenge.expectedOutcome && (
                <div>
                  <h3 className="text-sm font-semibold">预期目标</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{challenge.expectedOutcome}</p>
                </div>
              )}
            </div>
          )}

          {challenge.constraints && challenge.constraints.length > 0 && (
            <div className="mt-6 border-t border-[hsl(var(--surface-border)/0.55)] pt-5">
              <h3 className="text-sm font-semibold">约束条件</h3>
              <ol className="mt-3 grid gap-x-10 gap-y-2.5 md:grid-cols-2">
                {challenge.constraints.map((constraint, index) => (
                  <li key={`${constraint}-${index}`} className="flex gap-3 text-sm leading-6 text-foreground/85">
                    <span className="w-4 shrink-0 pt-px text-[12px] font-semibold tabular-nums text-muted-foreground/60">
                      {index + 1}
                    </span>
                    <span>{constraint}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      {hasResourceContent && (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">相关资料</h2>
          <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">
            这些是支撑，不是路线图——先尝试自己的方案，卡住时再回来查。
          </p>

          <div className="mt-4 grid gap-5 md:grid-cols-3 md:gap-8">
            {RESOURCE_GROUPS.map((group) => {
              const groupResources = resources.filter((resource) => resource.type === group.type)
              if (groupResources.length === 0) return null

              return (
                <div key={group.type} className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-semibold">{group.label}</h3>
                    <span className="truncate text-[11px] text-muted-foreground/70">{group.hint}</span>
                  </div>
                  <div className="mt-1 divide-y divide-[hsl(var(--surface-border)/0.5)]">
                    {groupResources.map((resource, index) => (
                      <ResourceItem key={`${resource.url}-${index}`} resource={resource} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
