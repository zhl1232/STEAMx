'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'

import { GlobalTutorFab } from '@/components/features/tutor/global-tutor-fab'
import { useOptionalTutorContext } from '@/components/features/tutor/tutor-context'
import { useToast } from '@/hooks/use-toast'
import { resolveTutorContextFromPath, shouldShowGlobalTutor } from '@/lib/ai/tutor/resolve-context'

export function GlobalTutorMount() {
  const pathname = usePathname() ?? '/'
  const tutorCtx = useOptionalTutorContext()
  const { toast } = useToast()

  const baseContext = useMemo(() => resolveTutorContextFromPath(pathname), [pathname])

  if (!shouldShowGlobalTutor(pathname)) return null
  if (tutorCtx?.override.hideFab) return null
  if (!baseContext) return null

  const stageIndex = tutorCtx?.override.stageIndex ?? baseContext.stageIndex
  const open = tutorCtx?.open ?? false
  const setOpen = tutorCtx?.setOpen ?? (() => undefined)

  return (
    <GlobalTutorFab
      open={open}
      onToggle={() => setOpen(!open)}
      context={baseContext}
      stageIndex={stageIndex}
      stageTitle={tutorCtx?.override.stageTitle}
      subtitle={tutorCtx?.override.subtitle}
      quickPrompts={tutorCtx?.override.quickPrompts}
      fabPlacement={baseContext.lessonId != null ? 'compact' : 'default'}
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
