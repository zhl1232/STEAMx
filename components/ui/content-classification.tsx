import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  Compass,
  Flame,
  GraduationCap,
  Sparkles,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react'

import type {
  DifficultyBand,
  PublicClassification,
  SupportLevel,
} from '@/lib/content-classification/types'
import { cn } from '@/lib/utils'

type ContentClassificationProps = {
  classification?: PublicClassification | null
  className?: string
  compact?: boolean
  variant?: 'chips' | 'summary'
  showIcons?: boolean
}

interface BadgeStyle {
  icon: LucideIcon
  className: string
  iconClassName?: string
}

function getAgeBadgeStyle(): BadgeStyle {
  return {
    icon: GraduationCap,
    className:
      'bg-[hsl(var(--brand-blue)/0.08)] text-[hsl(var(--brand-blue))] border-[hsl(var(--brand-blue)/0.18)]',
    iconClassName: 'text-[hsl(var(--brand-blue))]',
  }
}

function getDifficultyBadgeStyle(band: DifficultyBand): BadgeStyle {
  switch (band) {
    case 'beginner':
      return {
        icon: Compass,
        className:
          'bg-[hsl(var(--brand-green)/0.08)] text-[hsl(var(--brand-green))] border-[hsl(var(--brand-green)/0.2)]',
        iconClassName: 'text-[hsl(var(--brand-green))]',
      }
    case 'intermediate':
      return {
        icon: Flame,
        className:
          'bg-[hsl(var(--brand-blue)/0.08)] text-[hsl(var(--brand-blue))] border-[hsl(var(--brand-blue)/0.2)]',
        iconClassName: 'text-[hsl(var(--brand-blue))]',
      }
    case 'challenge':
      return {
        icon: Zap,
        className:
          'bg-[hsl(var(--brand-amber)/0.1)] text-[hsl(var(--brand-amber))] border-[hsl(var(--brand-amber)/0.24)]',
        iconClassName: 'text-[hsl(var(--brand-amber))]',
      }
    default:
      return {
        icon: Sparkles,
        className:
          'bg-[hsl(var(--surface-muted))] text-muted-foreground border-[hsl(var(--surface-border))]',
      }
  }
}

function getSupportBadgeStyle(level: SupportLevel): BadgeStyle {
  switch (level) {
    case 'independent':
      return {
        icon: UserCheck,
        className:
          'bg-[hsl(var(--brand-green)/0.08)] text-[hsl(var(--brand-green))] border-[hsl(var(--brand-green)/0.2)]',
        iconClassName: 'text-[hsl(var(--brand-green))]',
      }
    case 'guided':
      return {
        icon: Users,
        className:
          'bg-[hsl(var(--brand-blue)/0.06)] text-muted-foreground/90 border-[hsl(var(--surface-border)/0.9)] dark:text-muted-foreground',
        iconClassName: 'text-muted-foreground/80',
      }
    case 'adult_required':
      return {
        icon: AlertCircle,
        className:
          'bg-[hsl(var(--brand-amber)/0.1)] text-[hsl(var(--brand-amber))] border-[hsl(var(--brand-amber)/0.24)]',
        iconClassName: 'text-[hsl(var(--brand-amber))]',
      }
    default:
      return {
        icon: Users,
        className:
          'bg-[hsl(var(--surface-muted))] text-muted-foreground border-[hsl(var(--surface-border))]',
      }
  }
}

/**
 * The only public renderer for the three classification axes. It renders semantic
 * micro-badges with unified rounded-xs geometry and subtle tonal visual encoding,
 * never exposing internal star terminology.
 */
export function ContentClassification({
  classification,
  className,
  compact = false,
  variant = 'chips',
  showIcons = true,
}: ContentClassificationProps) {
  if (!classification) return null

  const items = [
    {
      label: classification.ageLabel,
      style: getAgeBadgeStyle(),
    },
    {
      label: classification.difficultyLabel,
      style: getDifficultyBadgeStyle(classification.difficultyBand),
    },
    {
      label: classification.supportLabel,
      style: getSupportBadgeStyle(classification.supportLevel),
    },
  ]

  const ariaLabel = `适龄 ${classification.ageLabel}，难度 ${classification.difficultyLabel}，${classification.supportLabel}`
  const summary = items.map((item) => item.label).join(' · ')

  if (variant === 'summary') {
    return (
      <div
        className={cn(
          'inline-flex min-w-0 max-w-full items-center truncate whitespace-nowrap rounded-xs border border-[hsl(var(--surface-border)/0.75)] bg-[hsl(var(--surface-muted)/0.65)] px-1.5 py-0.5 text-[10px] font-medium leading-4 text-muted-foreground/90',
          className,
        )}
        aria-label={ariaLabel}
        title={summary}
      >
        {summary}
      </div>
    )
  }


  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      aria-label={ariaLabel}
    >
      {items.map(({ label, style }) => {
        const Icon = style.icon
        return (
          <span
            key={label}
            className={cn(
              'inline-flex items-center rounded-xs border font-medium transition-colors',
              style.className,
              compact
                ? 'gap-0.5 px-1.5 py-0.5 text-[10px]'
                : 'gap-1 px-2 py-0.5 text-[11px]',
            )}
          >
            {showIcons ? (
              <Icon
                className={cn(
                  'shrink-0',
                  compact ? 'h-2.5 w-2.5' : 'h-3 w-3',
                  style.iconClassName,
                )}
                aria-hidden
              />
            ) : null}
            <span>{label}</span>
          </span>
        )
      })}
    </div>
  )
}

