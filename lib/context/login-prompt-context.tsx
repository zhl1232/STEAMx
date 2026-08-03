'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { LoginDialog } from '@/components/layout/login-dialog'
import { getInteractionAccessRedirect } from '@/lib/utils/http'
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
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null)
  const [dialogTitle, setDialogTitle] = useState<string>('登录以继续')
  const [dialogDescription, setDialogDescription] = useState<string>('登录后即可点赞、评论和分享项目')
  const pendingAgeConfirmationRef = useRef<PendingAgeConfirmation | null>(null)
  const ageReturnPathRef = useRef<string | null>(null)

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
    options?: { redirectTo?: string },
  ) => {
    if (typeof window === 'undefined') {
      return action() as Promise<T>
    }

    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const isAlreadyOnAgeSettings = window.location.pathname === '/settings/security'

    return new Promise<T>((resolve, reject) => {
      pendingAgeConfirmationRef.current?.reject(new Error('年龄确认请求已被新的操作替换'))
      pendingAgeConfirmationRef.current = {
        action,
        resolve: (value) => resolve(value as T),
        reject,
      }
      if (!ageReturnPathRef.current || !isAlreadyOnAgeSettings) {
        ageReturnPathRef.current = currentPath
      }

      const redirectTo = getInteractionAccessRedirect({
        code: 'AGE_CONFIRMATION_REQUIRED',
        details: { redirectTo: options?.redirectTo },
      })
      router.push(redirectTo || '/settings/security?section=age-confirmation')
    })
  }, [router])

  const completeAgeConfirmation = useCallback(async () => {
    const pending = pendingAgeConfirmationRef.current
    const returnPath = ageReturnPathRef.current
    if (!pending) return

    pendingAgeConfirmationRef.current = null
    ageReturnPathRef.current = null

    try {
      const result = await pending.action()
      pending.resolve(result)
    } catch (error) {
      pending.reject(error)
      logger.warn('Deferred interaction retry failed', { error })
    }

    // If the retry hit the gate again, the action registered a new pending request.
    if (pendingAgeConfirmationRef.current) return
    if (returnPath) router.push(returnPath)
  }, [router])

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
