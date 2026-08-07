'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { useOptionalTutorContext } from '@/components/features/tutor/tutor-context'
import {
  fetchTutorSession,
  TUTOR_SESSION_STALE_MS,
  tutorSessionQueryKey,
  type TutorSessionQueryInput,
} from '@/components/features/tutor/tutor-session'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/context/auth-context'
import { resolveTutorContextFromPath, shouldShowGlobalTutor } from '@/lib/ai/tutor/resolve-context'

type GlobalTutorFabComponent = typeof import('@/components/features/tutor/global-tutor-fab').GlobalTutorFab

let globalTutorFabPromise: Promise<GlobalTutorFabComponent> | null = null

function loadGlobalTutorFab() {
  if (!globalTutorFabPromise) {
    globalTutorFabPromise = import('@/components/features/tutor/global-tutor-fab')
      .then((module) => module.GlobalTutorFab)
      .catch((error) => {
        globalTutorFabPromise = null
        throw error
      })
  }
  return globalTutorFabPromise
}

export function GlobalTutorMount() {
  const pathname = usePathname() ?? '/'
  const tutorCtx = useOptionalTutorContext()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { toast } = useToast()
  const [TutorFab, setTutorFab] = useState<GlobalTutorFabComponent | null>(null)
  const open = tutorCtx?.open ?? false
  const setOpen = tutorCtx?.setOpen ?? (() => undefined)

  const baseContext = useMemo(() => resolveTutorContextFromPath(pathname), [pathname])
  const hideTutorOnMobile = pathname === '/nature/observations'
    || pathname === '/nature/species'
    || pathname.startsWith('/users/')
    || Boolean(tutorCtx?.override.hideFabOnMobile)
  const visible = shouldShowGlobalTutor(pathname) && !tutorCtx?.override.hideFab && Boolean(baseContext)
  const stageIndex = tutorCtx?.override.stageIndex ?? baseContext?.stageIndex
  const lessonStepIndex = tutorCtx?.override.lessonStepIndex
  const lessonStepCount = tutorCtx?.override.lessonStepCount
  const scratchBlockTargetItemIndex = tutorCtx?.override.scratchBlockTargetItemIndex
  const sessionInput = useMemo<TutorSessionQueryInput | null>(() => {
    if (!visible || !user?.id || !baseContext) return null
    return {
      userId: user.id,
      contextType: baseContext.contextType,
      contextId: baseContext.contextId,
      stageIndex,
      lessonId: baseContext.lessonId,
      surface: baseContext.surface,
      playgroundGameKey: baseContext.playgroundGameKey,
    }
  }, [
    visible,
    user?.id,
    baseContext,
    stageIndex,
  ])

  const prepareTutor = useCallback(async () => {
    if (TutorFab) return TutorFab
    const component = await loadGlobalTutorFab()
    setTutorFab(() => component)
    return component
  }, [TutorFab])

  useEffect(() => {
    if (!visible || TutorFab) return

    if (open) {
      void prepareTutor().catch(() => undefined)
      return
    }

    const idleWindow = window as unknown as {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
      cancelIdleCallback?: (handle: number) => void
    }
    let idleId: number | null = null
    let timerId: number | null = null
    const scheduleAfterLoad = () => {
      if (idleWindow.requestIdleCallback) {
        idleId = idleWindow.requestIdleCallback(
          () => void prepareTutor().catch(() => undefined),
          { timeout: 4_000 },
        )
        return
      }
      timerId = window.setTimeout(() => void prepareTutor().catch(() => undefined), 2_000)
    }

    if (document.readyState === 'complete') {
      scheduleAfterLoad()
    } else {
      window.addEventListener('load', scheduleAfterLoad, { once: true })
    }

    return () => {
      window.removeEventListener('load', scheduleAfterLoad)
      if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId)
      if (timerId !== null) window.clearTimeout(timerId)
    }
  }, [open, prepareTutor, TutorFab, visible])

  useEffect(() => {
    if (!sessionInput || !TutorFab) return
    void queryClient.prefetchQuery({
      queryKey: tutorSessionQueryKey(sessionInput),
      queryFn: () => fetchTutorSession(sessionInput),
      staleTime: TUTOR_SESSION_STALE_MS,
    })
  }, [queryClient, sessionInput, TutorFab])

  if (!visible) return null
  if (!baseContext) return null

  if (!TutorFab) {
    const prepareAndOpen = () => {
      setOpen(true)
      void prepareTutor().catch(() => {
        toast({ title: '小迪加载失败，请稍后再试', variant: 'destructive' })
      })
    }

    return (
      <button
        type="button"
        onClick={prepareAndOpen}
        onPointerEnter={() => void prepareTutor().catch(() => undefined)}
        onFocus={() => void prepareTutor().catch(() => undefined)}
        aria-label="打开 AI 导师"
        className={`fixed right-4 z-50 inline-flex h-20 w-20 touch-none select-none items-center justify-center bg-transparent drop-shadow-[0_18px_18px_hsl(var(--brand-blue)/0.28)] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue)/0.45)] focus-visible:ring-offset-2 md:right-6 ${
          hideTutorOnMobile ? 'max-lg:hidden' : ''
        } ${
          baseContext.lessonId != null
            ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))] md:bottom-24'
            : 'bottom-[calc(8.5rem+env(safe-area-inset-bottom))] md:bottom-6'
        }`}
      >
        <span
          aria-hidden
          className="h-[86px] w-[86px] bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/xiaodi-ai/idle.webp)' }}
        />
      </button>
    )
  }

  return (
    <TutorFab
      open={open}
      onToggle={() => setOpen(!open)}
      context={baseContext}
      stageIndex={stageIndex}
      lessonStepIndex={lessonStepIndex}
      lessonStepCount={lessonStepCount}
      scratchBlockTargetItemIndex={scratchBlockTargetItemIndex}
      scratchEditorContext={tutorCtx?.override.scratchEditorContext}
      stageTitle={tutorCtx?.override.stageTitle}
      subtitle={tutorCtx?.override.subtitle}
      quickPrompts={tutorCtx?.override.quickPrompts}
      fabPlacement={baseContext.lessonId != null ? 'compact' : 'default'}
      hideOnMobile={hideTutorOnMobile}
      showReviewAction={Boolean(tutorCtx?.override.getReviewPayload)}
      onReview={() => {
        const payload = tutorCtx?.override.getReviewPayload?.()
        if (payload) {
          tutorCtx?.queueSend(payload.text, payload.images)
        } else {
          toast({ title: '先填写这一步的产出，小迪才能帮你看看哦', variant: 'destructive' })
        }
      }}
    />
  )
}
