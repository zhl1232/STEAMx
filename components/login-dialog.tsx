'use client'

import { useEffect, useState } from 'react'
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
import { toE164 } from '@/lib/utils/phone'

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
  const [step, setStep] = useState<'input' | 'verify'>('input')
  const [useOtpLogin, setUseOtpLogin] = useState(false)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const identifierValue = identifier.trim()
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifierValue)
  const phoneDigits = identifierValue.replace(/\D/g, '')
  const isPhoneInput = !isEmail && phoneDigits.length >= 11
  const formattedPhone = isPhoneInput ? toE164(identifierValue) : ''
  const isPhone = !!formattedPhone
  const otpMode = isPhone && (view !== 'sign_in' || useOtpLogin)

  useEffect(() => {
    setOtp('')
    setStep('input')
  }, [identifierValue, view, useOtpLogin])

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (!isPhone) throw new Error('请输入有效的手机号')
      const res = await fetch('/api/auth/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, type: 'login' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '发送验证码失败')
      setStep('verify')
      setMessage('验证码已发送，请输入收到的短信验证码。')
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('OTP send error:', error)
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
      if (!otp) throw new Error('请输入验证码')
      if (!isPhone) throw new Error('请输入有效的手机号')
      const res = await fetch('/api/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, code: otp }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '验证失败')
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl
        return
      }
      onOpenChange(false)
      onSuccess?.()
      setTimeout(() => window.location.reload(), 100)
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('OTP verify error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage || '验证失败，请检查验证码是否正确。')
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (otpMode) {
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
      if (isEmail) {
        if (view === 'sign_in') {
          const { error } = await supabase.auth.signInWithPassword({
            email: identifierValue,
            password,
          })
          if (error) throw error

          // 登录成功
          onOpenChange(false)
          onSuccess?.()
          setTimeout(() => {
            window.location.reload()
          }, 100)
        } else {
          const username = `user_${Math.random().toString(36).slice(2, 10)}`
          const { error } = await supabase.auth.signUp({
            email: identifierValue,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
              data: {
                username: username,
                full_name: identifierValue.split('@')[0],
              }
            },
          })
          if (error) throw error

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
      } else if (isPhone && view === 'sign_in') {
        if (!password) throw new Error('请输入密码或使用短信验证码登录')
        const { error } = await supabase.auth.signInWithPassword({
          phone: formattedPhone,
          password,
        })
        if (error) throw error
        onOpenChange(false)
        onSuccess?.()
        setTimeout(() => {
          window.location.reload()
        }, 100)
      } else if (isPhone && view === 'sign_up') {
        setError('手机号注册请使用短信验证码')
      } else {
        setError('请输入有效的邮箱或手机号')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error
        ? err.message
        : (typeof err === 'string' ? err : (err as { message?: string })?.message || '发生错误，请稍后重试。')

      if (process.env.NODE_ENV === 'development') {
        console.error('Auth error:', errorMessage)
      }

      if (errorMessage === 'Invalid login credentials') {
        setError('账号或密码错误，请重试。')
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
    setUseOtpLogin(false)
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

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">邮箱或手机号</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="name@example.com / 13800138000"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          {!otpMode && (
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
              {isPhone && view === 'sign_in' && (
                <button
                  type="button"
                  onClick={() => setUseOtpLogin(true)}
                  className="text-sm text-primary hover:underline"
                >
                  使用短信验证码登录
                </button>
              )}
            </div>
          )}

          {otpMode && (
            <div className="space-y-2">
              {step === 'verify' ? (
                <>
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
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep('input')}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      重新发送验证码
                    </button>
                    {view === 'sign_in' && (
                      <button
                        type="button"
                        onClick={() => setUseOtpLogin(false)}
                        className="text-sm text-primary hover:underline"
                      >
                        使用密码登录
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">点击下方按钮获取短信验证码。</p>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                处理中...
              </>
            ) : otpMode ? (
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
