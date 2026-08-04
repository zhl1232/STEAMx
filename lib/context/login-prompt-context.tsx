'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { LoginDialog } from '@/components/layout/login-dialog'
import { InteractionConfirmationDialog } from '@/components/layout/interaction-confirmation-dialog'
import { useAuth } from '@/lib/context/auth-context'
import { logger } from '@/lib/logger'

type AgeConfirmationAction = () => Promise<unknown>

interface PendingAgeConfirmation {
  action: AgeConfirmationAction
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

interface LoginPromptContextType {
  promptLogin: (callback?: () => void, options?: {
    title?: string
    description?: string
  }) => void
  runAfterAgeConfirmation: <T>(action: AgeConfirmationAction, options?: {
    redirectTo?: string
  }) => Promise<T>
  completeAgeConfirmation: () => Promise<void>
}

const LoginPromptContext = createContext<LoginPromptContextType | undefined>(undefined)

export function LoginPromptProvider({ children }: { children: React.ReactNode }) {
  const { refreshProfile } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null)
  const [dialogTitle, setDialogTitle] = useState<string>('登录以继续')
  const [dialogDescription, setDialogDescription] = useState<string>('登录后即可点赞、评论和分享项目')
  const pendingAgeConfirmationRef = useRef<PendingAgeConfirmation | null>(null)
  const [interactionConfirmationOpen, setInteractionConfirmationOpen] = useState(false)
  const [interactionConfirmationLoading, setInteractionConfirmationLoading] = useState(false)
  const [interactionConfirmationError, setInteractionConfirmationError] = useState<string | null>(null)

  const promptLogin = useCallback((
    callback?: () => void,
    options?: { title?: string; description?: string }
  ) => {
    // 存储回调函数
    setPendingCallback(() => callback || null)
    
    // 设置对话框文案
    if (options?.title) setDialogTitle(options.title)
    if (options?.description) setDialogDescription(options.description)
    
    // 打开对话框
    setIsOpen(true)
  }, [])

  const handleSuccess = useCallback(() => {
    // 执行待处理的回调
    if (pendingCallback) {
      pendingCallback()
    }
    
    // 清理状态
    setPendingCallback(null)
    setDialogTitle('登录以继续')
    setDialogDescription('登录后即可点赞、评论和分享项目')
  }, [pendingCallback])

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open)
    
    // 如果关闭对话框，清理待处理的回调
    if (!open) {
      setPendingCallback(null)
      setDialogTitle('登录以继续')
      setDialogDescription('登录后即可点赞、评论和分享项目')
    }
  }, [])

  const runAfterAgeConfirmation = useCallback(<T,>(
    action: AgeConfirmationAction,
    _options?: { redirectTo?: string },
  ) => {
    if (typeof window === 'undefined') {
      return action() as Promise<T>
    }

    return new Promise<T>((resolve, reject) => {
      pendingAgeConfirmationRef.current?.reject(new Error('社区互动确认请求已被新的操作替换'))
      pendingAgeConfirmationRef.current = {
        action,
        resolve: (value) => resolve(value as T),
        reject,
      }
      setInteractionConfirmationError(null)
      setInteractionConfirmationOpen(true)
    })
  }, [])

  const completeAgeConfirmation = useCallback(async () => {
    const pending = pendingAgeConfirmationRef.current
    setInteractionConfirmationOpen(false)
    setInteractionConfirmationError(null)
    if (!pending) return

    pendingAgeConfirmationRef.current = null

    try {
      const result = await pending.action()
      pending.resolve(result)
    } catch (error) {
      pending.reject(error)
      logger.warn('Deferred interaction retry failed', { error })
    }

    // If the retry hit the gate again, the action registered a new pending request.
    if (pendingAgeConfirmationRef.current) return
  }, [])

  const cancelAgeConfirmation = useCallback(() => {
    const pending = pendingAgeConfirmationRef.current
    pendingAgeConfirmationRef.current = null
    setInteractionConfirmationOpen(false)
    setInteractionConfirmationError(null)
    pending?.reject(new Error('社区互动确认已取消'))
  }, [])

  const confirmInteraction = useCallback(async () => {
    setInteractionConfirmationLoading(true)
    setInteractionConfirmationError(null)

    try {
      const response = await fetch('/api/settings/age-confirmation', { method: 'POST' })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(data.error || '确认失败，请稍后重试')

      await refreshProfile().catch((error) => {
        logger.warn('Failed to refresh profile after interaction confirmation', { error })
      })
      await completeAgeConfirmation()
    } catch (error) {
      setInteractionConfirmationError(error instanceof Error ? error.message : '确认失败，请稍后重试')
    } finally {
      setInteractionConfirmationLoading(false)
    }
  }, [completeAgeConfirmation, refreshProfile])

  return (
    <LoginPromptContext.Provider value={{
      promptLogin,
      runAfterAgeConfirmation,
      completeAgeConfirmation,
    }}>
      {children}
      <LoginDialog
        open={isOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
        title={dialogTitle}
        description={dialogDescription}
      />
      <InteractionConfirmationDialog
        open={interactionConfirmationOpen}
        loading={interactionConfirmationLoading}
        error={interactionConfirmationError}
        onOpenChange={(open) => {
          if (!open) cancelAgeConfirmation()
        }}
        onConfirm={confirmInteraction}
      />
    </LoginPromptContext.Provider>
  )
}

export const useLoginPrompt = () => {
  const context = useContext(LoginPromptContext)
  if (context === undefined) {
    throw new Error('useLoginPrompt must be used within a LoginPromptProvider')
  }
  return context
}
