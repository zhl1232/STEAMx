'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, AlertCircle, Mail, Lock } from 'lucide-react'

type AuthView = 'sign_in' | 'sign_up'

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  title?: string
  description?: string
}

export function LoginDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  title = '登录以继续',
  description = '登录后即可点赞、评论和分享项目'
}: LoginDialogProps) {
  const supabase = createClient()
  const [view, setView] = useState<AuthView>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (view === 'sign_in') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        
        // 登录成功
        onOpenChange(false)
        // 执行回调（如点赞、评论等）
        onSuccess?.()
        
        // 刷新页面以更新认证状态
        setTimeout(() => {
          window.location.reload()
        }, 100)
      } else {
        // 注册
        const username = `user_${Math.random().toString(36).slice(2, 10)}`
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              username: username,
              full_name: email.split('@')[0],
            }
          },
        })
        if (error) throw error
        
        // 检查是否自动登录
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          onOpenChange(false)
          onSuccess?.()
          setTimeout(() => {
            window.location.reload()
          }, 100)
        } else {
          setError('注册成功！请检查邮箱以确认账号。')
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : (typeof err === 'string' ? err : (err as { message?: string })?.message || '发生错误，请稍后重试。')

      if (process.env.NODE_ENV === 'development') {
        console.error('Auth error:', errorMessage)
      }
      
      // 优化错误提示
      if (errorMessage === 'Invalid login credentials') {
        setError('邮箱或密码错误，请重试。')
      } else if (errorMessage.includes('User already registered')) {
        setError('该邮箱已被注册，请直接登录。')
      } else if (errorMessage.includes('Password should be at least')) {
        setError('密码长度至少需要 6 位。')
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleView = () => {
    setView(view === 'sign_in' ? 'sign_up' : 'sign_in')
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">邮箱地址</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                required
                minLength={6}
                autoComplete={view === 'sign_in' ? 'current-password' : 'new-password'}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                处理中...
              </>
            ) : (
              <>{view === 'sign_in' ? '登录' : '注册'}</>
            )}
          </Button>
        </form>

        <div className="text-center text-sm">
          <p className="text-muted-foreground">
            {view === 'sign_in' ? '还没有账号？' : '已有账号？'}{' '}
            <button
              type="button"
              onClick={toggleView}
              className="text-primary hover:underline font-medium"
            >
              {view === 'sign_in' ? '立即注册' : '立即登录'}
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
