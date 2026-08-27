'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { BRAND_NAME } from '@/lib/brand'
import {
  detectInAppBrowser,
  detectIosSafari,
  isPwaInstallCooldownActive,
  isStandaloneDisplay,
  writePwaInstallDismissedAt,
} from '@/lib/pwa/install'
import { cn } from '@/lib/utils'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type PromptMode = 'android' | 'ios' | 'wechat' | null

export function PwaInstallPrompt() {
  const [mode, setMode] = useState<PromptMode>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  const dismiss = useCallback(() => {
    writePwaInstallDismissedAt()
    setVisible(false)
    setMode(null)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandaloneDisplay()) return
    if (isPwaInstallCooldownActive()) return

    const userAgent = window.navigator.userAgent

    if (detectInAppBrowser(userAgent)) {
      setMode('wechat')
      setVisible(true)
      return
    }

    if (
      detectIosSafari(userAgent, {
        platform: window.navigator.platform,
        maxTouchPoints: window.navigator.maxTouchPoints,
      })
    ) {
      setMode('ios')
      setVisible(true)
      return
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      if (isPwaInstallCooldownActive()) return
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setMode('android')
      setVisible(true)
    }

    const onAppInstalled = () => {
      writePwaInstallDismissedAt()
      setVisible(false)
      setMode(null)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const title = useMemo(() => {
    switch (mode) {
      case 'android':
        return `安装 ${BRAND_NAME} 到桌面`
      case 'ios':
        return `把 ${BRAND_NAME} 添加到主屏幕`
      case 'wechat':
        return '请在系统浏览器中打开'
      default:
        return ''
    }
  }, [mode])

  const description = useMemo(() => {
    switch (mode) {
      case 'android':
        return '像 App 一样从桌面一键打开课程、自然观察和小迪。'
      case 'ios':
        return (
          <>
            点底部分享
            <Share className="mx-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
            ，再选择「添加到主屏幕」。
          </>
        )
      case 'wechat':
        return '微信 / QQ 内置浏览器无法安装。点右上角「···」→「在浏览器中打开」，再用系统浏览器安装。'
      default:
        return null
    }
  }, [mode])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    try {
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
    } catch {
      // user cancelled or browser rejected
    } finally {
      setDeferredPrompt(null)
      setVisible(false)
      setMode(null)
    }
  }, [deferredPrompt])

  if (!visible || !mode) return null

  return (
    <div
      role="dialog"
      aria-label={title}
      className={cn(
        'pointer-events-auto fixed inset-x-3 z-90 rounded-md border border-[hsl(var(--surface-border)/0.9)] bg-[hsl(var(--surface-raised)/0.96)] p-3 shadow-[0_18px_42px_-28px_hsl(var(--surface-shadow)/0.55)] backdrop-blur-xl supports-backdrop-filter:bg-[hsl(var(--surface-raised)/0.88)]',
        'bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-6 md:right-6 md:w-[360px]',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[hsl(var(--brand-blue)/0.14)] text-[hsl(var(--brand-blue))]">
          <Download className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          {mode === 'android' ? (
            <div className="mt-3 flex items-center gap-2">
              <Button type="button" size="sm" tone="brand" onClick={() => void handleInstall()}>
                安装到桌面
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
                稍后再说
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
                知道了
              </Button>
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="关闭安装提示"
          className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
