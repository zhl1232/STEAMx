'use client'

import type { ReactNode } from 'react'

import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'

interface MobilePageHeaderProps {
  title: ReactNode
  fallbackHref: string
  backLabel?: string
  sticky?: boolean
  className?: string
  contentClassName?: string
  backButtonClassName?: string
  titleClassName?: string
  rightSlot?: ReactNode
}

export function MobilePageHeader({
  title,
  fallbackHref,
  backLabel = '返回上一页',
  sticky = true,
  className,
  contentClassName,
  backButtonClassName,
  titleClassName,
  rightSlot,
}: MobilePageHeaderProps) {
  const router = useRouter()

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }

    router.push(fallbackHref)
  }

  return (
    <div
      className={cn(
        sticky
          ? 'sticky top-[calc(var(--mobile-global-header-height,4rem)+env(safe-area-inset-top))] z-30 border-b border-border/70 bg-background/92 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-md supports-[backdrop-filter]:bg-background/80 md:top-0'
          : 'relative border-b border-border/70 bg-background/92 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-md supports-[backdrop-filter]:bg-background/80',
        className,
      )}
    >
      <div
        className={cn(
          'min-h-12 pl-2.5 pr-4 py-1',
          contentClassName,
        )}
      >
        <div
          className={cn(
            'grid min-h-10 items-center gap-2',
            rightSlot ? 'grid-cols-[auto_minmax(0,1fr)_auto]' : 'grid-cols-[auto_minmax(0,1fr)]',
          )}
        >
          <button
            type="button"
            onClick={handleBack}
            aria-label={backLabel}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              backButtonClassName,
            )}
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="sr-only">{backLabel}</span>
          </button>

          <div className={cn('min-w-0 truncate text-left text-base font-semibold tracking-tight', titleClassName)}>
            {title}
          </div>

          {rightSlot ? (
            <div className="flex h-9 items-center justify-end">
              {rightSlot}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
