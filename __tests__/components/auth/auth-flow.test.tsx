import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthFlow } from '@/components/auth/auth-flow'

const verifyOtpMock = vi.fn()
const signInWithPasswordMock = vi.fn()
const signUpMock = vi.fn()
const getSessionMock = vi.fn()
const resetPasswordForEmailMock = vi.fn()
const toastMock = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      verifyOtp: verifyOtpMock,
      signInWithPassword: signInWithPasswordMock,
      signUp: signUpMock,
      getSession: getSessionMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
    },
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

describe('AuthFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    getSessionMock.mockResolvedValue({ data: { session: null } })
  })

  it('defaults to account password login without a verification login tab', () => {
    render(<AuthFlow presentation="page" />)

    expect(screen.getByRole('heading', { name: '账号登录' })).toBeInTheDocument()
    expect(screen.getByLabelText('手机号或邮箱')).toBeInTheDocument()
    expect(screen.getByLabelText('密码')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '忘记密码' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '验证码登录' })).not.toBeInTheDocument()
    expect(screen.queryByText(/输入手机号或邮箱，并使用同一个账号密码登录/)).not.toBeInTheDocument()
  })

  it('supports password login with an email identifier', async () => {
    const user = userEvent.setup()
    signInWithPasswordMock.mockResolvedValue({ error: null })

    render(<AuthFlow presentation="page" />)

    await user.type(screen.getByLabelText('手机号或邮箱'), 'student@example.com')
    await user.type(screen.getByLabelText('密码'), 'secret1')
    await user.click(screen.getAllByRole('button', { name: '登录' })[1])

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: 'student@example.com',
        password: 'secret1',
      })
    })
  })

  it('supports password login with a phone identifier', async () => {
    const user = userEvent.setup()
    signInWithPasswordMock.mockResolvedValue({ error: null })

    render(<AuthFlow presentation="page" />)

    await user.type(screen.getByLabelText('手机号或邮箱'), '13800138000')
    await user.type(screen.getByLabelText('密码'), 'secret1')
    await user.click(screen.getAllByRole('button', { name: '登录' })[1])

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        phone: '+8613800138000',
        password: 'secret1',
      })
    })
  })

  it('registers by email with a password after consent', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({ error: null })

    render(<AuthFlow presentation="page" initialMode="sign_up" />)

    await user.type(screen.getByLabelText('手机号或邮箱'), 'student@example.com')
    expect(screen.getByLabelText('密码')).toBeInTheDocument()
    await user.type(screen.getByLabelText('密码'), 'secret1')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getAllByRole('button', { name: '注册' })[1])

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith(expect.objectContaining({
        email: 'student@example.com',
        password: 'secret1',
      }))
    })
  })

  it('starts SMS verification for phone registration without requiring a password', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    } as Response)

    render(<AuthFlow presentation="page" initialMode="sign_up" />)

    await user.type(screen.getByLabelText('手机号或邮箱'), '13800138000')
    expect(screen.queryByLabelText('密码')).not.toBeInTheDocument()
    expect(screen.getByText('手机号注册免密码，验证码完成。')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '获取验证码' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/sms/send', expect.objectContaining({
        body: JSON.stringify({ phone: '+8613800138000', type: 'login' }),
        method: 'POST',
      }))
    })
    expect(screen.getByText('输入短信验证码')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认并继续' })).toBeInTheDocument()
  })

  it('blocks phone registration until terms are accepted', async () => {
    const user = userEvent.setup()

    render(<AuthFlow presentation="page" initialMode="sign_up" />)

    await user.type(screen.getByLabelText('手机号或邮箱'), '13800138000')
    await user.click(screen.getByRole('button', { name: '获取验证码' }))

    expect(global.fetch).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: '请先确认使用授权',
    }))
    expect(screen.getByText('请先同意服务条款、隐私政策，并确认年龄或监护人授权。')).toBeInTheDocument()
  })

  it('sends reset email when recovering by email', async () => {
    const user = userEvent.setup()
    resetPasswordForEmailMock.mockResolvedValue({ error: null })

    render(<AuthFlow presentation="page" />)

    await user.click(screen.getByRole('button', { name: '忘记密码' }))

    expect(screen.getByRole('heading', { name: '找回密码' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '继续找回密码' })).toBeInTheDocument()
    expect(screen.queryByLabelText('密码')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('邮箱或手机号'), 'student@example.com')
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

  it('routes phone password recovery through inline SMS verification', async () => {
    const user = userEvent.setup()

    render(<AuthFlow presentation="page" />)

    await user.click(screen.getByRole('button', { name: '忘记密码' }))
    await user.type(screen.getByLabelText('邮箱或手机号'), '13800138000')
    await user.click(screen.getByRole('button', { name: '继续找回密码' }))

    expect(resetPasswordForEmailMock).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: '短信验证' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '验证码登录' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('手机号')).toHaveValue('13800138000')
    expect(screen.getByText('请先完成短信验证。验证后设置新密码。')).toBeInTheDocument()
  })
})
