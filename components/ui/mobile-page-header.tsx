'use client'

import type { ReactNode } from 'react'

import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'

interface MobilePageHeaderProps {
  title: ReactNode
  fallbackHref: string
  backLabel?: string
  /** 为 true 时顶栏 fixed 吸顶并渲染占位 spacer；为 false 时随文档流（不吸顶） */
  sticky?: boolean
  /** 使用透明页头，去掉背景、模糊、阴影和底部分隔线 */
  borderless?: boolean
  className?: string
  contentClassName?: string
  backButtonClassName?: string
  titleClassName?: string
  rightSlot?: ReactNode
}

const headerSurfaceClass =
  'bg-background/92 backdrop-blur-md supports-backdrop-filter:bg-background/80'
const headerBorderClass = 'border-b border-border/70'
const headerShadowClass = 'shadow-[0_1px_0_rgba(15,23,42,0.04)]'
const headerBorderlessClass = 'bg-transparent shadow-none backdrop-blur-none supports-backdrop-filter:bg-transparent'

export function MobilePageHeader({
  title,
  fallbackHref,
  backLabel = '返回上一页',
  sticky = true,
  borderless = false,
  className,
  contentClassName,
  backButtonClassName,
  titleClassName,
  rightSlot,
}: MobilePageHeaderProps) {
  const router = useRouter()
  const surfaceClass = borderless
    ? headerBorderlessClass
    : cn(headerSurfaceClass, headerBorderClass, headerShadowClass)

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }

    router.push(fallbackHref)
  }

  const bar = (
    <div
      className={cn(
        'flex h-12 items-center gap-2 pl-px pr-4',
        contentClassName,
      )}
    >
      <button
        type="button"
        onClick={handleBack}
        aria-label={backLabel}
        className={cn(
          'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          backButtonClassName,
        )}
      >
        <ChevronLeft className="h-5 w-5" />
        <span className="sr-only">{backLabel}</span>
      </button>

      <div className={cn('min-w-0 flex-1 truncate text-left text-base font-semibold leading-none tracking-tight', titleClassName)}>
        {title}
      </div>

      {rightSlot ? (
        <div className="flex h-9 shrink-0 items-center justify-end">
          {rightSlot}
        </div>
      ) : null}
    </div>
  )

  if (!sticky) {
    return (
      <div className={cn('relative w-full pt-[env(safe-area-inset-top)] md:hidden', surfaceClass, className)}>
        {bar}
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          'fixed inset-x-0 top-0 z-30 w-full pt-[env(safe-area-inset-top)] md:hidden',
          surfaceClass,
          className,
        )}
      >
        {bar}
      </div>
      <div className="mobile-page-header-spacer shrink-0 md:hidden" aria-hidden="true" />
    </>
  )
}
