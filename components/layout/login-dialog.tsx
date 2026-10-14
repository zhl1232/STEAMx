'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useRef } from 'react'

import { AuthFlow } from '@/components/auth/auth-flow'

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (options?: { isNewUser?: boolean }) => void
  title?: string
  description?: string
}

export function LoginDialog({
  open,
  onOpenChange,
  onSuccess,
  title,
  description
}: LoginDialogProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-90 bg-slate-950/30 backdrop-blur-xs" />
        <DialogPrimitive.Content
          aria-labelledby="auth-layer-title"
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-90 w-full outline-hidden md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2"
          onOpenAutoFocus={() => {
            returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocusRef.current?.focus({ preventScroll: true })
          }}
        >
          <DialogPrimitive.Title asChild>
            <span className="sr-only">{title ?? '登录'}</span>
          </DialogPrimitive.Title>
          <AuthFlow
            presentation="layer"
            title={title}
            description={description}
            onClose={() => onOpenChange(false)}
            onSuccess={(options) => {
              if (onSuccess) {
                onSuccess(options)
              } else {
                onOpenChange(false)
              }
            }}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
