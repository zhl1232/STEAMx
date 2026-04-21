"use client"

import Link from 'next/link'
import {
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Lock,
  Target,
  type LucideIcon,
} from 'lucide-react'

import type { Challenge } from '@/lib/mappers/types'
import { cn } from '@/lib/utils'

interface PblInfoProps {
  challenge: Challenge
}

type InfoCard = {
  key: string
  title: string
  content: string
  icon: LucideIcon
  tone: string
  iconTone: string
  variant?: 'hero' | 'default'
}

export function PblInfo({ challenge }: PblInfoProps) {
  const hasContent =
    challenge.scenario ||
    challenge.drivingQuestion ||
    challenge.expectedOutcome ||
    (challenge.constraints && challenge.constraints.length > 0)
  const resources = challenge.resources || []
  const internalResourceTypes = new Set(['template', 'guide', 'entry', 'internal'])
  const hasResourceContent = resources.length > 0

  if (!hasContent && !hasResourceContent) return null

  const getResourceTypeLabel = (type: string) => {
    switch (type) {
      case 'template':
        return '开始'
      case 'guide':
      case 'entry':
      case 'internal':
        return '站内'
      case 'article':
        return '文章'
      case 'video':
        return '视频'
      case 'pdf':
        return 'PDF'
      default:
        return '资料'
    }
  }

  const infoCards: InfoCard[] = [
    challenge.drivingQuestion
      ? {
          key: 'driving-question',
          title: '驱动问题',
          content: challenge.drivingQuestion,
          icon: HelpCircle,
          tone:
            'border-blue-200/80 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(219,234,254,0.84),rgba(224,231,255,0.78))] dark:border-blue-900/70 dark:bg-[linear-gradient(135deg,rgba(23,37,84,0.56),rgba(30,58,138,0.36),rgba(49,46,129,0.28))]',
          iconTone: 'border-blue-200/80 bg-white/80 text-blue-700 dark:border-blue-900/80 dark:bg-slate-950/30 dark:text-blue-300',
          variant: 'hero',
        }
      : null,
    challenge.scenario
      ? {
          key: 'scenario',
          title: '情境',
          content: challenge.scenario,
          icon: Lightbulb,
          tone:
            'border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(254,243,199,0.84),rgba(255,237,213,0.76))] dark:border-amber-900/70 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.22),rgba(146,64,14,0.18),rgba(120,53,15,0.14))]',
          iconTone: 'border-amber-200/80 bg-white/80 text-amber-700 dark:border-amber-900/80 dark:bg-slate-950/30 dark:text-amber-300',
        }
      : null,
    challenge.expectedOutcome
      ? {
          key: 'expected-outcome',
          title: '预期目标',
          content: challenge.expectedOutcome,
          icon: Target,
          tone:
            'border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(209,250,229,0.84),rgba(220,252,231,0.76))] dark:border-emerald-900/70 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.26),rgba(6,95,70,0.18),rgba(4,120,87,0.14))]',
          iconTone: 'border-emerald-200/80 bg-white/80 text-emerald-700 dark:border-emerald-900/80 dark:bg-slate-950/30 dark:text-emerald-300',
        }
      : null,
  ].filter(Boolean) as InfoCard[]

  return (
    <div className="space-y-5">
      {hasContent && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">任务说明</h2>

          {infoCards.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {infoCards.map((card) => {
                const Icon = card.icon
                return (
                  <article
                    key={card.key}
                    className={cn(
                      'rounded-[22px] border p-4 shadow-[0_18px_48px_-38px_rgba(15,23,42,0.18)] sm:p-5',
                      card.tone,
                      card.variant === 'hero' ? 'md:col-span-2 md:p-6' : '',
                    )}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] shadow-sm',
                          card.iconTone,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground/70">
                          {card.title}
                        </div>
                        <p
                          className={cn(
                            'mt-2.5 leading-7 text-foreground/88',
                            card.variant === 'hero' ? 'text-[1.05rem] font-medium tracking-tight sm:text-[1.12rem]' : 'text-sm',
                          )}
                        >
                          {card.content}
                        </p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {challenge.constraints && challenge.constraints.length > 0 && (
            <article className="rounded-[22px] border border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,241,242,0.96),rgba(255,228,230,0.82),rgba(255,228,230,0.72))] p-4 shadow-[0_18px_48px_-38px_rgba(15,23,42,0.18)] dark:border-rose-900/70 dark:bg-[linear-gradient(135deg,rgba(76,5,25,0.26),rgba(136,19,55,0.16),rgba(76,5,25,0.14))] sm:p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] bg-white/80 text-rose-700 shadow-sm dark:bg-slate-950/30 dark:text-rose-300">
                  <Lock className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground/70">
                    约束条件
                  </div>
                  <div className="mt-3.5 grid gap-2 md:grid-cols-2">
                    {challenge.constraints.map((constraint, index) => (
                      <div
                        key={`${constraint}-${index}`}
                        className="rounded-[16px] bg-white/58 px-3.5 py-2.5 text-sm leading-6 text-foreground/80 dark:bg-slate-950/22"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                          <span>{constraint}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          )}
        </section>
      )}

      {hasResourceContent && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">相关资料</h2>
            <span className="text-xs text-muted-foreground">
              {resources.length} 项
            </span>
          </div>

          <div className="grid gap-1.5 rounded-[20px] bg-background/36 p-1.5 dark:bg-slate-950/18">
            {resources.map((resource, index) => {
              const isInternalResource =
                resource.url.startsWith('/') || internalResourceTypes.has(resource.type)

              const content = (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                          isInternalResource
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {getResourceTypeLabel(resource.type)}
                      </span>
                      <div className="font-medium text-foreground transition-colors group-hover:text-primary">
                        {resource.title}
                      </div>
                    </div>
                    {!isInternalResource && (
                      null
                    )}
                  </div>
                  <div className="mt-0.5 shrink-0">
                    <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                </div>
              )

              if (isInternalResource) {
                return (
                  <Link
                    key={`${resource.url}-${index}`}
                    href={resource.url}
                    className="group rounded-[16px] bg-background/78 px-3.5 py-3 transition-all hover:bg-background dark:bg-slate-950/34 dark:hover:bg-slate-950/46"
                  >
                    {content}
                  </Link>
                )
              }

              return (
                <a
                  key={`${resource.url}-${index}`}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-[16px] bg-background/78 px-3.5 py-3 transition-all hover:bg-background dark:bg-slate-950/34 dark:hover:bg-slate-950/46"
                >
                  {content}
                </a>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
