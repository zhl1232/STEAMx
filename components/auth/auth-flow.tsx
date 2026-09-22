'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Lock,
  Pencil,
  ShieldCheck,
  Smartphone,
  KeyRound,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { sanitizeInternalHref } from '@/lib/utils/safe-internal-href'
import { logger } from '@/lib/logger'
import { PLATFORM_ONBOARDING_HREF } from '@/lib/product/onboarding'
import { ResetPasswordSchema } from '@/lib/schemas'
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
  onSuccess?: (options?: { isNewUser?: boolean }) => void
}

function getOtpErrorMessage(error: unknown, defaultMessage = OTP_SEND_FAIL_DEFAULT): string {
  if (error instanceof Error) {
    const name = (error as Error & { name?: string }).name
    const msg = error.message
    const status = (error as Error & { status?: number }).status

    if (name === 'AuthRetryableFetchError' || status === 504 || /timeout|timed out|504|Gateway Timeout/i.test(msg)) {
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

/**
 * 新注册没有指定 next 时，落地页进入平台方向指南，而不是首页。
 * 手机号验证码同时承担登录和注册，所以「是不是新用户」只能由 verify 接口告诉我们。
 * 老用户登录仍然回首页或来处，避免打断他们原本要做的事。
 */
function getSafeNextPath(fallbackHref = '/') {
  if (typeof window === 'undefined') return fallbackHref
  return sanitizeInternalHref(new URLSearchParams(window.location.search).get('next'), fallbackHref)
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

function getInitialEmailMode(initialMode: AuthMode): 'sign_in' | 'sign_up' {
  return initialMode === 'sign_up' ? 'sign_up' : 'sign_in'
}

function isEmailIdentifier(value: string) {
  return value.includes('@')
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

  const [method, setMethod] = useState<AuthMethod>(initialMode === 'forgot_password' ? 'email' : initialMethod)
  const [emailMode, setEmailMode] = useState<'sign_in' | 'sign_up'>(getInitialEmailMode(initialMode))
  const [isResetMode, setIsResetMode] = useState(initialMode === 'forgot_password')
  const [phoneRecoveryAfterOtp, setPhoneRecoveryAfterOtp] = useState(false)

  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState<OtpStep>('input')

  const [termsAgreed, setTermsAgreed] = useState(false)
  const [consentError, setConsentError] = useState<string | null>(null)
  const [otpCooldown, setOtpCooldown] = useState(0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const emailValue = email.trim()
  const phoneValue = phone.trim()
  const phoneDigits = phoneValue.replace(/\D/g, '')
  const isPhone = phoneDigits.length >= 11
  const formattedPhone = isPhone ? toE164(phoneValue) : ''
  const isPhoneMethod = method === 'phone'
  const isLegacyEmailLogin = isPhoneMethod && emailMode === 'sign_in' && isEmailIdentifier(phoneValue)
  const isPhoneSignUpEmail = isPhoneMethod && emailMode === 'sign_up' && isEmailIdentifier(phoneValue)
  const isSignUpPhoneIdentifier = emailMode === 'sign_up' && !!emailValue && !isEmailIdentifier(emailValue)
  const showPasswordField = !isResetMode && !isPhoneMethod && !(emailMode === 'sign_up' && isSignUpPhoneIdentifier)
  const requiresConsent = (isPhoneMethod && !phoneRecoveryAfterOtp && !isLegacyEmailLogin) || (emailMode === 'sign_up' && !isResetMode && !isPhoneMethod)
  const showConsent = requiresConsent && (isPhoneMethod ? otpStep === 'input' : true)
  const passwordIdentifierLabel = '手机号'
  const passwordIdentifierPlaceholder = '请输入手机号'

  const resolvedTitle = otpStep === 'verify' && isPhoneMethod ? '输入验证码' : title ?? (
    phoneRecoveryAfterOtp
      ? '短信验证'
      : otpStep === 'verify' && isPhoneMethod
        ? '输入验证码'
        : isResetMode
          ? '找回密码'
          : isPhoneMethod
            ? (emailMode === 'sign_up' ? '手机号注册' : '手机号登录')
            : emailMode === 'sign_in'
              ? '手机号登录'
              : '手机号注册'
  )
  const resolvedDescription = otpStep === 'verify' && isPhoneMethod ? null : description?.trim() || (isPhoneMethod
    ? (phoneRecoveryAfterOtp
      ? '验证后设置新密码。'
      : otpStep === 'verify'
        ? null
        : '未注册手机号验证后自动注册')
    : isResetMode
      ? '输入手机号找回账号。'
      : null)
  const resolveSuccessTarget = (isNewUser: boolean) =>
    nextPath ?? getSafeNextPath(isNewUser || emailMode === 'sign_up' ? PLATFORM_ONBOARDING_HREF : '/')
  const titleId = presentation === 'page' ? 'auth-page-title' : 'auth-layer-title'
  const descriptionId = resolvedDescription
    ? (presentation === 'page' ? 'auth-page-description' : 'auth-layer-description')
    : undefined

  useEffect(() => {
    if (otpCooldown <= 0) return
    const timer = window.setInterval(() => {
      setOtpCooldown((current) => (current <= 1 ? 0 : current - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [otpCooldown])

  useEffect(() => {
    if (phoneRecoveryAfterOtp) return
    setError(null)
    setMessage(null)
    setConsentError(null)
  }, [method, emailMode, isResetMode, phoneRecoveryAfterOtp])

  useEffect(() => {
    if (phoneRecoveryAfterOtp) return
    setOtp('')
    setOtpStep('input')
    setError(null)
    setMessage(null)
  }, [phoneValue, phoneRecoveryAfterOtp])

  useEffect(() => {
    if (presentation !== 'page') return
    const authErrorMessage = getAuthErrorMessage()
    if (authErrorMessage) {
      setError(authErrorMessage)
    }
  }, [presentation])

  const requireConsent = () => {
    if (!requiresConsent) return true

    if (!termsAgreed) {
      const nextMessage = '请先同意服务条款和隐私政策。'
      setConsentError(nextMessage)
      toast({
        title: '请先确认使用授权',
        description: nextMessage,
        variant: 'destructive',
      })
      return false
    }

    setConsentError(null)
    return true
  }

  const completeSuccess = (options?: { isNewUser?: boolean }) => {
    if (phoneRecoveryAfterOtp) {
      window.location.href = '/settings/security?mode=recovery'
      return
    }

    if (onSuccess) {
      onSuccess(options)
      return
    }

    window.location.href = resolveSuccessTarget(options?.isNewUser ?? false)
  }

  const handleSendOtp = async (rawPhone = phoneValue) => {
    if (loading) return
    if (!requireConsent()) return
    if (isEmailIdentifier(rawPhone.trim())) {
      setError('请使用手机号获取验证码。')
      return
    }
    const nextFormattedPhone = toE164(rawPhone)
    if (!nextFormattedPhone) {
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
        body: JSON.stringify({ phone: nextFormattedPhone, type: 'login' }),
      })
      const text = await res.text()
      let data: { error?: string } = {}

      try {
        if (text) data = JSON.parse(text)
      } catch {
        logger.warn('[OTP] 响应非 JSON', { preview: text?.slice(0, 200) })
      }

      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : `请求失败 ${res.status}`)
      }

      setMessage(null)
      setOtpCooldown(OTP_COOLDOWN_SECONDS)
      setOtpStep('verify')
      setPhone(rawPhone)
      setMethod('phone')
    } catch (err: unknown) {
      logger.warn('OTP send error', { error: err })
      setError(getOtpErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (loading) return
    if (!requireConsent()) return
    if (!formattedPhone) {
      setError('请输入有效的手机号')
      return
    }
    if (!/^\d{6}$/.test(otp)) {
      setError('请输入 6 位验证码')
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

      const isNewUser = data.isNewUser === true

      if (data.session?.access_token && data.session?.refresh_token) {
        // Notify the browser AuthContext as well as persisting the server cookies.
        const { error: sessionError } = await supabase.auth.setSession(data.session)
        if (sessionError) throw sessionError
        completeSuccess({ isNewUser })
        return
      }

      if (data.tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          type: 'magiclink',
          token_hash: data.tokenHash,
        })

        if (verifyError) throw verifyError
        completeSuccess({ isNewUser })
        return
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl
        return
      }

      completeSuccess({ isNewUser })
    } catch (err: unknown) {
      logger.warn('OTP verify error', { error: err })
      setError(getOtpErrorMessage(err, OTP_VERIFY_FAIL_DEFAULT))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setError(null)
    setMessage(null)

    try {
      if (!emailValue) {
        throw new Error('请输入手机号')
      }

      if (!isEmailIdentifier(emailValue)) {
        const formattedRecoveryPhone = toE164(emailValue)
        if (!formattedRecoveryPhone || formattedRecoveryPhone.replace(/\D/g, '').length < 11) {
          throw new Error('请输入有效的手机号')
        }
        setPhone(emailValue)
        setMethod('phone')
        setIsResetMode(false)
        setEmailMode('sign_in')
        setOtpStep('input')
        setOtp('')
        setPhoneRecoveryAfterOtp(true)
        setMessage('请先完成短信验证。验证后设置新密码。')
        return
      }

      setLoading(true)
      const result = ResetPasswordSchema.safeParse({ email: emailValue })
      if (!result.success) throw new Error(result.error.issues[0].message)

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailValue, {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/settings/security?mode=recovery')}`,
      })

      if (resetError) throw resetError
      setMessage('重置链接已发送，请查收。')
    } catch (err: unknown) {
      logger.warn('Reset password error', { error: err })
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleEmailPasswordAuth = async () => {
    if (emailMode === 'sign_up' && !requireConsent()) return

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (emailMode === 'sign_in') {
        if (!emailValue) throw new Error('请输入手机号')
        if (!password || password.length < 6) throw new Error('密码长度至少需要 6 位。')

        const credentials = isEmailIdentifier(emailValue)
          ? { email: emailValue, password }
          : { phone: toE164(emailValue), password }

        if ('phone' in credentials && !credentials.phone) {
          throw new Error('请输入有效的手机号')
        }

        const { error: signInError } = await supabase.auth.signInWithPassword(credentials)

        if (signInError) throw signInError
        completeSuccess()
        return
      }

      if (!emailValue) throw new Error('请输入手机号')
      if (isEmailIdentifier(emailValue)) {
        throw new Error('注册请使用手机号。')
      }

      const formattedSignUpPhone = toE164(emailValue)
      if (!formattedSignUpPhone) throw new Error('请输入有效的手机号')
      setPhone(emailValue)
      setOtp('')
      setOtpStep('input')
      await handleSendOtp(emailValue)
    } catch (err: unknown) {
      logger.warn('Email auth error', { error: err })
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleEmailPasswordAuthFromValue = async (identifier: string) => {
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (!identifier) throw new Error('请输入手机号')
      if (!isEmailIdentifier(identifier)) throw new Error('请输入有效的手机号')
      if (!password || password.length < 6) throw new Error('密码长度至少需要 6 位。')

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: identifier,
        password,
      })

      if (signInError) throw signInError
      completeSuccess()
    } catch (err: unknown) {
      logger.warn('Legacy email auth error', { error: err })
      setError(getFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    if (isPhoneMethod) {
      if (isLegacyEmailLogin) {
        await handleEmailPasswordAuthFromValue(phoneValue)
        return
      }
      if (isPhoneSignUpEmail) {
        setError('注册请使用手机号。')
        return
      }
      if (otpStep === 'input') {
        await handleSendOtp()
      } else {
        await handleVerifyOtp()
      }
      return
    }

    if (isResetMode) {
      await handleResetPassword()
      return
    }

    await handleEmailPasswordAuth()
  }

  const switchEmailMode = (nextMode: 'sign_in' | 'sign_up') => {
    setMethod('email')
    setEmailMode(nextMode)
    setIsResetMode(false)
    setError(null)
    setMessage(null)
    setPhoneRecoveryAfterOtp(false)
  }

  return (
    <div className={cn(
      'relative overflow-hidden border bg-card shadow-[0_24px_70px_-48px_hsl(var(--surface-shadow)/0.44)]',
      presentation === 'page'
        ? 'mx-auto w-full max-w-md rounded-(--radius-lg) lg:max-w-none'
        : 'rounded-t-xl border-b-0 md:rounded-xl md:border-b'
    )}>
      <div className={cn(
        'relative',
        presentation === 'page'
          ? 'p-6 sm:p-8'
          : 'max-h-[92dvh] overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:p-8'
      )}>
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 id={titleId} className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {resolvedTitle}
              </h1>
              {resolvedDescription && (
                <p id={descriptionId} className="max-w-136 text-sm leading-6 text-muted-foreground">
                  {resolvedDescription}
                </p>
              )}
            </div>

            <Button
              type="button"
              onClick={presentation === 'page' ? onBack : onClose}
              variant="ghost"
              size="icon"
              aria-label={presentation === 'page' ? '返回' : '关闭登录层'}
              className="h-11 w-11 shrink-0 text-foreground/82 hover:bg-muted"
            >
              {presentation === 'page' ? <ArrowLeft className="h-4 w-4" /> : <X className="h-5 w-5" />}
            </Button>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-destructive/25 bg-background p-4 text-destructive">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm leading-6">{error}</p>
              </div>
            </div>
          )}

          {message && (
            <p className="text-sm leading-6 text-muted-foreground">{message}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" aria-labelledby={titleId} aria-describedby={descriptionId}>
            {isPhoneMethod ? (
              <>
                {otpStep === 'input' ? (
                  <div className="space-y-2">
                    <label htmlFor={`${presentation}-phone`} className="sr-only">手机号</label>
                    <div className="relative">
                      <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id={`${presentation}-phone`}
                        type="text"
                        inputMode="tel"
                        autoComplete="username"
                        placeholder="请输入手机号"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        disabled={loading}
                        className="h-12 rounded-md border-border/80 bg-background pl-10 text-base"
                        required
                      />
                    </div>
                  </div>
                ) : null}

                {isLegacyEmailLogin ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <label htmlFor={`${presentation}-legacy-password`} className="text-sm font-medium text-foreground/86">密码</label>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail(phoneValue)
                          setMethod('email')
                          setIsResetMode(true)
                          setError(null)
                          setMessage(null)
                        }}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        忘记密码
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id={`${presentation}-legacy-password`}
                        type="password"
                        placeholder="请输入至少 6 位密码"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        minLength={6}
                        className="h-12 rounded-md border-border/80 bg-background pl-10 text-base"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  null
                )}

                {otpStep === 'verify' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <p className="text-muted-foreground">已发送到 {phoneValue}</p>
                      <button
                        type="button"
                        aria-label="修改手机号"
                        disabled={loading}
                        onClick={() => {
                          setOtpStep('input')
                          setOtp('')
                          setMessage(null)
                          setError(null)
                        }}
                        className="inline-flex min-h-11 items-center gap-1 rounded-sm px-2 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        修改手机号
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor={`${presentation}-otp`} className="text-sm font-medium text-foreground/86">验证码</label>
                      <Input
                        id={`${presentation}-otp`}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="请输入 6 位验证码"
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="h-12 rounded-md border-border/80 bg-background text-[16px] tracking-[0.28em]"
                        maxLength={6}
                        minLength={6}
                        pattern="[0-9]{6}"
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        disabled={otpCooldown > 0 || loading}
                        className="min-h-11 text-sm font-medium text-primary disabled:text-muted-foreground"
                      >
                        {otpCooldown > 0 ? `${otpCooldown}s 后重发` : '重新发送'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {!isResetMode && !isPhoneMethod && (
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/80 bg-muted p-1">
                    <button
                      type="button"
                      onClick={() => switchEmailMode('sign_in')}
                      className={cn(
                        'rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                        emailMode === 'sign_in'
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      登录
                    </button>
                    <button
                      type="button"
                      onClick={() => switchEmailMode('sign_up')}
                      className={cn(
                        'rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                        emailMode === 'sign_up'
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      注册
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor={`${presentation}-email`} className="text-sm font-medium text-foreground/86">{passwordIdentifierLabel}</label>
                  <div className="relative">
                    {emailMode === 'sign_up' || isResetMode ? (
                      <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    ) : (
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    )}
                    <Input
                      id={`${presentation}-email`}
                      type="text"
                      inputMode="tel"
                      autoComplete="username"
                      placeholder={passwordIdentifierPlaceholder}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-12 rounded-md border-border/80 bg-background pl-10 text-base"
                      required
                    />
                  </div>
                </div>

                {showPasswordField && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <label htmlFor={`${presentation}-password`} className="text-sm font-medium text-foreground/86">密码</label>
                      {emailMode === 'sign_in' && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsResetMode(true)
                            setError(null)
                            setMessage(null)
                          }}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          忘记密码
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id={`${presentation}-password`}
                        type="password"
                        placeholder="请输入至少 6 位密码"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete={emailMode === 'sign_in' ? 'current-password' : 'new-password'}
                        minLength={6}
                        className="h-12 rounded-md border-border/80 bg-background pl-10 text-base"
                        required
                      />
                    </div>
                  </div>
                )}

                {emailMode === 'sign_up' && isSignUpPhoneIdentifier && !isResetMode && (
                  <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-background px-4 py-3 text-xs leading-5 text-muted-foreground shadow-xs">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    手机号注册免密码，验证码完成。
                  </div>
                )}

                {isResetMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(false)
                      setError(null)
                      setMessage(null)
                    }}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    返回密码登录
                  </button>
                )}
              </>
            )}

            {showConsent && (
              <div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id={`${presentation}-terms`}
                    checked={termsAgreed}
                    onCheckedChange={(checked) => {
                      setTermsAgreed(checked === true)
                      if (checked === true) setConsentError(null)
                    }}
                    className="mt-0.5"
                  />
                  <label htmlFor={`${presentation}-terms`} className="text-xs leading-6 text-muted-foreground">
                    我已阅读并同意
                    <Link href="/legal/terms" className="whitespace-nowrap text-primary hover:underline">《服务条款》</Link>
                    和
                    <Link href="/legal/privacy" className="whitespace-nowrap text-primary hover:underline">《隐私政策》</Link>
                  </label>
                </div>
                {consentError && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {consentError}
                  </p>
                )}
              </div>
            )}

            <Button type="submit" shape="soft" className="h-12 w-full text-base font-semibold" disabled={loading || (isPhoneMethod && !isLegacyEmailLogin && (otpStep === 'verify' ? otp.length !== 6 : otpCooldown > 0))}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : isLegacyEmailLogin ? (
                '登录'
              ) : isPhoneMethod ? (
                otpStep === 'input' ? (otpCooldown > 0 ? `${otpCooldown}s 后重新获取` : '获取验证码') : '验证并继续'
              ) : isResetMode ? (
                '继续找回密码'
              ) : emailMode === 'sign_in' ? (
                '登录'
              ) : isSignUpPhoneIdentifier ? (
                '获取验证码'
              ) : (
                '注册'
              )}
            </Button>
          </form>

        </div>
      </div>
    </div>
  )
}
