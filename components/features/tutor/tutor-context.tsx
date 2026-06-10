'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type TutorContextOverride = {
  subtitle?: string
  stageIndex?: number
  /** PBL：当前阶段标题，用于「带我开始这一步」等提示词 */
  stageTitle?: string
  quickPrompts?: string[]
  /** PBL：获取当前阶段产出用于「请导师看看」 */
  getReviewPayload?: () => { text: string; images: string[] } | null
  hideFab?: boolean
}

type TutorContextValue = {
  override: TutorContextOverride
  setOverride: (next: TutorContextOverride) => void
  clearOverride: () => void
  open: boolean
  setOpen: (open: boolean) => void
  openTutor: () => void
  pendingSend: { text: string; images?: string[] } | null
  queueSend: (text: string, images?: string[]) => void
  consumePendingSend: () => { text: string; images?: string[] } | null
}

const TutorContext = createContext<TutorContextValue | null>(null)

// 稳定的空 override 引用：重复 clear 时 state 引用不变，React 会跳过重渲染，避免清空动作本身引发更新循环。
const EMPTY_OVERRIDE: TutorContextOverride = {}

export function TutorProvider({ children }: { children: ReactNode }) {
  const [override, setOverrideState] = useState<TutorContextOverride>(EMPTY_OVERRIDE)
  const [open, setOpen] = useState(false)
  const [pendingSend, setPendingSend] = useState<{ text: string; images?: string[] } | null>(null)

  const setOverride = useCallback((next: TutorContextOverride) => {
    setOverrideState(next)
  }, [])

  const clearOverride = useCallback(() => {
    setOverrideState(EMPTY_OVERRIDE)
  }, [])

  const openTutor = useCallback(() => setOpen(true), [])

  const queueSend = useCallback((text: string, images?: string[]) => {
    setPendingSend({ text, images })
    setOpen(true)
  }, [])

  const consumePendingSend = useCallback(() => {
    const current = pendingSend
    setPendingSend(null)
    return current
  }, [pendingSend])

  const value = useMemo(
    () => ({
      override,
      setOverride,
      clearOverride,
      open,
      setOpen,
      openTutor,
      pendingSend,
      queueSend,
      consumePendingSend,
    }),
    [override, setOverride, clearOverride, open, openTutor, pendingSend, queueSend, consumePendingSend],
  )

  return <TutorContext.Provider value={value}>{children}</TutorContext.Provider>
}

export function useTutorContext() {
  const ctx = useContext(TutorContext)
  if (!ctx) {
    throw new Error('useTutorContext must be used within TutorProvider')
  }
  return ctx
}

export function useOptionalTutorContext() {
  return useContext(TutorContext)
}
