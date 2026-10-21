'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { LoginDialog } from '@/components/layout/login-dialog'
import { useAuth } from './auth-context'
import { markVisitPrompt, isVisitPromptRoute } from '@/lib/auth/visit-prompt'
import {
  dismissLoginNudgeForToday,
  isLoginNudgeBlockedPath,
  isLoginNudgeDismissedToday,
  LOGIN_NUDGE_DELAY_MS,
  LOGIN_NUDGE_MIN_PAGE_VIEWS,
  recordLoginNudgePageView,
  trackLoginPrompt,
  type LoginPromptSource,
} from '@/lib/auth/login-nudge'
import { toast } from '@/hooks/use-toast'

type Continuation = (user: User) => void | Promise<unknown>
type PromptOptions = { title?: string; description?: string; source?: LoginPromptSource }
interface LoginPromptContextType {
  promptLogin: (callback?: Continuation, options?: PromptOptions) => void
}
type Request = PromptOptions & {
  id: number
  href: string
  callback?: Continuation
  onboarding: boolean
  success?: { isNewUser?: boolean }
}
const LoginPromptContext = createContext<LoginPromptContextType | undefined>(undefined)
const currentHref = () => `${window.location.pathname}${window.location.search}${window.location.hash}`

export function LoginPromptProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [request, setRequest] = useState<Request | null>(null)
  const active = useRef<Request | null>(null)
  const sequence = useRef(0)

  const cancel = useCallback(() => {
    active.current = null
    setRequest(null)
  }, [])

  const open = useCallback((callback?: Continuation, options?: PromptOptions, onboarding = false) => {
    markVisitPrompt()
    const next = { ...options, callback, onboarding, id: ++sequence.current, href: currentHref() }
    trackLoginPrompt(options?.source ?? 'action', 'show')
    active.current = next
    setRequest(next)
  }, [])
  const promptLogin = useCallback((callback?: Continuation, options?: PromptOptions) => {
    open(callback, options)
  }, [open])

  // 不再首次访问就自动弹登录：看到第 2 个页面或停留约 30 秒后轻弹一次，关掉后当天不再弹。
  const nudgedRef = useRef(false)
  useEffect(() => {
    if (active.current && active.current.href !== currentHref()) cancel()
    if (loading || !isVisitPromptRoute(pathname)) return
    if (user) { markVisitPrompt(); return }
    const views = recordLoginNudgePageView(pathname)
    if (nudgedRef.current || isLoginNudgeDismissedToday() || isLoginNudgeBlockedPath(pathname)) return
    const fire = () => {
      if (nudgedRef.current || active.current || isLoginNudgeDismissedToday()) return
      if (isLoginNudgeBlockedPath(window.location.pathname)) return
      nudgedRef.current = true
      open(undefined, { title: '登录或注册', description: '登录后保存孩子的作品和进度', source: 'delayed' }, true)
    }
    if (views >= LOGIN_NUDGE_MIN_PAGE_VIEWS) { fire(); return }
    const timer = window.setTimeout(fire, LOGIN_NUDGE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [pathname, loading, user, open, cancel])

  useEffect(() => {
    const onNavigation = () => {
      if (active.current && active.current.href !== currentHref()) cancel()
    }
    window.addEventListener('popstate', onNavigation)
    window.addEventListener('hashchange', onNavigation)
    return () => {
      window.removeEventListener('popstate', onNavigation)
      window.removeEventListener('hashchange', onNavigation)
    }
  }, [cancel])

  useEffect(() => {
    if (!request?.success || loading || !user || active.current?.id !== request.id) return
    const pending = active.current
    cancel() // Consume before invoking so duplicate success cannot replay it.
    if (pending.href !== currentHref()) return
    if (pending.callback) {
      Promise.resolve().then(() => pending.callback!(user)).catch(() => {
        toast({ title: '已登录，请重试刚才的操作', variant: 'destructive' })
      })
    } else if (pending.onboarding && pending.success?.isNewUser) {
      router.push('/start')
    }
  }, [request, loading, user, router, cancel])

  return (
    <LoginPromptContext.Provider value={{ promptLogin }}>
      {children}
      {request ? <LoginDialog
        key={request.id}
        open
        onOpenChange={value => {
          if (value || active.current?.id !== request.id) return
          if (request.source === 'delayed') dismissLoginNudgeForToday()
          cancel()
        }}
        onSuccess={result => {
          if (active.current?.id !== request.id || active.current.success) return
          trackLoginPrompt(request.source ?? 'action', result?.isNewUser ? 'signup' : 'login')
          const next = { ...active.current, success: result ?? {} }
          active.current = next
          setRequest(next)
        }}
        title={request.title ?? '登录以继续'}
        description={request.description ?? '登录后可以保存进度'}
      /> : null}
    </LoginPromptContext.Provider>
  )
}

export function useLoginPrompt() {
  const context = useContext(LoginPromptContext)
  if (!context) throw new Error('useLoginPrompt must be used within a LoginPromptProvider')
  return context
}
