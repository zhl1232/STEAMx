'use client'

import { useEffect } from 'react'

import { AuthFlow } from '@/components/auth/auth-flow'

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  title?: string
  description?: string
}

export function LoginDialog({
  open,
  onOpenChange,
  onSuccess,
  title = '登录以继续',
  description = '登录后即可点赞、评论和分享项目'
}: LoginDialogProps) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="关闭登录层"
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
        onMouseDown={() => onOpenChange(false)}
      />

      <div className="absolute inset-0 md:flex md:items-center md:justify-center md:p-6">
        <div
          role="dialog"
          aria-modal="true"
          className="h-full w-full md:h-auto md:max-w-4xl"
          onClick={(event) => event.stopPropagation()}
        >
          <AuthFlow
            presentation="layer"
            title={title}
            description={description}
            onClose={() => onOpenChange(false)}
            onSuccess={() => {
              onOpenChange(false)
              onSuccess?.()
            }}
          />
        </div>
      </div>
    </div>
  )
}
