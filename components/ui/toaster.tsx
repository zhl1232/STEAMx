"use client"

import { useEffect } from 'react'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { isCompactFeedbackBlocked, useToast } from "@/hooks/use-toast"

export function Toaster() {
  const { toasts, dismiss } = useToast()
  const compactId = toasts.find((item) => item.open && item.presentation === 'compact')?.id

  useEffect(() => {
    if (!compactId) return
    const check = () => { if (isCompactFeedbackBlocked()) dismiss(compactId) }
    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['role', 'aria-modal'] })
    document.addEventListener('focusin', check)
    document.addEventListener('visibilitychange', check)
    window.visualViewport?.addEventListener('resize', check)
    check()
    return () => {
      observer.disconnect()
      document.removeEventListener('focusin', check)
      document.removeEventListener('visibilitychange', check)
      window.visualViewport?.removeEventListener('resize', check)
    }
  }, [compactId, dismiss])

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, presentation, ...props }) {
        return (
          <Toast key={id} presentation={presentation} {...props}>
            <div className="grid min-w-0 flex-1 gap-0.5 md:gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            {presentation !== 'compact' ? <ToastClose /> : null}
          </Toast>
        )
      })}
      <ToastViewport className={compactId ? 'compact-feedback-viewport' : undefined} />
    </ToastProvider>
  )
}
