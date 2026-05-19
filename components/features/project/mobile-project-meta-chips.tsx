import type { LucideIcon } from 'lucide-react'
import { Box, ListChecks, Tag, UsersRound } from 'lucide-react'

import { categoryToneClasses, type CategoryTone } from '@/components/ui/tone-badge'
import { CATEGORY_META } from '@/lib/config/categories'
import { formatCount } from '@/lib/project/format-count'
import { cn } from '@/lib/utils'

function getDifficultyLabel(stars?: number) {
  const value = Math.max(1, Math.min(6, stars ?? 1))
  if (value === 1) return '入门'
  if (value === 2) return '简单'
  if (value === 3) return '中等'
  if (value === 4) return '进阶'
  if (value === 5) return '挑战'
  return '传说'
}

function MobileMetaChip({
  icon: Icon,
  label,
  className,
  iconClassName,
}: {
  icon: LucideIcon
  label: string
  className?: string
  iconClassName?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-8 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[8px] px-1.5 py-1.5',
        className,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', iconClassName)} aria-hidden />
      <span className="w-full truncate text-center text-[10px] font-semibold leading-tight">{label}</span>
    </div>
  )
}

function MobileDifficultyChip({ stars }: { stars: number }) {
  const validStars = Math.max(1, Math.min(6, stars))
  const label = getDifficultyLabel(validStars)

  if (validStars === 6) {
    return (
      <div className="flex min-h-8 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[8px] bg-amber-50 px-1.5 py-1.5 dark:bg-amber-950/40">
        <span className="text-[10px] leading-none" aria-hidden>
          💫
        </span>
        <span className="w-full truncate text-center text-[10px] font-semibold leading-tight text-amber-900 dark:text-amber-100">
          {label}
        </span>
      </div>
    )
  }

  const filledCount = Math.min(5, validStars)

  return (
    <div className="flex min-h-8 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[8px] bg-amber-50 px-1.5 py-1.5 dark:bg-amber-950/40">
      <span className="text-[10px] leading-none text-amber-500" aria-hidden>
        {'★'.repeat(filledCount)}
      </span>
      <span className="w-full truncate text-center text-[10px] font-semibold leading-tight text-amber-900 dark:text-amber-100">
        {label}
      </span>
    </div>
  )
}

export interface MobileProjectMetaChipsProps {
  category?: string | null
  categoryTone: CategoryTone
  topicLabel?: string | null
  stepsCount: number
  materialsCount: number
  completionCount: number
  difficultyStars?: number
}

export function MobileProjectMetaChips({
  category,
  categoryTone,
  topicLabel,
  stepsCount,
  materialsCount,
  completionCount,
  difficultyStars = 1,
}: MobileProjectMetaChipsProps) {
  const categoryMeta = CATEGORY_META[category || ''] ?? CATEGORY_META['科学']
  const CategoryIcon = categoryMeta.icon
  const tone = categoryMeta.tone ?? categoryTone

  let scaleIcon: LucideIcon = ListChecks
  let scaleLabel: string | null = null
  let scaleClassName = 'bg-[hsl(var(--surface-muted))] text-muted-foreground'

  if (stepsCount > 0) {
    scaleLabel = `${stepsCount} 步`
  } else if (materialsCount > 0) {
    scaleIcon = Box
    scaleLabel = `${materialsCount} 项材料`
  } else if (completionCount > 0) {
    scaleIcon = UsersRound
    scaleLabel = `${formatCount(completionCount)} 次探索`
  }

  const chipCount = 2 + (topicLabel ? 1 : 0) + (scaleLabel ? 1 : 0)

  return (
    <div
      className={cn(
        'grid gap-2',
        chipCount >= 4 ? 'grid-cols-4' : chipCount === 3 ? 'grid-cols-3' : 'grid-cols-2',
      )}
    >
      <MobileMetaChip
        icon={CategoryIcon}
        label={category || '探索'}
        className={categoryToneClasses[tone].bg}
        iconClassName={categoryToneClasses[tone].text}
      />

      {topicLabel ? (
        <MobileMetaChip
          icon={Tag}
          label={topicLabel}
          className="bg-[hsl(var(--brand-blue)/0.08)] text-[hsl(var(--brand-blue))]"
          iconClassName="text-[hsl(var(--brand-blue))]"
        />
      ) : null}

      {scaleLabel ? (
        <MobileMetaChip
          icon={scaleIcon}
          label={scaleLabel}
          className={scaleClassName}
        />
      ) : null}

      <MobileDifficultyChip stars={difficultyStars} />
    </div>
  )
}
