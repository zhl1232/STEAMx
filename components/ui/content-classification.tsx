import type { PublicClassification } from '@/lib/content-classification/types'
import { cn } from '@/lib/utils'

type ContentClassificationProps = {
  classification?: PublicClassification | null
  className?: string
  compact?: boolean
}

/**
 * The only public renderer for the three classification axes. It is a static
 * label group rather than a button, so the three meanings stay readable on
 * narrow cards and never fall back to internal star terminology.
 */
export function ContentClassification({
  classification,
  className,
  compact = false,
}: ContentClassificationProps) {
  if (!classification) return null

  const labels = [
    classification.ageLabel,
    classification.difficultyLabel,
    classification.supportLabel,
  ]

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      aria-label={`适龄 ${classification.ageLabel}，难度 ${classification.difficultyLabel}，${classification.supportLabel}`}
    >
      {labels.map((label) => (
        <span
          key={label}
          className={cn(
            'inline-flex items-center rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.72)] font-semibold text-muted-foreground',
            compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
          )}
        >
          {label}
        </span>
      ))}
    </div>
  )
}
