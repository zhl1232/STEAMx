import { forwardRef, useImperativeHandle } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mocks.replace,
    push: mocks.push,
    back: mocks.back,
  }),
}))

vi.mock('@/components/features/profile/profile-editor', () => ({
  ProfileEditor: forwardRef(function MockProfileEditor(
    { onCancel }: { onCancel?: () => void },
    ref: React.Ref<{ requestLeave: (action?: () => void) => void }>,
  ) {
    useImperativeHandle(ref, () => ({
      requestLeave: (action?: () => void) => { action?.() },
    }))
    return (
      <button type="button" onClick={() => onCancel?.()}>取消</button>
    )
  }),
}))

vi.mock('@/app/settings/_components/settings-subpage-shell', () => ({
  SettingsSubpageShell: ({
    title,
    fallbackHref,
    onBack,
    children,
  }: {
    title: React.ReactNode
    fallbackHref?: string
    onBack?: () => void
    children: React.ReactNode
  }) => (
    <div>
      <div data-testid="fallback-href">{fallbackHref}</div>
      <h1>{title}</h1>
      <button type="button" onClick={() => onBack?.()}>返回</button>
      {children}
    </div>
  ),
}))

import ProfileSettingsClient from './profile-settings-client'

describe('ProfileSettingsClient back navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns to 我的 via replace instead of history.back to the homepage', () => {
    render(<ProfileSettingsClient />)
    expect(screen.getByTestId('fallback-href')).toHaveTextContent('/profile')
    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(mocks.replace).toHaveBeenCalledWith('/profile')
    expect(mocks.back).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('cancel also replaces to 我的', () => {
    render(<ProfileSettingsClient />)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(mocks.replace).toHaveBeenCalledWith('/profile')
  })
})
