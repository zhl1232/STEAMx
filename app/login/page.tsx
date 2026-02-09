'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, Mail, Lock } from 'lucide-react'
import Link from 'next/link'
import { LoginSchema, ResetPasswordSchema } from '@/lib/schemas'

type AuthView = 'sign_in' | 'sign_up' | 'forgot_password'

export default function LoginPage() {
  const supabase = createClient()
  const [view, setView] = useState<AuthView>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      // Zod Validation
      if (view === 'sign_in') {
        const result = LoginSchema.safeParse({ email, password });
        if (!result.success) {
          throw new Error(result.error.issues[0].message);
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        
        // 登录成功，使用 window.location 确保完全刷新
        window.location.href = '/'
        return // 不需要 setLoading(false)，因为页面会刷新
      } else if (view === 'sign_up') {
        const result = LoginSchema.safeParse({ email, password });
        if (!result.success) {
          throw new Error(result.error.issues[0].message);
        }

        // Auto-generate username (Account ID)
        const username = `user_${Math.random().toString(36).slice(2, 10)}`
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              username: username,
              full_name: email.split('@')[0], // Default display name from email
            }
          },
        })
        if (error) throw error
        setMessage('注册成功！请检查你的邮箱以确认账号。')
        
        // 检查是否自动登录
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          window.location.href = '/'
          return
        }
      } else if (view === 'forgot_password') {
        const result = ResetPasswordSchema.safeParse({ email });
        if (!result.success) {
          throw new Error(result.error.issues[0].message);
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/profile/reset-password`,
        })
        if (error) throw error
        setMessage('重置密码链接已发送到你的邮箱，请查收。')
      }
    } catch (error: unknown) {
      // 不要在生产环境暴露敏感信息
      if (process.env.NODE_ENV === 'development') {
        console.error('Auth error:', error)
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // 优化错误提示
      if (errorMessage === 'Invalid login credentials') {
        setError('邮箱或密码错误，请重试。')
      } else if (errorMessage.includes('User already registered')) {
        setError('该邮箱已被注册，请直接登录。')
      } else if (errorMessage.includes('Password should be at least')) {
        setError('密码长度至少需要 6 位。')
      } else {
        setError(errorMessage || '发生错误，请稍后重试。')
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleView = (newView: AuthView) => {
    setView(newView)
    setError(null)
    setMessage(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      <div className="w-full max-w-md">
        {/* 返回按钮 */}
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回首页
          </Button>
        </Link>

        {/* 登录卡片 */}
        <div className="bg-card rounded-lg border shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">
              {view === 'sign_in' && '欢迎回来'}
              {view === 'sign_up' && '加入我们'}
              {view === 'forgot_password' && '重置密码'}
            </h1>
            <p className="text-muted-foreground">
              {view === 'sign_in' && '登录你的 STEAM 账号，继续探索之旅'}
              {view === 'sign_up' && '创建账号，开始你的创意之旅'}
              {view === 'forgot_password' && '输入邮箱，我们将发送重置链接'}
            </p>
          </div>

          {/* 错误/成功提示 */}
          {error && (
            <div className="mb-6 p-4 rounded-md bg-destructive/10 border border-destructive/20 flex items-start gap-3 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-6 p-4 rounded-md bg-green-500/10 border border-green-500/20 flex items-start gap-3 text-green-600">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{message}</p>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                邮箱地址
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {view !== 'forgot_password' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    密码
                  </label>
                  {view === 'sign_in' && (
                    <button
                      type="button"
                      onClick={() => toggleView('forgot_password')}
                      className="text-sm text-primary hover:underline"
                    >
                      忘记密码？
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                    autoComplete={view === 'sign_in' ? 'current-password' : 'new-password'}
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  {view === 'sign_in' && '登录'}
                  {view === 'sign_up' && '注册'}
                  {view === 'forgot_password' && '发送重置链接'}
                </>
              )}
            </Button>
          </form>

          {/* 切换视图 */}
          <div className="mt-6 text-center text-sm">
            {view === 'sign_in' && (
              <p className="text-muted-foreground">
                还没有账号？{' '}
                <button
                  onClick={() => toggleView('sign_up')}
                  className="text-primary hover:underline font-medium"
                >
                  立即注册
                </button>
              </p>
            )}
            {view === 'sign_up' && (
              <p className="text-muted-foreground">
                已有账号？{' '}
                <button
                  onClick={() => toggleView('sign_in')}
                  className="text-primary hover:underline font-medium"
                >
                  立即登录
                </button>
              </p>
            )}
            {view === 'forgot_password' && (
              <button
                onClick={() => toggleView('sign_in')}
                className="text-primary hover:underline font-medium"
              >
                返回登录
              </button>
            )}
          </div>
        </div>

        {/* 底部提示 */}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p>登录即表示你同意我们的服务条款和隐私政策</p>
        </div>
      </div>
    </div>
  )
}
