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
type AuthMethod = 'email' | 'phone'

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
  const [method, setMethod] = useState<AuthMethod>('email')
  const [step, setStep] = useState<'input' | 'verify'>('input')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (!phone) {
        throw new Error('请输入手机号码')
      }

      const formattedPhone = phone.startsWith('+') ? phone : `+86${phone}`

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone
      })

      if (error) throw error

      setStep('verify')
      setMessage('验证码已发送，请输入收到的短信验证码。')
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.error('OTP send error:', error)
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage || '发送验证码失败，请检查手机号或稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (!otp) {
        throw new Error('请输入验证码')
      }

      const formattedPhone = phone.startsWith('+') ? phone : `+86${phone}`

      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms'
      })

      if (error) throw error

      // 登录成功
      onOpenChange(false)
      onSuccess?.()

      setTimeout(() => {
        window.location.reload()
      }, 100)
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.error('OTP verify error:', error)
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage || '验证失败，请检查验证码是否正确。')
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (method === 'phone') {
      if (step === 'input') {
        await handleSendOtp(e)
      } else {
        await handleVerifyOtp(e)
      }
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

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
          setMessage('注册成功！请检查邮箱以确认账号。')
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
    setMessage(null)
    setStep('input')
  }

  const toggleMethod = (newMethod: AuthMethod) => {
    setMethod(newMethod)
    setError(null)
    setMessage(null)
    setStep('input')
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

        {message && (
          <div className="p-3 mb-4 rounded-md bg-green-500/10 border border-green-500/20 flex items-start gap-2 text-green-600">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-sm">{message}</p>
          </div>
        )}

        {/* 登录方式切换标签 */}
        <div className="flex p-1 mb-4 bg-muted rounded-lg shadow-inner">
          <button
            type="button"
            onClick={() => toggleMethod('email')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${method === 'email'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10'
              }`}
          >
            邮箱{view === 'sign_in' ? '登录' : '注册'}
          </button>
          <button
            type="button"
            onClick={() => toggleMethod('phone')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${method === 'phone'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10'
              }`}
          >
            手机号{view === 'sign_in' ? '快速登录' : '注册'}
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {/* ====== 邮箱登录方式 ====== */}
          {method === 'email' ? (
            <>
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
            </>
          ) : (
            /* ====== 手机号登录方式 ====== */
            <>
              {step === 'input' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">手机号码</label>
                  <div className="relative flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                      +86
                    </span>
                    <Input
                      type="tel"
                      placeholder="13800138000"
                      value={phone.replace(/^\+86/, '')}
                      onChange={(e) => setPhone(`+86${e.target.value.replace(/\D/g, '')}`)}
                      className="rounded-l-none pl-3"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">短信验证码</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="请输入 6 位验证码"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="pl-9"
                      required
                      maxLength={6}
                      autoComplete="one-time-code"
                    />
                  </div>
                  <div className="pt-2 text-right">
                    <button
                      type="button"
                      onClick={() => setStep('input')}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      修改手机号
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                处理中...
              </>
            ) : method === 'phone' ? (
              step === 'input' ? '获取验证码' : '验证并登录'
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
