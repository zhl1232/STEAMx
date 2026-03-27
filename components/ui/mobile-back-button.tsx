'use client'

import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'

interface MobileBackButtonProps {
  fallbackHref: string
  label?: string
  className?: string
}

export function MobileBackButton({
  fallbackHref,
  label = '返回上一页',
  className,
}: MobileBackButtonProps) {
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
        'sticky top-[calc(env(safe-area-inset-top)+0.75rem)] z-20 w-fit md:static',
        className,
      )}
    >
      <button
        type="button"
        onClick={handleBack}
        aria-label={label}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border/70 bg-background/95 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 supports-[backdrop-filter]:bg-background/80"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </button>
    </div>
  )
}
