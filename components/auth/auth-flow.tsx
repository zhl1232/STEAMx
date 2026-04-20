'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
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
  const showPhoneSignInToggle = method === 'phone' && mode === 'sign_in'
  const showOtpField = otpMode && otpStep === 'verify'

  const resolvedTitle = title ?? (mode === 'sign_in' ? '欢迎回来' : mode === 'sign_up' ? '创建账号' : '找回密码')
  const resolvedDescription = description?.trim() || null
  const successTarget = nextPath ?? getSafeNextPath()
  const titleId = presentation === 'page' ? 'auth-page-title' : 'auth-layer-title'
  const descriptionId = resolvedDescription
    ? (presentation === 'page' ? 'auth-page-description' : 'auth-layer-description')
    : undefined

  const methodOptions = [
    {
      key: 'phone' as const,
      label: '手机号',
      icon: Smartphone,
      disabled: mode === 'forgot_password',
    },
    {
      key: 'email' as const,
      label: '邮箱',
      icon: Mail,
      disabled: false,
    },
  ]

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
        description: '注册前请先阅读并同意《服务条款》和《隐私政策》，并确认已年满 14 周岁或已获得监护人同意。',
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
  const renderFieldPlaceholder = () => (method === 'phone' ? '请输入手机号' : '请输入邮箱')

  return (
    <div className={cn(
      'relative overflow-hidden',
      presentation === 'page'
        ? 'mx-auto w-full max-w-md rounded-[28px] border border-border/70 bg-card shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)]'
        : 'rounded-t-[28px] border border-b-0 border-border/70 bg-background shadow-[0_-18px_60px_-40px_rgba(15,23,42,0.35)] md:rounded-[28px] md:border-b md:bg-card'
    )}>
      <div className={cn(
        'relative space-y-5',
        presentation === 'page'
          ? 'p-5 sm:p-6'
          : 'max-h-[92dvh] overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:p-6'
      )}>
        <div className="space-y-4">
          <button
            type="button"
            onClick={presentation === 'page' ? onBack : onClose}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border/70 bg-background px-4 text-sm font-medium text-foreground/82 transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>

          <div className="space-y-2">
            <h1 id={titleId} className="font-heading text-3xl font-semibold tracking-tight text-foreground">
              {resolvedTitle}
            </h1>
            {resolvedDescription && (
              <p id={descriptionId} className="text-sm leading-6 text-muted-foreground">
                {resolvedDescription}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-[20px] bg-muted/35 p-1">
            <button
              type="button"
              onClick={() => switchMode('sign_in')}
              className={cn(
                'rounded-[16px] px-3 py-2.5 text-sm font-medium transition-colors',
                mode === 'sign_in'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/70'
              )}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => switchMode('sign_up')}
              className={cn(
                'rounded-[16px] px-3 py-2.5 text-sm font-medium transition-colors',
                mode === 'sign_up'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/70'
              )}
            >
              注册
            </button>
            <button
              type="button"
              onClick={() => switchMode('forgot_password')}
              className={cn(
                'rounded-[16px] px-3 py-2.5 text-sm font-medium transition-colors',
                mode === 'forgot_password'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/70'
              )}
            >
              找回密码
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-border/70 bg-background p-4 shadow-sm sm:p-5">
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
                      <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    ) : (
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                </div>

                {showPhoneSignInToggle && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1 rounded-[18px] border border-border/60 bg-muted/30 p-1">
                      <button
                        type="button"
                        onClick={() => setUsePhonePassword(false)}
                        className={cn(
                          'rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors',
                          !usePhonePassword
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-background/70'
                        )}
                      >
                        验证码
                      </button>
                      <button
                        type="button"
                        onClick={() => setUsePhonePassword(true)}
                        className={cn(
                          'rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors',
                          usePhonePassword
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-background/70'
                        )}
                      >
                        密码
                      </button>
                    </div>
                  </div>
                )}

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
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                  </div>
                )}

                {showOtpField && (
                  <div className="space-y-3 rounded-[22px] border border-border/60 bg-muted/30 p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-sm font-medium text-foreground/86">短信验证码</label>
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={otpCooldown > 0 || loading}
                          className="text-xs font-medium text-primary disabled:text-muted-foreground"
                        >
                          {otpCooldown > 0 ? `${otpCooldown}s 后重发` : '重新发送'}
                        </button>
                      </div>
                      <div className="flex overflow-hidden rounded-2xl border border-input bg-background">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="请输入 6 位验证码"
                          value={otp}
                          onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                          className="h-12 flex-1 bg-transparent px-4 text-[15px] outline-none placeholder:text-muted-foreground/55"
                          maxLength={6}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {mode === 'sign_up' && (
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
                      ，并确认已年满 14 周岁，或已获得监护人同意使用本平台
                    </label>
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
                    otpStep === 'input' ? (mode === 'sign_up' ? '获取验证码' : '获取验证码') : (mode === 'sign_up' ? '确认注册' : '确认登录')
                  ) : mode === 'sign_in' ? (
                    '登录'
                  ) : (
                    '注册'
                  )}
                </Button>
              </form>
          </div>
        </div>
      </div>
    </div>
  )
}
