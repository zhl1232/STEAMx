import type { LucideIcon } from 'lucide-react'
import { Box, ListChecks, Tag } from 'lucide-react'

import { categoryToneClasses, type CategoryTone } from '@/components/ui/tone-badge'
import { CATEGORY_META } from '@/lib/config/categories'
import { cn } from '@/lib/utils'
import { ContentClassification } from '@/components/ui/content-classification'
import type { PublicClassification } from '@/lib/content-classification/types'

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
      'inline-flex min-h-8 min-w-0 flex-row items-center justify-center gap-1 rounded-xs border border-transparent px-2 py-1',
        className,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', iconClassName)} aria-hidden />
      <span className="truncate text-[11px] font-semibold leading-tight">{label}</span>
    </div>
  )
}

export interface MobileProjectMetaChipsProps {
  category?: string | null
  categoryTone: CategoryTone
  topicLabel?: string | null
  viewingGuide?: boolean; practicePending?: boolean
  stepsCount: number
  materialsCount: number
  classification?: PublicClassification | null
}

export function MobileProjectMetaChips({
  category,
  categoryTone,
  topicLabel,
  viewingGuide = false,
  stepsCount,
  materialsCount,
  classification,
}: MobileProjectMetaChipsProps) {
  const categoryMeta = CATEGORY_META[category || ''] ?? CATEGORY_META['科学']
  const CategoryIcon = categoryMeta.icon
  const tone = categoryMeta.tone ?? categoryTone

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <MobileMetaChip
          icon={CategoryIcon}
          label={category || '探索'}
            className={cn(categoryToneClasses[tone].bg, categoryToneClasses[tone].text)}
          iconClassName={categoryToneClasses[tone].text}
        />

        {topicLabel ? (
          <MobileMetaChip
            icon={Tag}
            label={topicLabel}
            className="border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--brand-blue)/0.08)] text-[hsl(var(--brand-blue))]"
            iconClassName="text-[hsl(var(--brand-blue))]"
          />
        ) : null}

        {stepsCount > 0 ? (
          <MobileMetaChip
            icon={ListChecks}
            label={viewingGuide ? `${stepsCount} 项观看要点` : `${stepsCount} 步`}
            className="border-[hsl(var(--surface-border)/0.8)] bg-[hsl(var(--surface-muted))] text-muted-foreground"
          />
        ) : null}
        {!viewingGuide && materialsCount > 0 ? (
          <MobileMetaChip
            icon={Box}
            label={`${materialsCount} 项材料`}
            className="border-[hsl(var(--surface-border)/0.8)] bg-[hsl(var(--surface-muted))] text-muted-foreground"
          />
        ) : null}
      </div>

      {classification ? (
        <div className="pt-0.5">
          <ContentClassification classification={classification} compact />
        </div>
      ) : null}
    </div>
  )
}
