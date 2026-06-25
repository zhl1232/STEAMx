'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

import { buildTutorToolHandlers, type TutorToolHandlerContext } from '@/components/features/tutor/tool-handler-registry'
import type { TutorSceneCapability } from '@/lib/ai/tutor/scene-capabilities'
import type { TutorToolCall, TutorToolName } from '@/lib/ai/tutor/tool-calls'
import type { ScratchEditorContext } from '@/lib/courses/scratch-messages'

export type TutorContextOverride = {
  subtitle?: string
  stageIndex?: number
  /** PBL：当前阶段标题，用于「带我开始这一步」等提示词 */
  stageTitle?: string
  /** 技能课程：当前课时步骤，用于小迪聚焦当前步骤 */
  lessonStepIndex?: number
  /** 技能课程：当前课时总步骤数，用于 Scratch 多动作提示结束后再进入下一步骤 */
  lessonStepCount?: number
  /** 技能课程：当前 Scratch 步骤内正在提示第几个积木动作 */
  scratchBlockTargetItemIndex?: number
  /** 技能课程：Scratch 编辑器当前选中角色、角色列表与基础状态 */
  scratchEditorContext?: ScratchEditorContext | null
  sceneCapabilities?: TutorSceneCapability[]
  quickPrompts?: string[]
  /** PBL：获取当前阶段产出用于「请导师看看」 */
  getReviewPayload?: () => { text: string; images: string[] } | null
  hideFab?: boolean
}

export type TutorToolHandler = (toolCall: TutorToolCall) => void | Promise<void>

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
  registerToolHandler: (name: TutorToolName, handler: TutorToolHandler) => () => void
  registerToolHandlers: (context: TutorToolHandlerContext) => () => void
  dispatchToolCall: (toolCall: TutorToolCall) => Promise<boolean>
}

const TutorContext = createContext<TutorContextValue | null>(null)

// 稳定的空 override 引用：重复 clear 时 state 引用不变，React 会跳过重渲染，避免清空动作本身引发更新循环。
const EMPTY_OVERRIDE: TutorContextOverride = {}

export function TutorProvider({ children }: { children: ReactNode }) {
  const [override, setOverrideState] = useState<TutorContextOverride>(EMPTY_OVERRIDE)
  const [open, setOpen] = useState(false)
  const [pendingSend, setPendingSend] = useState<{ text: string; images?: string[] } | null>(null)
  const toolHandlersRef = useRef<Partial<Record<TutorToolName, TutorToolHandler>>>({})

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

  const registerToolHandler = useCallback((name: TutorToolName, handler: TutorToolHandler) => {
    toolHandlersRef.current = { ...toolHandlersRef.current, [name]: handler }
    return () => {
      if (toolHandlersRef.current[name] !== handler) return
      const next = { ...toolHandlersRef.current }
      delete next[name]
      toolHandlersRef.current = next
    }
  }, [])

  const registerToolHandlers = useCallback((context: TutorToolHandlerContext) => {
    const handlers = buildTutorToolHandlers(context)
    const cleanups = Object.entries(handlers).map(([name, handler]) =>
      registerToolHandler(name as TutorToolName, handler),
    )
    return () => {
      for (const cleanup of cleanups.reverse()) cleanup()
    }
  }, [registerToolHandler])

  const dispatchToolCall = useCallback(async (toolCall: TutorToolCall) => {
    const handler = toolHandlersRef.current[toolCall.name]
    if (!handler) return false
    await handler(toolCall)
    return true
  }, [])

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
      registerToolHandler,
      registerToolHandlers,
      dispatchToolCall,
    }),
    [
      override,
      setOverride,
      clearOverride,
      open,
      openTutor,
      pendingSend,
      queueSend,
      consumePendingSend,
      registerToolHandler,
      registerToolHandlers,
      dispatchToolCall,
    ],
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
