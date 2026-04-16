'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { LoginDialog } from '@/components/layout/login-dialog'

interface LoginPromptContextType {
  promptLogin: (callback?: () => void, options?: {
    title?: string
    description?: string
  }) => void
}

const LoginPromptContext = createContext<LoginPromptContextType | undefined>(undefined)

export function LoginPromptProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null)
  const [dialogTitle, setDialogTitle] = useState<string>('登录以继续')
  const [dialogDescription, setDialogDescription] = useState<string>('登录后即可点赞、评论和分享项目')

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

  return (
    <LoginPromptContext.Provider value={{ promptLogin }}>
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
