'use client'

import { useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { GlobalTutorFab } from '@/components/features/tutor/global-tutor-fab'
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

export function GlobalTutorMount() {
  const pathname = usePathname() ?? '/'
  const tutorCtx = useOptionalTutorContext()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { toast } = useToast()

  const baseContext = useMemo(() => resolveTutorContextFromPath(pathname), [pathname])
  const hideTutorOnMobile = pathname === '/nature/observations'
  const visible = shouldShowGlobalTutor(pathname) && !tutorCtx?.override.hideFab && Boolean(baseContext)
  const stageIndex = tutorCtx?.override.stageIndex ?? baseContext?.stageIndex
  const lessonStepIndex = tutorCtx?.override.lessonStepIndex
  const sessionInput = useMemo<TutorSessionQueryInput | null>(() => {
    if (!visible || !user?.id || !baseContext) return null
    return {
      userId: user.id,
      contextType: baseContext.contextType,
      contextId: baseContext.contextId,
      stageIndex,
      lessonId: baseContext.lessonId,
      surface: baseContext.surface,
    }
  }, [
    visible,
    user?.id,
    baseContext,
    stageIndex,
  ])

  useEffect(() => {
    if (!sessionInput) return
    void queryClient.prefetchQuery({
      queryKey: tutorSessionQueryKey(sessionInput),
      queryFn: () => fetchTutorSession(sessionInput),
      staleTime: TUTOR_SESSION_STALE_MS,
    })
  }, [queryClient, sessionInput])

  if (!visible) return null
  if (!baseContext) return null

  const open = tutorCtx?.open ?? false
  const setOpen = tutorCtx?.setOpen ?? (() => undefined)

  return (
    <GlobalTutorFab
      open={open}
      onToggle={() => setOpen(!open)}
      context={baseContext}
      stageIndex={stageIndex}
      lessonStepIndex={lessonStepIndex}
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
