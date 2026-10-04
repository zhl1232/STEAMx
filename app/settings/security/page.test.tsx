import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import SecurityPage from './page'

const mocks = vi.hoisted(() => ({ search: '', toast: vi.fn(), fetch: vi.fn() }))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
}))
vi.mock('@/app/settings/_components/settings-subpage-shell', () => ({
  SettingsSubpageShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { phone: '8613800138000' } } }) } }),
}))

describe('password recovery destination', () => {
  const originalLocation = window.location
  let location: { href: string }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.search = ''
    location = { href: '' }
    Object.defineProperty(window, 'location', { value: location, configurable: true })
    vi.stubGlobal('fetch', mocks.fetch)
    mocks.fetch.mockResolvedValue(Response.json({ ok: true }))
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
    vi.unstubAllGlobals()
  })

  const savePassword = () => {
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'test-password' } })
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'test-password' } })
    fireEvent.click(screen.getByRole('button', { name: '保存新密码' }))
  }

  it.each([
    ['/nature/submit?topic=plants', '/nature/submit?topic=plants'],
    ['https://outside.example/', '/'],
  ])('returns to a safe destination after a successful recovery (%s)', async (next, expected) => {
    mocks.search = `mode=recovery&next=${encodeURIComponent(next)}`
    render(<SecurityPage />)
    await screen.findByLabelText('新密码')
    savePassword()
    await waitFor(() => expect(location.href).toBe(expected))
    expect(mocks.fetch).toHaveBeenCalledWith('/api/auth/password/change', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ newPassword: 'test-password' }),
    }))
  })

  it('stays in settings after an ordinary password change', async () => {
    render(<SecurityPage />)
    fireEvent.click(screen.getByRole('button', { name: '展开修改密码' }))
    savePassword()
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: '修改成功' })))
    expect(location.href).toBe('')
  })

  it('keeps the recovery form and destination when saving fails', async () => {
    mocks.search = 'mode=recovery&next=%2Fnature%2Fsubmit'
    mocks.fetch.mockResolvedValue(Response.json({ error: '暂时无法保存密码' }, { status: 500 }))
    render(<SecurityPage />)
    await screen.findByLabelText('新密码')
    savePassword()
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: '修改失败' })))
    expect(location.href).toBe('')
    expect(screen.getByLabelText('新密码')).toHaveValue('test-password')
  })
})
