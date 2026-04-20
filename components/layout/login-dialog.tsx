'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

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

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="关闭登录层"
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      <div className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-center md:items-center md:p-6">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full md:max-w-md"
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
    </div>,
    document.body
  )
}
