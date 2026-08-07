'use client'

import { Ban, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useBlock } from '@/hooks/use-block'
import { cn } from '@/lib/utils'

export function BlockButton({
  targetUserId,
  compact = false,
  className,
}: {
  targetUserId: string
  compact?: boolean
  className?: string
}) {
  const { blocked, blockedByMe, isLoading, isPending, toggleBlock } = useBlock(targetUserId)

  return (
    <Button
      type="button"
      variant={blockedByMe ? 'secondary' : 'outline'}
      size={compact ? 'icon' : 'default'}
      className={cn(compact ? 'h-9 w-9' : 'gap-2', className)}
      title={blockedByMe ? '取消屏蔽' : blocked ? '对方已屏蔽你' : '屏蔽用户'}
      aria-label={blockedByMe ? '取消屏蔽' : blocked ? '对方已屏蔽你' : '屏蔽用户'}
      disabled={isLoading || isPending || (blocked && !blockedByMe)}
      onClick={toggleBlock}
    >
      {blockedByMe ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
      {!compact ? (blockedByMe ? '取消屏蔽' : blocked ? '对方已屏蔽你' : '屏蔽用户') : null}
    </Button>
  )
}
