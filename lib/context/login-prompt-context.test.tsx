import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginPromptProvider, useLoginPrompt } from './login-prompt-context'

const deferredAction = vi.fn()

vi.mock('@/components/layout/login-dialog', () => ({
  LoginDialog: () => null,
}))

vi.mock('@/components/layout/interaction-confirmation-dialog', () => ({
  InteractionConfirmationDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean
    onConfirm: () => void | Promise<void>
  }) => open ? (
    <button type="button" onClick={() => void onConfirm()}>
      弹窗完成确认
    </button>
  ) : null,
}))

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ refreshProfile: vi.fn().mockResolvedValue(undefined) }),
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
        完成社区互动确认
      </button>
    </>
  )
}

describe('LoginPromptProvider age confirmation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/project/42?from=comment')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the original path and retries the deferred request after confirmation', async () => {
    const user = userEvent.setup()
    render(
      <LoginPromptProvider>
        <Harness />
      </LoginPromptProvider>,
    )

    await user.click(screen.getByRole('button', { name: '触发门禁' }))
    expect(screen.getByRole('button', { name: '弹窗完成确认' })).toBeInTheDocument()
    expect(deferredAction).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '完成社区互动确认' }))

    expect(deferredAction).toHaveBeenCalledTimes(1)
  })

  it('confirms inline and retries the deferred request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ confirmed: true }), { status: 200 }),
    ))
    const user = userEvent.setup()
    render(
      <LoginPromptProvider>
        <Harness />
      </LoginPromptProvider>,
    )

    await user.click(screen.getByRole('button', { name: '触发门禁' }))
    await user.click(screen.getByRole('button', { name: '弹窗完成确认' }))

    await waitFor(() => expect(deferredAction).toHaveBeenCalledTimes(1))
    expect(fetch).toHaveBeenCalledWith('/api/settings/age-confirmation', { method: 'POST' })
  })

  it('does nothing when the settings page was opened without a pending action', async () => {
    const user = userEvent.setup()
    render(
      <LoginPromptProvider>
        <Harness />
      </LoginPromptProvider>,
    )

    await user.click(screen.getByRole('button', { name: '完成社区互动确认' }))

    expect(deferredAction).not.toHaveBeenCalled()
  })
})
