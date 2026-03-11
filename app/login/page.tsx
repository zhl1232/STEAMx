'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toE164 } from '@/lib/utils/phone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, Mail, Lock } from 'lucide-react'
import Link from 'next/link'
import { LoginSchema, ResetPasswordSchema } from '@/lib/schemas'
import { cn } from '@/lib/utils'

const OTP_SEND_FAIL_DEFAULT = '发送验证码失败，请检查手机号或稍后重试。'
const OTP_VERIFY_FAIL_DEFAULT = '验证失败，请检查验证码是否正确。'
const OTP_COOLDOWN_SECONDS = 60

/** 将 OTP 相关错误转为用户可读文案 */
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

type AuthView = 'sign_in' | 'sign_up' | 'forgot_password'
export default function LoginPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [view, setView] = useState<AuthView>('sign_in')
  const [useOtpLogin, setUseOtpLogin] = useState(false)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState<'input' | 'verify'>('input')

  const [termsAgreed, setTermsAgreed] = useState(false)
  const [checkboxShake, setCheckboxShake] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // 获取验证码倒计时
  useEffect(() => {
    if (otpCooldown <= 0) return
    const t = setInterval(() => setOtpCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(t)
  }, [otpCooldown])

  const identifierValue = identifier.trim()
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifierValue)
  const phoneDigits = identifierValue.replace(/\D/g, '')
  const isPhoneInput = !isEmail && phoneDigits.length >= 11
  const formattedPhone = isPhoneInput ? toE164(identifierValue) : ''
  const isPhone = !!formattedPhone
  const otpMode = isPhone && (view !== 'sign_in' || useOtpLogin)

  useEffect(() => {
    setOtp('')
    setOtpStep('input')
  }, [identifierValue, view, useOtpLogin])

  const requireTermsAgreed = (_action: 'send_otp' | 'submit'): boolean => {
    if (termsAgreed) return true
    toast({
      title: '请先同意条款',
      description: '请勾选「我已阅读并同意《服务条款》和《隐私政策》」后再继续。',
      variant: 'destructive',
    })
    setCheckboxShake(true)
    setTimeout(() => setCheckboxShake(false), 500)
    return false
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (view !== 'forgot_password' && !requireTermsAgreed('send_otp')) return
    if (otpCooldown > 0) return
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
      const text = await res.text()
      let data: { error?: string } = {}
      try {
        if (text) data = JSON.parse(text)
      } catch {
        if (process.env.NODE_ENV === 'development') console.warn('[OTP] 响应非 JSON:', text?.slice(0, 200))
      }
      if (!res.ok) {
        const msg = (data && typeof data.error === 'string') ? data.error : `请求失败 ${res.status}`
        throw new Error(msg)
      }
      setMessage('验证码已发送，请输入收到的短信验证码。')
      setOtpCooldown(OTP_COOLDOWN_SECONDS)
      setOtpStep('verify')
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('OTP send error:', err)
      setError(getOtpErrorMessage(err))
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
        body: JSON.stringify({
          phone: formattedPhone,
          code: otp,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '验证失败')
      if (data.tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          type: 'magiclink',
          token_hash: data.tokenHash,
        })
        if (verifyError) throw verifyError
        window.location.href = data.redirectTo || '/'
        return
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl
        return
      }
      window.location.href = data.redirectTo || '/'
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('OTP verify error:', err)
      setError(getOtpErrorMessage(err, OTP_VERIFY_FAIL_DEFAULT))
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (view === 'forgot_password') {
      if (isEmail) {
        setLoading(true)
        setError(null)
        setMessage(null)
        try {
          const result = ResetPasswordSchema.safeParse({ email: identifierValue })
          if (!result.success) throw new Error(result.error.issues[0].message)
          const { error } = await supabase.auth.resetPasswordForEmail(identifierValue, {
            redirectTo: `${window.location.origin}/auth/callback?next=/profile/reset-password`,
          })
          if (error) throw error
          setMessage('重置密码链接已发送到你的邮箱，请查收。')
        } catch (err: unknown) {
          if (process.env.NODE_ENV === 'development') console.error('Auth error:', err)
          const msg = err instanceof Error ? err.message : 'Unknown error'
          setError(msg || '发生错误，请稍后重试。')
        } finally {
          setLoading(false)
        }
        return
      }
      if (otpMode) {
        if (otpStep === 'input') {
          await handleSendOtp(e)
        } else {
          await handleVerifyOtp(e)
        }
        return
      }
      setError('请输入有效的邮箱或手机号')
      return
    }

    if (otpMode) {
      if (!requireTermsAgreed('submit')) return
      if (otpStep === 'input') {
        await handleSendOtp(e)
      } else {
        await handleVerifyOtp(e)
      }
      return
    }

    if (!requireTermsAgreed('submit')) return

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isEmail) {
        if (view === 'sign_in') {
          const result = LoginSchema.safeParse({ email: identifierValue, password })
          if (!result.success) throw new Error(result.error.issues[0].message)
          const { error } = await supabase.auth.signInWithPassword({ email: identifierValue, password })
          if (error) throw error
          window.location.href = '/'
          return
        }
        if (view === 'sign_up') {
          const result = LoginSchema.safeParse({ email: identifierValue, password })
          if (!result.success) throw new Error(result.error.issues[0].message)
          const username = `user_${Math.random().toString(36).slice(2, 10)}`
          const { error } = await supabase.auth.signUp({
            email: identifierValue,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
              data: { username, full_name: identifierValue.split('@')[0] },
            },
          })
          if (error) throw error
          setMessage('注册成功！请检查你的邮箱以确认账号。')
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            window.location.href = '/'
            return
          }
        }
      } else if (isPhone) {
        if (view === 'sign_in') {
          if (!password) throw new Error('请输入密码或使用短信验证码登录')
          const { error } = await supabase.auth.signInWithPassword({ phone: formattedPhone, password })
          if (error) throw error
          window.location.href = '/'
          return
        }
        setError('手机号注册请使用短信验证码')
      } else {
        setError('请输入有效的邮箱或手机号')
      }
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('Auth error:', err)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg === 'Invalid login credentials') setError('账号或密码错误，请重试。')
      else if (msg.includes('User already registered')) setError('该邮箱已被注册，请直接登录。')
      else if (msg.includes('Password should be at least')) setError('密码长度至少需要 6 位。')
      else setError(msg || '发生错误，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  const toggleView = (v: AuthView) => {
    setView(v)
    setError(null)
    setMessage(null)
    setUseOtpLogin(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      <div className="w-full max-w-md">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
        </Link>

        <div className="bg-card rounded-lg border shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">
              {view === 'sign_in' && '欢迎回来'}
              {view === 'sign_up' && '加入我们'}
              {view === 'forgot_password' && '重置密码'}
            </h1>
            <p className="text-muted-foreground">
              {view === 'sign_in' && '登录 STEAM 探索，继续探索之旅'}
              {view === 'sign_up' && '创建账号，开始你的创意之旅'}
              {view === 'forgot_password' && '输入邮箱或手机号，我们将发送重置邮件或短信验证码'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-md bg-destructive/10 border border-destructive/20 flex items-start gap-3 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
          {message && (
            <div className="mb-6 p-4 rounded-md bg-green-500/10 border border-green-500/20 flex items-start gap-3 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{message}</p>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-muted-foreground">邮箱或手机号</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="name@example.com / 13800138000"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              {view === 'forgot_password' && (
                <p className="text-xs text-muted-foreground">
                  邮箱将发送重置邮件，手机号将发送验证码直接登录。
                </p>
              )}
            </div>

            {view !== 'forgot_password' && !otpMode && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium leading-none text-muted-foreground">密码</label>
                  {view === 'sign_in' && (
                    <button type="button" onClick={() => toggleView('forgot_password')} className="text-sm text-primary hover:underline">
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
                    required={view !== 'sign_up' || isEmail}
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
                {otpStep === 'verify' ? (
                  <>
                    <label className="text-sm font-medium leading-none text-muted-foreground">短信验证码</label>
                    <div className="flex rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="请输入验证码"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        className="flex-1 min-w-0 h-10 px-3 text-sm outline-none placeholder:text-muted-foreground"
                        maxLength={6}
                        autoComplete="one-time-code"
                      />
                      <span className="h-10 w-px bg-border" aria-hidden />
                      <button
                        type="button"
                        disabled={otpCooldown > 0 || loading}
                        onClick={handleSendOtp}
                        className="shrink-0 px-4 text-sm font-medium text-primary hover:bg-muted/50 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
                      >
                        {otpCooldown > 0 ? `${otpCooldown}s 后重发` : '重新发送'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>未收到验证码？可重新发送</span>
                      {view === 'sign_in' && (
                        <button type="button" onClick={() => setUseOtpLogin(false)} className="text-primary hover:underline">
                          使用密码登录
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    点击下方按钮获取短信验证码。
                  </p>
                )}
              </div>
            )}

            {/* 合规：条款勾选框 */}
            <div
              className={cn(
                'flex items-start gap-3 py-2',
                checkboxShake && 'animate-[shake_0.4s_ease-in-out]'
              )}
            >
              <Checkbox
                id="terms"
                checked={termsAgreed}
                onCheckedChange={(checked) => setTermsAgreed(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                我已阅读并同意
                <Link href="/legal/terms" className="text-primary hover:underline mx-0.5">《服务条款》</Link>
                和
                <Link href="/legal/privacy" className="text-primary hover:underline mx-0.5">《隐私政策》</Link>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || (otpMode && otpStep === 'input' && otpCooldown > 0)}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : view === 'forgot_password' ? (
                otpMode
                  ? (otpStep === 'input' ? '获取验证码' : '验证并登录')
                  : '发送重置链接'
              ) : otpMode ? (
                otpStep === 'input' ? '获取验证码' : '验证并登录'
              ) : (
                view === 'sign_in' ? '登录' : '注册'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            {view === 'sign_in' && (
              <p className="text-muted-foreground">
                还没有账号？{' '}
                <button type="button" onClick={() => toggleView('sign_up')} className="text-primary hover:underline font-medium">
                  立即注册
                </button>
              </p>
            )}
            {view === 'sign_up' && (
              <p className="text-muted-foreground">
                已有账号？{' '}
                <button type="button" onClick={() => toggleView('sign_in')} className="text-primary hover:underline font-medium">
                  立即登录
                </button>
              </p>
            )}
            {view === 'forgot_password' && (
              <button type="button" onClick={() => toggleView('sign_in')} className="text-primary hover:underline font-medium">
                返回登录
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
