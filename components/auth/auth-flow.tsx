'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Lock,
  Mail,
  MessageSquareMore,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { LoginSchema, ResetPasswordSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toE164 } from '@/lib/utils/phone'

const OTP_SEND_FAIL_DEFAULT = '发送验证码失败，请检查手机号或稍后重试。'
const OTP_VERIFY_FAIL_DEFAULT = '验证失败，请检查验证码是否正确。'
const OTP_COOLDOWN_SECONDS = 60

export type AuthMode = 'sign_in' | 'sign_up' | 'forgot_password'
export type AuthMethod = 'phone' | 'email'
type OtpStep = 'input' | 'verify'
type AuthPresentation = 'page' | 'layer'

interface AuthFlowProps {
  presentation: AuthPresentation
  title?: string
  description?: string
  initialMode?: AuthMode
  initialMethod?: AuthMethod
  nextPath?: string
  onBack?: () => void
  onClose?: () => void
  onSuccess?: () => void
}

function getOtpErrorMessage(error: unknown, defaultMessage = OTP_SEND_FAIL_DEFAULT): string {
  if (error instanceof Error) {
    const name = (error as Error & { name?: string }).name
    const msg = error.message
    const status = (error as Error & { status?: number }).status

    if (name === 'AuthRetryableFetchError' || status === 504 || /timeout|504|Gateway Timeout/i.test(msg)) {
      return '验证码服务暂时繁忙或网络超时，请稍后重试。'
    }

    if (msg && msg !== 'Unknown error') return msg
  }

  return defaultMessage
}

function getAuthErrorMessage() {
  if (typeof window === 'undefined') return null
  const authError = new URLSearchParams(window.location.search).get('authError')

  if (authError === 'auth_callback_failed') {
    return '登录回调失败，请重新尝试。'
  }

  return null
}

function getSafeNextPath() {
  if (typeof window === 'undefined') return '/'
  const next = new URLSearchParams(window.location.search).get('next')
  if (!next || !next.startsWith('/')) return '/'
  if (next.startsWith('//')) return '/'
  return next
}

function getFriendlyErrorMessage(error: unknown) {
  const errorMessage = error instanceof Error
    ? error.message
    : (typeof error === 'string' ? error : (error as { message?: string })?.message || '发生错误，请稍后重试。')

  if (errorMessage === 'Invalid login credentials') {
    return '账号或密码错误，请重试。'
  }

  if (errorMessage.includes('User already registered')) {
    return '该邮箱已被注册，请直接登录。'
  }

  if (errorMessage.includes('Password should be at least')) {
    return '密码长度至少需要 6 位。'
  }

  return errorMessage
}

export function AuthFlow({
  presentation,
  title,
  description,
  initialMode = 'sign_in',
  initialMethod = 'phone',
  nextPath,
  onBack,
  onClose,
  onSuccess,
}: AuthFlowProps) {
  const supabase = createClient()
  const { toast } = useToast()

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [method, setMethod] = useState<AuthMethod>(initialMethod)
  const [usePhonePassword, setUsePhonePassword] = useState(false)

  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState<OtpStep>('input')

  const [termsAgreed, setTermsAgreed] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [checkboxShake, setCheckboxShake] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const emailValue = email.trim()
  const phoneValue = phone.trim()
  const phoneDigits = phoneValue.replace(/\D/g, '')
  const isPhone = phoneDigits.length >= 11
  const formattedPhone = isPhone ? toE164(phoneValue) : ''

  const otpMode = method === 'phone' && !usePhonePassword && mode !== 'forgot_password'
  const showPasswordField = (method === 'email' && mode !== 'forgot_password') || (method === 'phone' && mode === 'sign_in' && usePhonePassword)

  const resolvedTitle = title ?? (mode === 'sign_in' ? '欢迎回来' : mode === 'sign_up' ? '创建账号' : '找回密码')
  const resolvedDescription = description ?? (mode === 'sign_in'
    ? '手机号快捷验证优先，邮箱密码作为备用方式。'
    : mode === 'sign_up'
      ? '用手机号快速开始，也可以改用邮箱创建账号。'
      : '目前仅支持通过邮箱发送重置链接。')
  const successTarget = nextPath ?? getSafeNextPath()
  const titleId = presentation === 'page' ? 'auth-page-title' : 'auth-layer-title'
  const descriptionId = presentation === 'page' ? 'auth-page-description' : 'auth-layer-description'

  const methodOptions = useMemo(() => [
    {
      key: 'phone' as const,
      label: '手机号',
      helper: mode === 'sign_in' ? '验证码直达' : '验证码注册',
      icon: Smartphone,
      disabled: mode === 'forgot_password',
    },
    {
      key: 'email' as const,
      label: '邮箱',
      helper: mode === 'forgot_password' ? '发送重置链接' : '密码登录',
      icon: Mail,
      disabled: false,
    },
  ], [mode])

  useEffect(() => {
    if (otpCooldown <= 0) return
    const timer = window.setInterval(() => {
      setOtpCooldown((current) => (current <= 1 ? 0 : current - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [otpCooldown])

  useEffect(() => {
    setOtp('')
    setOtpStep('input')
    setError(null)
    setMessage(null)
  }, [method, mode, phoneValue, usePhonePassword])

  useEffect(() => {
    if (mode === 'forgot_password' && method !== 'email') {
      setMethod('email')
    }
  }, [method, mode])

  useEffect(() => {
    if (presentation !== 'page') return
    const authErrorMessage = getAuthErrorMessage()
    if (authErrorMessage) {
      setError(authErrorMessage)
    }
  }, [presentation])

  const shakeConsent = () => {
    setCheckboxShake(true)
    window.setTimeout(() => setCheckboxShake(false), 500)
  }

  const requireRegistrationConsent = () => {
    if (mode !== 'sign_up') return true

    if (!termsAgreed) {
      toast({
        title: '请先同意条款',
        description: '注册前请先阅读并同意《服务条款》和《隐私政策》。',
        variant: 'destructive',
      })
      shakeConsent()
      return false
    }

    if (!ageConfirmed) {
      toast({
        title: '请确认年龄',
        description: '注册前请确认年龄或已获得监护人同意。',
        variant: 'destructive',
      })
      shakeConsent()
      return false
    }

    return true
  }

  const completeSuccess = () => {
    if (onSuccess) {
      onSuccess()
      return
    }

    window.location.href = successTarget
  }

  const handleSendOtp = async () => {
    if (!requireRegistrationConsent()) return
    if (!formattedPhone) {
      setError('请输入有效的手机号')
      return
    }
    if (otpCooldown > 0) return

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/auth/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, type: 'login' }),
      })
      const text = await res.text()
      let data: { error?: string } = {}

      try {
        if (text) data = JSON.parse(text)
      } catch {
        if (process.env.NODE_ENV === 'development') console.warn('[OTP] 响应非 JSON:', text?.slice(0, 200))
      }

      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : `请求失败 ${res.status}`)
      }

      setMessage(mode === 'sign_up' ? '验证码已发送，验证后会直接创建并登录账号。' : '验证码已发送，请输入收到的短信验证码。')
      setOtpCooldown(OTP_COOLDOWN_SECONDS)
      setOtpStep('verify')
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('OTP send error:', err)
      setError(getOtpErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!requireRegistrationConsent()) return
    if (!formattedPhone) {
      setError('请输入有效的手机号')
      return
    }
    if (!otp) {
      setError('请输入验证码')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, code: otp }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(data.error || '验证失败')

      if (data.tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          type: 'magiclink',
          token_hash: data.tokenHash,
        })

        if (verifyError) throw verifyError
        completeSuccess()
        return
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl
        return
      }

      completeSuccess()
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('OTP verify error:', err)
      setError(getOtpErrorMessage(err, OTP_VERIFY_FAIL_DEFAULT))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const result = ResetPasswordSchema.safeParse({ email: emailValue })
      if (!result.success) throw new Error(result.error.issues[0].message)

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailValue, {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/settings/security?mode=recovery')}`,
      })

      if (resetError) throw resetError
      setMessage('重置密码链接已发送到你的邮箱，请查收。')
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('Reset password error:', err)
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleEmailPasswordAuth = async () => {
    if (mode === 'sign_up' && !requireRegistrationConsent()) return

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const result = LoginSchema.safeParse({ email: emailValue, password })
      if (!result.success) throw new Error(result.error.issues[0].message)

      if (mode === 'sign_in') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: emailValue,
          password,
        })

        if (signInError) throw signInError
        completeSuccess()
        return
      }

      const username = `user_${Math.random().toString(36).slice(2, 10)}`
      const { error: signUpError } = await supabase.auth.signUp({
        email: emailValue,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback${successTarget !== '/' ? `?next=${encodeURIComponent(successTarget)}` : ''}`,
          data: {
            username,
            full_name: emailValue.split('@')[0],
          },
        },
      })

      if (signUpError) throw signUpError

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        completeSuccess()
        return
      }

      setMessage('注册成功，请前往邮箱完成确认。')
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('Email auth error:', err)
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handlePhonePasswordSignIn = async () => {
    if (!formattedPhone) {
      setError('请输入有效的手机号')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        phone: formattedPhone,
        password,
      })

      if (signInError) throw signInError
      completeSuccess()
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('Phone password auth error:', err)
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'forgot_password') {
      await handleResetPassword()
      return
    }

    if (otpMode) {
      if (otpStep === 'input') {
        await handleSendOtp()
      } else {
        await handleVerifyOtp()
      }
      return
    }

    if (method === 'phone') {
      await handlePhonePasswordSignIn()
      return
    }

    await handleEmailPasswordAuth()
  }

  const switchMode = (nextMode: AuthMode) => {
    const wasForgotPassword = mode === 'forgot_password'
    setMode(nextMode)
    if (nextMode === 'forgot_password') {
      setMethod('email')
    } else if (wasForgotPassword) {
      setMethod(initialMethod)
    }
    setUsePhonePassword(false)
    setError(null)
    setMessage(null)
  }

  const switchMethod = (nextMethod: AuthMethod) => {
    if (mode === 'forgot_password') return
    setMethod(nextMethod)
    setUsePhonePassword(false)
    setError(null)
    setMessage(null)
  }

  const renderFieldLabel = () => (method === 'phone' ? '手机号' : '邮箱')
  const renderFieldValue = () => (method === 'phone' ? phone : email)
  const renderFieldPlaceholder = () => (method === 'phone' ? '13800138000' : 'name@example.com')

  return (
    <div className={cn(
      'relative overflow-hidden',
      presentation === 'page'
        ? 'mx-auto w-full max-w-5xl rounded-[32px] border border-border/70 bg-card/96 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.5)]'
        : 'h-full bg-background'
    )}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.98))]" />

      <div className={cn(
        'relative',
        presentation === 'page' ? 'grid min-h-[min(880px,100dvh-3rem)] gap-0 md:grid-cols-[0.95fr_1.05fr]' : 'flex h-full flex-col'
      )}>
        <section className={cn(
          'flex flex-col',
          presentation === 'page'
            ? 'justify-between border-b border-border/60 px-5 py-5 sm:px-8 sm:py-8 md:border-b-0 md:border-r'
            : 'min-h-0 flex-1 px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6'
        )}>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={presentation === 'page' ? onBack : onClose}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border/70 bg-background/78 px-4 text-sm font-medium text-foreground/82 transition-colors hover:bg-background"
              >
                <ArrowLeft className="h-4 w-4" />
                返回
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                更接近日常 App 的移动端流程
              </div>
            </div>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                <MessageSquareMore className="h-3.5 w-3.5" />
                {mode === 'sign_in' ? '先登录，再继续当前操作' : mode === 'sign_up' ? '注册后直接进入账号' : '邮箱找回密码'}
              </div>

              <div className="space-y-2">
                <h1 id={titleId} className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {resolvedTitle}
                </h1>
                <p id={descriptionId} className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {resolvedDescription}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => switchMode('sign_in')}
                  className={cn(
                    'rounded-[22px] border px-4 py-3 text-left transition-colors',
                    mode === 'sign_in'
                      ? 'border-primary/30 bg-primary/10 text-foreground'
                      : 'border-border/60 bg-background/70 text-muted-foreground hover:bg-background'
                  )}
                >
                  <div className="text-sm font-semibold">登录</div>
                  <div className="mt-1 text-xs">直接继续当前操作</div>
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('sign_up')}
                  className={cn(
                    'rounded-[22px] border px-4 py-3 text-left transition-colors',
                    mode === 'sign_up'
                      ? 'border-primary/30 bg-primary/10 text-foreground'
                      : 'border-border/60 bg-background/70 text-muted-foreground hover:bg-background'
                  )}
                >
                  <div className="text-sm font-semibold">注册</div>
                  <div className="mt-1 text-xs">首次使用快速创建</div>
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('forgot_password')}
                  className={cn(
                    'rounded-[22px] border px-4 py-3 text-left transition-colors',
                    mode === 'forgot_password'
                      ? 'border-primary/30 bg-primary/10 text-foreground'
                      : 'border-border/60 bg-background/70 text-muted-foreground hover:bg-background'
                  )}
                >
                  <div className="text-sm font-semibold">找回密码</div>
                  <div className="mt-1 text-xs">邮箱重置链接</div>
                </button>
              </div>
            </div>

            {presentation === 'page' && (
              <div className="hidden rounded-[28px] border border-border/60 bg-background/65 p-6 md:block">
                <div className="space-y-4">
                  <div className="text-sm font-semibold text-foreground">为什么这样改</div>
                  <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                    <p>手机号默认走验证码，减少移动端输入负担。</p>
                    <p>注册与登录拆开表达，条款只在注册时出现，不再阻断日常登录。</p>
                    <p>受保护操作会留在当前上下文完成认证，成功后继续原动作。</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {presentation !== 'page' && (
            <div className="mt-6 rounded-[24px] border border-border/60 bg-muted/35 p-4 text-xs leading-5 text-muted-foreground">
              手机号验证码优先，邮箱密码保留为备用方式。登录完成后会继续当前操作。
            </div>
          )}
        </section>

        <section className={cn(
          'relative flex flex-col justify-center',
          presentation === 'page' ? 'px-5 py-6 sm:px-8 sm:py-8' : 'px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6'
        )}>
          <div className={cn(
            'rounded-[30px] border border-border/70 bg-background/84 p-4 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur sm:p-6',
            presentation === 'page' ? 'md:mx-auto md:w-full md:max-w-xl' : 'mt-auto'
          )}>
            <div className="space-y-5">
              {mode !== 'forgot_password' && (
                <div className="grid grid-cols-2 gap-2 rounded-[22px] border border-border/60 bg-muted/35 p-1">
                  {methodOptions.map((option) => {
                    const Icon = option.icon

                    return (
                      <button
                        key={option.key}
                        type="button"
                        disabled={option.disabled}
                        onClick={() => switchMethod(option.key)}
                        className={cn(
                          'rounded-[18px] px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                          method === option.key
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-background/70'
                        )}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </div>
                        <div className="mt-1 text-xs">{option.helper}</div>
                      </button>
                    )
                  })}
                </div>
              )}

              {error && (
                <div className="rounded-[20px] border border-destructive/20 bg-destructive/10 p-4 text-destructive">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-sm leading-6">{error}</p>
                  </div>
                </div>
              )}

              {message && (
                <div className="rounded-[20px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-700">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-sm leading-6">{message}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" aria-labelledby={titleId} aria-describedby={descriptionId}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/86">{renderFieldLabel()}</label>
                  <div className="relative">
                    {method === 'phone' ? (
                      <Smartphone className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    )}
                    <Input
                      type={method === 'phone' ? 'tel' : 'email'}
                      inputMode={method === 'phone' ? 'numeric' : 'email'}
                      autoComplete={method === 'phone' ? 'tel-national' : 'email'}
                      placeholder={renderFieldPlaceholder()}
                      value={renderFieldValue()}
                      onChange={(event) => {
                        if (method === 'phone') {
                          setPhone(event.target.value)
                        } else {
                          setEmail(event.target.value)
                        }
                      }}
                      className="h-12 rounded-2xl border-border/70 bg-background/80 pl-10 text-[15px]"
                      required
                    />
                  </div>
                  {method === 'phone' ? (
                    <p className="text-xs text-muted-foreground">默认使用短信验证码，适合移动端快速登录。</p>
                  ) : mode === 'forgot_password' ? (
                    <p className="text-xs text-muted-foreground">我们会向你的邮箱发送重置密码链接。</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">邮箱方式适合已有密码账号或桌面端登录。</p>
                  )}
                </div>

                {showPasswordField && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-medium text-foreground/86">密码</label>
                      {method === 'email' && mode === 'sign_in' && (
                        <button
                          type="button"
                          onClick={() => switchMode('forgot_password')}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          忘记密码
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="请输入至少 6 位密码"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
                        minLength={6}
                        className="h-12 rounded-2xl border-border/70 bg-background/80 pl-10 text-[15px]"
                        required
                      />
                    </div>
                    {method === 'phone' && mode === 'sign_in' && (
                      <button
                        type="button"
                        onClick={() => setUsePhonePassword(false)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        改用短信验证码
                      </button>
                    )}
                  </div>
                )}

                {otpMode && (
                  <div className="space-y-3 rounded-[22px] border border-border/60 bg-muted/30 p-4">
                    {otpStep === 'verify' ? (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground/86">短信验证码</label>
                          <div className="flex overflow-hidden rounded-2xl border border-input bg-background">
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              placeholder="请输入 6 位验证码"
                              value={otp}
                              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                              className="h-12 flex-1 bg-transparent px-4 text-[15px] outline-none placeholder:text-muted-foreground"
                              maxLength={6}
                              required
                            />
                            <button
                              type="button"
                              onClick={handleSendOtp}
                              disabled={otpCooldown > 0 || loading}
                              className="shrink-0 border-l border-border px-4 text-sm font-medium text-primary disabled:opacity-50"
                            >
                              {otpCooldown > 0 ? `${otpCooldown}s` : '重发'}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>短信验证成功后会直接继续。</span>
                          {mode === 'sign_in' && (
                            <button
                              type="button"
                              onClick={() => setUsePhonePassword(true)}
                              className="font-medium text-primary hover:underline"
                            >
                              改用密码
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-foreground/86">短信验证</div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {mode === 'sign_in'
                            ? '输入手机号后即可获取验证码，适合移动端快速登录。'
                            : '注册时会先发送验证码，验证成功后自动创建并登录账号。'}
                        </p>
                        {mode === 'sign_in' && (
                          <button
                            type="button"
                            onClick={() => setUsePhonePassword(true)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            我记得密码，改用密码登录
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {mode === 'sign_up' && (
                  <div className="space-y-3">
                    <div
                      className={cn(
                        'flex items-start gap-3 rounded-[22px] border border-border/60 bg-muted/25 px-4 py-3',
                        checkboxShake && 'animate-[shake_0.4s_ease-in-out]'
                      )}
                    >
                      <Checkbox
                        id={`${presentation}-terms`}
                        checked={termsAgreed}
                        onCheckedChange={(checked) => setTermsAgreed(checked === true)}
                        className="mt-0.5"
                      />
                      <label htmlFor={`${presentation}-terms`} className="text-sm leading-6 text-muted-foreground">
                        我已阅读并同意
                        <Link href="/legal/terms" className="mx-1 text-primary hover:underline">《服务条款》</Link>
                        和
                        <Link href="/legal/privacy" className="mx-1 text-primary hover:underline">《隐私政策》</Link>
                      </label>
                    </div>

                    <div
                      className={cn(
                        'flex items-start gap-3 rounded-[22px] border border-border/60 bg-muted/25 px-4 py-3',
                        checkboxShake && !ageConfirmed && 'animate-[shake_0.4s_ease-in-out]'
                      )}
                    >
                      <Checkbox
                        id={`${presentation}-age`}
                        checked={ageConfirmed}
                        onCheckedChange={(checked) => setAgeConfirmed(checked === true)}
                        className="mt-0.5"
                      />
                      <label htmlFor={`${presentation}-age`} className="text-sm leading-6 text-muted-foreground">
                        我已年满 14 周岁，或已获得监护人同意使用本平台
                      </label>
                    </div>
                  </div>
                )}

                <Button type="submit" className="h-12 w-full rounded-2xl text-base font-semibold" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      处理中...
                    </>
                  ) : mode === 'forgot_password' ? (
                    '发送重置链接'
                  ) : otpMode ? (
                    otpStep === 'input' ? (mode === 'sign_up' ? '获取验证码并继续注册' : '获取验证码') : (mode === 'sign_up' ? '验证并创建账号' : '验证并登录')
                  ) : mode === 'sign_in' ? (
                    method === 'phone' ? '手机号密码登录' : '邮箱登录'
                  ) : (
                    '邮箱注册'
                  )}
                </Button>
              </form>

              <div className="flex items-center justify-between gap-4 rounded-[22px] border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                <div>
                  {mode === 'sign_in'
                    ? '第一次来这里？'
                    : mode === 'sign_up'
                      ? '已经有账号了？'
                      : '想直接登录或注册？'}
                </div>
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'sign_in' ? 'sign_up' : 'sign_in')}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {mode === 'sign_in' ? '去注册' : '去登录'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
