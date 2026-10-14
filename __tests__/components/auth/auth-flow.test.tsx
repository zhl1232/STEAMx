import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthFlow } from '@/components/auth/auth-flow'

const verifyOtpMock = vi.fn()
const signInWithPasswordMock = vi.fn()
const signUpMock = vi.fn()
const getSessionMock = vi.fn()
const resetPasswordForEmailMock = vi.fn()
const setSessionMock = vi.fn()
const toastMock = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      verifyOtp: verifyOtpMock,
      signInWithPassword: signInWithPasswordMock,
      signUp: signUpMock,
      getSession: getSessionMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
      setSession: setSessionMock,
    },
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

describe('AuthFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    global.fetch = vi.fn()
    getSessionMock.mockResolvedValue({ data: { session: null } })
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
  })

  it('defaults to phone SMS login without email prompts', () => {
    render(<AuthFlow presentation="page" />)

    expect(screen.getByRole('heading', { name: '手机号登录' })).toBeInTheDocument()
    expect(screen.getByText('未注册手机号验证后自动注册')).toBeInTheDocument()
    expect(screen.getByLabelText('手机号')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入手机号')).toBeInTheDocument()
    expect(screen.queryByLabelText('密码')).not.toBeInTheDocument()
    expect(screen.queryByText(/邮箱/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '获取验证码' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '密码登录' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('installs the native phone session before completing a modal login', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    const session = { access_token: 'access-token', refresh_token: 'refresh-token' }
    setSessionMock.mockResolvedValue({ error: null })
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      if (String(input).endsWith('/send')) return Response.json({ ok: true })
      return Response.json({ ok: true, isNewUser: false, session })
    })
    render(<AuthFlow presentation="layer" title="登录后继续" description="原场景说明" onSuccess={onSuccess} />)
    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '获取验证码' }))
    expect(await screen.findByRole('heading', { name: '输入验证码' })).toBeInTheDocument()
    expect(screen.queryByText('原场景说明')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '验证并继续' })).toBeDisabled()
    await user.type(screen.getByLabelText('验证码'), '123456')
    await user.click(screen.getByRole('button', { name: '验证并继续' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
    expect(setSessionMock).toHaveBeenCalledWith(session)
    expect(setSessionMock.mock.invocationCallOrder[0]).toBeLessThan(onSuccess.mock.invocationCallOrder[0])
  })

  it('supports internal email test accounts through the explicit password entry without email prompts', async () => {
    const user = userEvent.setup()
    signInWithPasswordMock.mockResolvedValue({ error: null })

    render(<AuthFlow presentation="page" />)

    await user.click(screen.getByRole('button', { name: '密码登录' }))
    expect(screen.queryByText(/邮箱/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: 'student@example.com' } })
    expect(await screen.findByLabelText('密码')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret1' } })
    await user.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: 'student@example.com',
        password: 'secret1',
      })
    })
  })

  it('logs in a phone account with its password and completes the original modal action', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    signInWithPasswordMock.mockResolvedValue({ error: null })
    render(<AuthFlow presentation="layer" onSuccess={onSuccess} />)
    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.click(screen.getByRole('button', { name: '密码登录' }))
    expect(screen.getByLabelText('手机号')).toHaveValue('13800138000')
    expect(screen.queryByText(/邮箱/)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('密码'), 'secret1')
    await user.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
    expect(signInWithPasswordMock).toHaveBeenCalledWith({ phone: '+8613800138000', password: 'secret1' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('lets users inspect a password and keeps it when clicking the selected method', async () => {
    const user = userEvent.setup()
    render(<AuthFlow presentation="page" />)
    await user.click(screen.getByRole('button', { name: '密码登录' }))
    await user.type(screen.getByLabelText('密码'), 'secret1')
    await user.click(screen.getByRole('button', { name: '显示密码' }))
    expect(screen.getByLabelText('密码')).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: '密码登录' }))
    expect(screen.getByLabelText('密码')).toHaveValue('secret1')
    await user.click(screen.getByRole('button', { name: '隐藏密码' }))
    expect(screen.getByLabelText('密码')).toHaveAttribute('type', 'password')
  })

  it('keeps the phone when an incorrect password is replaced by SMS login', async () => {
    const user = userEvent.setup()
    signInWithPasswordMock.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    render(<AuthFlow presentation="page" />)
    await user.click(screen.getByRole('button', { name: '密码登录' }))
    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.type(screen.getByLabelText('密码'), 'secret1')
    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('账号或密码错误，请重试。')
    expect(screen.queryByText('还没设置密码？用验证码登录')).not.toBeInTheDocument()
    expect(screen.queryByText('验证码登录后，可在「账号与安全」设置密码。')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '验证码登录' }))
    expect(screen.getByLabelText('手机号')).toHaveValue('13800138000')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('密码')).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('resumes the existing SMS code after switching to password and back without sending again', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(Response.json({ ok: true }))
    render(<AuthFlow presentation="page" />)
    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '获取验证码' }))
    expect(await screen.findByLabelText('验证码')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '密码登录' }))
    await user.click(screen.getByRole('button', { name: '验证码登录' }))
    expect(screen.getByLabelText('验证码')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /后重发/ })).toBeDisabled()
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('keeps the SMS verify step after closing and reopening the login layer', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(Response.json({ ok: true }))
    const { unmount } = render(<AuthFlow presentation="layer" title="登录后继续" />)
    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '获取验证码' }))
    expect(await screen.findByRole('heading', { name: '输入验证码' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /后重发/ })).toBeDisabled()
    unmount()

    render(<AuthFlow presentation="layer" title="登录后继续" />)
    expect(screen.getByRole('heading', { name: '输入验证码' })).toBeInTheDocument()
    expect(screen.getByText('已发送到 13800138000')).toBeInTheDocument()
    expect(screen.getByLabelText('验证码')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /后重发/ })).toBeDisabled()
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('rejects malformed phone input before requesting a password login', async () => {
    const user = userEvent.setup()
    render(<AuthFlow presentation="page" />)
    await user.click(screen.getByRole('button', { name: '密码登录' }))
    await user.type(screen.getByLabelText('手机号'), '12345')
    await user.type(screen.getByLabelText('密码'), 'secret1')
    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('请输入有效的手机号')
    expect(signInWithPasswordMock).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not report login success if the verify endpoint returns no session or token', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    vi.mocked(global.fetch).mockResolvedValue(Response.json({ ok: true }))
    render(<AuthFlow presentation="layer" onSuccess={onSuccess} />)
    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '获取验证码' }))
    await user.type(await screen.findByLabelText('验证码'), '123456')
    await user.click(screen.getByRole('button', { name: '验证并继续' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('登录会话建立失败，请重新验证。')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('allows consent when a recovery code is resumed as normal SMS login', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockImplementation(async (input) => String(input).endsWith('/send')
      ? Response.json({ ok: true })
      : Response.json({ error: '验证码错误' }, { status: 400 }))
    render(<AuthFlow presentation="page" initialMode="forgot_password" />)
    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.click(screen.getByRole('button', { name: '继续找回密码' }))
    await screen.findByLabelText('验证码')
    await user.click(screen.getByRole('button', { name: '返回密码登录' }))
    await user.click(screen.getByRole('button', { name: '验证码登录' }))
    expect(screen.getByLabelText('验证码')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox'))
    await user.type(screen.getByLabelText('验证码'), '123456')
    await user.click(screen.getByRole('button', { name: '验证并继续' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('验证码错误')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('confirms agreement before verifying a resumed recovery code, without resending SMS', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockImplementation(async (input) => String(input).endsWith('/send')
      ? Response.json({ ok: true })
      : Response.json({ error: '验证码错误' }, { status: 400 }))
    render(<AuthFlow presentation="page" initialMode="forgot_password" />)
    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.click(screen.getByRole('button', { name: '继续找回密码' }))
    await screen.findByLabelText('验证码')
    await user.click(screen.getByRole('button', { name: '返回密码登录' }))
    await user.click(screen.getByRole('button', { name: '验证码登录' }))
    await user.type(screen.getByLabelText('验证码'), '123456')
    await user.click(screen.getByRole('button', { name: '验证并继续' }))

    expect(screen.getByRole('alertdialog')).toHaveTextContent('勾选同意，并验证登录')
    expect(global.fetch).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: '同意并继续' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('验证码错误')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch).toHaveBeenLastCalledWith('/api/auth/sms/verify', expect.objectContaining({
      body: JSON.stringify({ phone: '+8613800138000', code: '123456' }),
    }))
  })

  it('starts SMS verification for phone login after consent', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    } as Response)

    render(<AuthFlow presentation="page" />)

    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800138000' } })
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '获取验证码' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/sms/send', expect.objectContaining({
        body: JSON.stringify({ phone: '+8613800138000', type: 'login' }),
        method: 'POST',
      }))
    })
    expect(screen.getByRole('heading', { name: '输入验证码' })).toBeInTheDocument()
    expect(screen.getByText('已发送到 13800138000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '验证并继续' })).toBeInTheDocument()
  })

  it('explains a provider timeout without entering verification or retrying SMS', async () => {
    const user = userEvent.setup()
    const sendCalls: string[] = []
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      sendCalls.push(String(input))
      return Response.json({ error: 'Processing this request timed out, please retry after a moment.' }, { status: 504 })
    })
    render(<AuthFlow presentation="page" />)
    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '获取验证码' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('验证码服务暂时繁忙或网络超时，请稍后重试。')
    expect(screen.queryByLabelText('验证码')).not.toBeInTheDocument()
    expect(sendCalls).toEqual(['/api/auth/sms/send'])
  })

  it('rejects email registration', async () => {
    const user = userEvent.setup()

    render(<AuthFlow presentation="page" initialMode="sign_up" />)

    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: 'student@example.com' } })
    expect(screen.queryByLabelText('密码')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '获取验证码' }))

    expect(signUpMock).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalledWith('/api/auth/sms/send', expect.anything())
    expect(screen.getByText('注册请使用手机号。')).toBeInTheDocument()
  })

  it('starts SMS verification for phone registration', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    } as Response)

    render(<AuthFlow presentation="page" initialMode="sign_up" />)

    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800138000' } })
    expect(screen.queryByLabelText('密码')).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '获取验证码' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/sms/send', expect.objectContaining({
        body: JSON.stringify({ phone: '+8613800138000', type: 'login' }),
        method: 'POST',
      }))
    })
    expect(screen.getByRole('heading', { name: '输入验证码' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '验证并继续' })).toBeInTheDocument()
  })

  it('offers explicit agreement before sending SMS, and cancellation leaves consent unchecked', async () => {
    const user = userEvent.setup()

    render(<AuthFlow presentation="page" initialMode="sign_up" />)

    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.click(screen.getByRole('button', { name: '获取验证码' }))

    expect(global.fetch).not.toHaveBeenCalledWith('/api/auth/sms/send', expect.anything())
    expect(screen.getByRole('alertdialog', { name: '请确认服务协议' })).toBeInTheDocument()
    expect(screen.getByText(/点击「同意并继续」将勾选同意，并获取验证码/)).toBeInTheDocument()
    expect(toastMock).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('checks consent and continues the original SMS request once after confirmation', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(Response.json({ ok: true }))
    render(<AuthFlow presentation="page" />)
    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.click(screen.getByRole('button', { name: '获取验证码' }))
    expect(global.fetch).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '同意并继续' }))
    expect(await screen.findByLabelText('验证码')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: '修改手机号' }))
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('keeps agreed consent if sending fails and never retries automatically', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(Response.json({ error: '发送暂时失败' }, { status: 500 }))
    render(<AuthFlow presentation="page" />)
    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.click(screen.getByRole('button', { name: '获取验证码' }))
    await user.click(screen.getByRole('button', { name: '同意并继续' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('发送暂时失败')
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('shows malformed phone feedback before asking for agreement', async () => {
    const user = userEvent.setup()
    render(<AuthFlow presentation="page" />)
    await user.type(screen.getByLabelText('手机号'), '12345')
    await user.click(screen.getByRole('button', { name: '获取验证码' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('请输入有效的手机号')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('preserves email test account recovery without advertising email accounts', async () => {
    const user = userEvent.setup()
    resetPasswordForEmailMock.mockResolvedValue({ error: null })

    render(<AuthFlow presentation="page" />)

    await user.click(screen.getByRole('button', { name: '密码登录' }))
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: 'student@example.com' } })
    await user.click(screen.getByRole('button', { name: '忘记密码' }))

    expect(screen.getByRole('heading', { name: '找回密码' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '继续找回密码' })).toBeInTheDocument()
    expect(screen.queryByLabelText('密码')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '继续找回密码' }))

    await waitFor(() => {
      expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
        'student@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback'),
        })
      )
    })
  })

  describe('landing page after SMS verification', () => {
    const originalLocation = window.location

    const stubLocation = () => {
      const stub = { href: '', search: '' }
      Object.defineProperty(window, 'location', { value: stub, writable: true, configurable: true })
      return stub
    }

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      })
    })

    const verifyPhone = async (isNewUser: boolean) => {
      const user = userEvent.setup()
      verifyOtpMock.mockResolvedValue({ error: null })
      vi.mocked(global.fetch).mockImplementation((input) => {
        const url = String(input)
        if (url.endsWith('/api/auth/sms/send')) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve('{}') } as Response)
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ tokenHash: 'hash-1', isNewUser }),
        } as Response)
      })

      render(<AuthFlow presentation="page" />)

      fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800138000' } })
      await user.click(screen.getByRole('checkbox'))
      await user.click(screen.getByRole('button', { name: '获取验证码' }))
      fireEvent.change(await screen.findByLabelText('验证码'), { target: { value: '123456' } })
      await user.click(screen.getByRole('button', { name: '验证并继续' }))
    }

    it('sends a newly registered phone user to the platform starter guide', async () => {
      const location = stubLocation()

      await verifyPhone(true)

      await waitFor(() => expect(location.href).toBe('/start'))
    })

    it('keeps returning users on the home page', async () => {
      const location = stubLocation()

      await verifyPhone(false)

      await waitFor(() => expect(location.href).toBe('/'))
    })

    it('keeps a protected page as the destination after phone password recovery', async () => {
      const location = stubLocation()
      location.search = '?next=%2Fnature%2Fsubmit%3Ftopic%3Dplants'
      const user = userEvent.setup()
      verifyOtpMock.mockResolvedValue({ error: null })
      vi.mocked(global.fetch).mockImplementation(async (input) => String(input).endsWith('/send')
        ? Response.json({ ok: true })
        : Response.json({ tokenHash: 'hash-1', isNewUser: false }))
      render(<AuthFlow presentation="page" initialMode="forgot_password" />)
      await user.type(screen.getByLabelText('手机号'), '13800138000')
      await user.click(screen.getByRole('button', { name: '继续找回密码' }))
      await user.type(await screen.findByLabelText('验证码'), '123456')
      await user.click(screen.getByRole('button', { name: '验证并继续' }))
      await waitFor(() => expect(location.href).toBe('/settings/security?mode=recovery&next=%2Fnature%2Fsubmit%3Ftopic%3Dplants'))
    })
  })

  it('sends the recovery SMS immediately after the phone is confirmed, without a second send button', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(Response.json({ ok: true }))

    render(<AuthFlow presentation="page" initialMode="forgot_password" />)

    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800138000' } })
    await user.click(screen.getByRole('button', { name: '继续找回密码' }))

    expect(resetPasswordForEmailMock).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: '输入验证码' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '验证码登录' })).not.toBeInTheDocument()
    expect(screen.getByText('已发送到 13800138000')).toBeInTheDocument()
    expect(screen.getByLabelText('验证码')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '返回密码登录' })).toBeInTheDocument()
  })
})
