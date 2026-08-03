import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginPromptProvider, useLoginPrompt } from './login-prompt-context'

const pushMock = vi.fn()
const deferredAction = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/components/layout/login-dialog', () => ({
  LoginDialog: () => null,
}))

function Harness() {
  const { runAfterAgeConfirmation, completeAgeConfirmation } = useLoginPrompt()

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void runAfterAgeConfirmation(async () => {
            deferredAction()
            return new Response(JSON.stringify({ ok: true }))
          })
        }}
      >
        触发门禁
      </button>
      <button type="button" onClick={() => void completeAgeConfirmation()}>
        完成本人确认
      </button>
    </>
  )
}

describe('LoginPromptProvider age confirmation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/project/42?from=comment')
  })

  it('keeps the original path and retries the deferred request after confirmation', async () => {
    const user = userEvent.setup()
    render(
      <LoginPromptProvider>
        <Harness />
      </LoginPromptProvider>,
    )

    await user.click(screen.getByRole('button', { name: '触发门禁' }))
    expect(pushMock).toHaveBeenCalledWith('/settings/security?section=age-confirmation')
    expect(deferredAction).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '完成本人确认' }))

    expect(deferredAction).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenLastCalledWith('/project/42?from=comment')
  })

  it('does nothing when the settings page was opened without a pending action', async () => {
    const user = userEvent.setup()
    render(
      <LoginPromptProvider>
        <Harness />
      </LoginPromptProvider>,
    )

    await user.click(screen.getByRole('button', { name: '完成本人确认' }))

    expect(pushMock).not.toHaveBeenCalled()
    expect(deferredAction).not.toHaveBeenCalled()
  })
})
