'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Pencil,
  ShieldCheck,
  Smartphone,
  KeyRound,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { sanitizeInternalHref } from '@/lib/utils/safe-internal-href'
import { logger } from '@/lib/logger'
import { PLATFORM_ONBOARDING_HREF } from '@/lib/product/onboarding'
import { ResetPasswordSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toE164 } from '@/lib/utils/phone'
import {
  clearPendingOtp,
  OTP_COOLDOWN_SECONDS,
  readPendingOtp,
  savePendingOtp,
  type RestoredPendingOtp,
} from '@/lib/auth/pending-otp'

const OTP_SEND_FAIL_DEFAULT = '发送验证码失败，请检查手机号或稍后重试。'
const OTP_VERIFY_FAIL_DEFAULT = '验证失败，请检查验证码是否正确。'

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

function getAuthPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!/^(?:86)?1\d{10}$/.test(digits) || /[^\d+\s()-]/.test(value)) return ''
  return toE164(value)
}

/** Restore pending SMS OTP after the login dialog unmounts (sessionStorage). */
function readBootPendingOtp(initialMode: AuthMode): RestoredPendingOtp | null {
  if (initialMode === 'forgot_password') return null
  return readPendingOtp()
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
  const activeRef = useRef(true)
  useEffect(() => {
    activeRef.current = true
    return () => { activeRef.current = false }
  }, [])

  const [bootPending] = useState(() => readBootPendingOtp(initialMode))
  const [method, setMethod] = useState<AuthMethod>(
    initialMode === 'forgot_password' ? 'email' : (bootPending ? 'phone' : initialMethod),
  )
  const [emailMode, setEmailMode] = useState<'sign_in' | 'sign_up'>(getInitialEmailMode(initialMode))
  const [isResetMode, setIsResetMode] = useState(initialMode === 'forgot_password')
  const [phoneRecoveryAfterOtp, setPhoneRecoveryAfterOtp] = useState(false)

  const [phone, setPhone] = useState(() => bootPending?.displayPhone ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState<OtpStep>(() => (bootPending ? 'verify' : 'input'))

  const [termsAgreed, setTermsAgreed] = useState(() => bootPending?.termsAgreed ?? false)
  const [consentOpen, setConsentOpen] = useState(false)
  const [consentActionLabel, setConsentActionLabel] = useState('获取验证码')
  const consentActionRef = useRef<(() => void) | null>(null)
  const consentReturnFocusRef = useRef<HTMLElement | null>(null)
  const consentCancelRef = useRef<HTMLButtonElement>(null)
  const consentContinuingRef = useRef(false)
  const [otpCooldown, setOtpCooldown] = useState(() => bootPending?.cooldownSeconds ?? 0)
  const [otpSentPhone, setOtpSentPhone] = useState(() => bootPending?.phone ?? '')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const emailValue = email.trim()
  const phoneValue = phone.trim()
  const formattedPhone = getAuthPhone(phoneValue)
  const isPhoneMethod = method === 'phone'
  const isPhoneSignUpEmail = isPhoneMethod && emailMode === 'sign_up' && isEmailIdentifier(phoneValue)
  const isSignUpPhoneIdentifier = emailMode === 'sign_up' && !!emailValue && !isEmailIdentifier(emailValue)
  const showPasswordField = !isResetMode && !isPhoneMethod && !(emailMode === 'sign_up' && isSignUpPhoneIdentifier)
  const requiresConsent = (isPhoneMethod && !phoneRecoveryAfterOtp) || (emailMode === 'sign_up' && !isResetMode && !isPhoneMethod)
  const showConsent = requiresConsent && (isPhoneMethod ? otpStep === 'input' || !termsAgreed : true)
  const passwordIdentifierLabel = '手机号'
  const passwordIdentifierPlaceholder = '请输入手机号'

  const resolvedTitle = otpStep === 'verify' && isPhoneMethod ? '输入验证码'
    : isResetMode ? '找回密码'
      : phoneRecoveryAfterOtp ? '短信验证'
        : title ?? (isPhoneMethod ? (emailMode === 'sign_up' ? '手机号注册' : '手机号登录') : '密码登录')
  const resolvedDescription = phoneRecoveryAfterOtp ? '验证后设置新密码。'
    : isResetMode ? '验证手机号后设置新密码。'
      : otpStep === 'verify' && isPhoneMethod ? null
        : description?.trim() || (isPhoneMethod ? '未注册手机号验证后自动注册' : '已设置密码的账号可直接登录。')
  const resolveSuccessTarget = (isNewUser: boolean) =>
    sanitizeInternalHref(nextPath, getSafeNextPath(isNewUser || emailMode === 'sign_up' ? PLATFORM_ONBOARDING_HREF : '/'))
  const getRecoveryHref = () => {
    const returnTo = nextPath ?? (presentation === 'layer'
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
      : getSafeNextPath())
    return `/settings/security?mode=recovery&next=${encodeURIComponent(sanitizeInternalHref(returnTo))}`
  }
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
  }, [method, emailMode, isResetMode, phoneRecoveryAfterOtp])

  useEffect(() => {
    if (phoneRecoveryAfterOtp) return
    // Keep verify UI while the typed phone still matches the number we already sent to
    // (also protects session restore on remount — otherwise the first effect pass resets to input).
    if (otpSentPhone && getAuthPhone(phoneValue) === otpSentPhone) return
    setOtp('')
    setOtpStep('input')
    setError(null)
    setMessage(null)
  }, [phoneValue, phoneRecoveryAfterOtp, otpSentPhone])

  useEffect(() => {
    if (presentation !== 'page') return
    const authErrorMessage = getAuthErrorMessage()
    if (authErrorMessage) {
      setError(authErrorMessage)
    }
  }, [presentation])

  const requireConsent = (continueAction: () => void, actionLabel: string, confirmed = false) => {
    if (!requiresConsent || termsAgreed || confirmed) return true
    if (consentActionRef.current) return false
    consentActionRef.current = continueAction
    consentReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    consentContinuingRef.current = false
    setConsentActionLabel(actionLabel)
    setConsentOpen(true)
    return false
  }

  const closeConsent = (open: boolean) => {
    setConsentOpen(open)
    if (!open) consentActionRef.current = null
  }

  const confirmConsent = () => {
    const continueAction = consentActionRef.current
    if (!continueAction) return
    consentActionRef.current = null
    consentContinuingRef.current = true
    setTermsAgreed(true)
    setConsentOpen(false)
    // Continue the same action; React has not committed the checked state yet.
    continueAction()
  }

  const completeSuccess = (options?: { isNewUser?: boolean }) => {
    if (!activeRef.current) return
    clearPendingOtp()

    if (phoneRecoveryAfterOtp) {
      window.location.href = getRecoveryHref()
      return
    }

    if (onSuccess) {
      onSuccess(options)
      return
    }

    window.location.href = resolveSuccessTarget(options?.isNewUser ?? false)
  }

  const handleSendOtp = async (rawPhone = phoneValue, consentConfirmed = false) => {
    if (loading) return
    if (isEmailIdentifier(rawPhone.trim())) {
      setError('请使用手机号获取验证码。')
      return
    }
    const nextFormattedPhone = getAuthPhone(rawPhone)
    if (!nextFormattedPhone) {
      setError('请输入有效的手机号')
      return
    }
    if (otpCooldown > 0) return
    if (!requireConsent(() => void handleSendOtp(rawPhone, true), '获取验证码', consentConfirmed)) return

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
      setOtpSentPhone(nextFormattedPhone)
      setOtpStep('verify')
      setPhone(rawPhone)
      setMethod('phone')
      savePendingOtp({
        phone: nextFormattedPhone,
        displayPhone: rawPhone.trim(),
        sentAt: Date.now(),
        termsAgreed: true,
      })
    } catch (err: unknown) {
      logger.warn('OTP send error', { error: err })
      setError(getOtpErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (consentConfirmed = false) => {
    if (loading) return
    if (!formattedPhone) {
      setError('请输入有效的手机号')
      return
    }
    if (!/^\d{6}$/.test(otp)) {
      setError('请输入 6 位验证码')
      return
    }
    if (!requireConsent(() => void handleVerifyOtp(true), '验证登录', consentConfirmed)) return

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

      if (!activeRef.current) return

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
        // A document redirect cannot carry in-memory drafts or callbacks. Keep
        // the layer and explain retry instead of silently losing the activity.
        if (presentation === 'layer') throw new Error('登录会话未建立，请重试；当前页面内容已保留。')
        const redirectUrl = new URL(data.redirectUrl)
        if (!['https:', 'http:'].includes(redirectUrl.protocol)) throw new Error('登录链接无效，请重新验证。')
        redirectUrl.searchParams.set('redirect_to', `${window.location.origin}${phoneRecoveryAfterOtp ? getRecoveryHref() : resolveSuccessTarget(isNewUser)}`)
        window.location.href = redirectUrl.toString()
        return
      }

      throw new Error('登录会话建立失败，请重新验证。')
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
        const formattedRecoveryPhone = getAuthPhone(emailValue)
        if (!formattedRecoveryPhone) {
          throw new Error('请输入有效的手机号')
        }
        setPhone(emailValue)
        setMethod('phone')
        setIsResetMode(false)
        setEmailMode('sign_in')
        const canResumeOtp = otpCooldown > 0 && otpSentPhone === formattedRecoveryPhone
        setOtpStep(canResumeOtp ? 'verify' : 'input')
        setOtp('')
        setPhoneRecoveryAfterOtp(true)
        if (!canResumeOtp) await handleSendOtp(emailValue)
        return
      }

      setLoading(true)
      const result = ResetPasswordSchema.safeParse({ email: emailValue })
      if (!result.success) throw new Error(result.error.issues[0].message)

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailValue, {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getRecoveryHref())}`,
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

  const handleEmailPasswordAuth = async (consentConfirmed = false) => {
    if (emailMode === 'sign_up' && !requireConsent(() => void handleEmailPasswordAuth(true), '继续注册', consentConfirmed)) return

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (emailMode === 'sign_in') {
        if (!emailValue) throw new Error('请输入手机号')
        if (!password || password.length < 6) throw new Error('密码长度至少需要 6 位。')

        const credentials = isEmailIdentifier(emailValue)
          ? { email: emailValue, password }
          : { phone: getAuthPhone(emailValue), password }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    if (isPhoneMethod) {
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

  const switchLoginMethod = (nextMethod: AuthMethod) => {
    if (loading) return
    if (nextMethod === method && !isResetMode && !phoneRecoveryAfterOtp) return
    const identifier = isPhoneMethod ? phoneValue : emailValue
    if (nextMethod === 'email') setEmail(identifier)
    else setPhone(isEmailIdentifier(identifier) ? '' : identifier)
    setMethod(nextMethod)
    setEmailMode('sign_in')
    setIsResetMode(false)
    setError(null)
    setMessage(null)
    setPhoneRecoveryAfterOtp(false)
    setPassword('')
    setShowPassword(false)
    setOtp('')
    setOtpStep(nextMethod === 'phone' && otpCooldown > 0 && otpSentPhone === getAuthPhone(identifier) ? 'verify' : 'input')
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
            <div className="min-w-0 space-y-1.5">
              <h1 id={titleId} className={cn('font-sans font-semibold tracking-tight text-foreground', presentation === 'layer' ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl')}>
                {resolvedTitle}
              </h1>
              {resolvedDescription && (
                <p id={descriptionId} className="max-w-136 text-sm leading-5 text-muted-foreground text-pretty">
                  {resolvedDescription}
                </p>
              )}
            </div>

            {presentation === 'page' ? (
              <Button
                type="button"
                onClick={onBack}
                variant="ghost"
                size="icon"
                aria-label="返回"
                className="-mr-2 -mt-1.5 h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                aria-label="先去探索，关闭登录层"
                className="-mr-2 -mt-1 inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-border"
              >
                先去探索
              </button>
            )}
          </div>

          {!isResetMode && !phoneRecoveryAfterOtp && (
            <div role="group" aria-label="登录方式" className="grid grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1 dark:bg-muted/50">
              {([['phone', '验证码登录'], ['email', '密码登录']] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={method === value} disabled={loading} onClick={() => switchLoginMethod(value)} className={cn('h-10 rounded-lg px-3 text-sm transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60', method === value ? 'bg-background font-semibold text-foreground shadow-sm ring-1 ring-border/60 dark:bg-card dark:ring-white/10' : 'font-medium text-muted-foreground hover:text-foreground')}>
                  {label}
                </button>
              ))}
            </div>
          )}

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
                        className="h-12 rounded-xl border-border bg-background shadow-none transition-colors focus-visible:border-primary/60 dark:bg-muted/30 pl-10 text-base"
                        required
                      />
                    </div>
                  </div>
                ) : null}

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
                        disabled={loading}
                        className="h-12 rounded-xl border-border bg-background shadow-none transition-colors focus-visible:border-primary/60 dark:bg-muted/30 text-[16px] tracking-[0.28em]"
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
                      disabled={loading}
                      className="h-12 rounded-xl border-border bg-background shadow-none transition-colors focus-visible:border-primary/60 dark:bg-muted/30 pl-10 text-base"
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
                          disabled={loading}
                          onClick={() => {
                            setIsResetMode(true)
                            setError(null)
                            setMessage(null)
                          }}
                          className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline disabled:opacity-60"
                        >
                          忘记密码
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id={`${presentation}-password`}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请输入至少 6 位密码"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={loading}
                        autoComplete={emailMode === 'sign_in' ? 'current-password' : 'new-password'}
                        minLength={6}
                        className="h-12 rounded-xl border-border bg-background shadow-none transition-colors focus-visible:border-primary/60 dark:bg-muted/30 pl-10 pr-12 text-base"
                        required
                      />
                      <button type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword} disabled={loading} onClick={() => setShowPassword((current) => !current)} className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
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
                      switchLoginMethod('email')
                    }}
                    disabled={loading}
                    className="min-h-11 text-sm font-medium text-primary hover:underline disabled:opacity-60"
                  >
                    返回密码登录
                  </button>
                )}
              </>
            )}

            {showConsent && (
              <div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`${presentation}-terms`}
                    checked={termsAgreed}
                    disabled={loading}
                    onCheckedChange={(checked) => {
                      setTermsAgreed(checked === true)
                    }}
                    className="shrink-0"
                  />
                  <label htmlFor={`${presentation}-terms`} className="text-xs leading-5 text-muted-foreground">
                    我已阅读并同意
                    <Link href="/legal/terms" className="whitespace-nowrap text-primary hover:underline">《服务条款》</Link>
                    和
                    <Link href="/legal/privacy" className="whitespace-nowrap text-primary hover:underline">《隐私政策》</Link>
                  </label>
                </div>
              </div>
            )}

            <Button type="submit" shape="soft" className="h-12 w-full rounded-xl text-base font-semibold shadow-sm" disabled={loading || (isPhoneMethod && (otpStep === 'verify' ? otp.length !== 6 : otpCooldown > 0))}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
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

          {phoneRecoveryAfterOtp && (
            <button type="button" disabled={loading} onClick={() => switchLoginMethod('email')} className="min-h-11 text-sm font-medium text-primary hover:underline disabled:opacity-60">
              返回密码登录
            </button>
          )}
        </div>
      </div>
      <Dialog open={consentOpen} onOpenChange={closeConsent}>
        <DialogPortal>
          <DialogOverlay className="z-100 bg-slate-950/45" />
        </DialogPortal>
        <DialogContent
          role="alertdialog"
          hideOverlay
          hideCloseButton
          className="z-110 w-[calc(100%-2rem)] max-w-sm rounded-xl p-6"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            consentCancelRef.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (!consentContinuingRef.current) consentReturnFocusRef.current?.focus()
          }}
        >
          <DialogTitle>请确认服务协议</DialogTitle>
          <DialogDescription className="text-sm leading-6">
            请阅读
            <Link href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">《服务条款》</Link>
            和
            <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">《隐私政策》</Link>
            。点击「同意并继续」将勾选同意，并{consentActionLabel}。
          </DialogDescription>
          <div className="grid grid-cols-2 gap-3">
            <Button ref={consentCancelRef} type="button" variant="outline" className="h-11" onClick={() => closeConsent(false)}>取消</Button>
            <Button type="button" className="h-11" onClick={confirmConsent}>同意并继续</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
