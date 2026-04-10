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
          'relative min-h-12 px-4 py-1',
          contentClassName,
        )}
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label={backLabel}
          className={cn(
            "absolute -left-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            backButtonClassName,
          )}
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="sr-only">{backLabel}</span>
        </button>

        <div className={cn('flex min-h-10 items-center', rightSlot ? 'pr-11' : '')}>
          <div className={cn('min-w-0 flex-1 truncate pl-2 text-left text-base font-semibold tracking-tight', titleClassName)}>
            {title}
          </div>
        </div>

        {rightSlot ? (
          <div className="absolute right-4 top-1/2 flex h-9 -translate-y-1/2 items-center justify-end">
            {rightSlot}
          </div>
        ) : null}
      </div>
    </div>
  )
}
