import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LoginPromptProvider, useLoginPrompt } from './login-prompt-context'

vi.mock('@/components/layout/login-dialog', () => ({
  LoginDialog: (props: { open: boolean; onSuccess: () => void }) => props.open ? (
    <button type="button" onClick={props.onSuccess}>登录成功</button>
  ) : null,
}))

const callback = vi.fn()

function Harness() {
  const { promptLogin } = useLoginPrompt()

  return (
    <button type="button" onClick={() => promptLogin(callback, { title: '请登录' })}>
      打开登录
    </button>
  )
}

describe('LoginPromptProvider', () => {
  it('opens the login dialog and runs the pending callback after login', async () => {
    const user = userEvent.setup()
    render(
      <LoginPromptProvider>
        <Harness />
      </LoginPromptProvider>,
    )

    await user.click(screen.getByRole('button', { name: '打开登录' }))
    expect(screen.getByRole('button', { name: '登录成功' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '登录成功' }))
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
