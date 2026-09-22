import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { toast, useToast } from '@/hooks/use-toast'
import { Toaster } from './toaster'

afterEach(() => {
  const { result, unmount } = renderHook(() => useToast())
  act(() => result.current.dismiss())
  unmount()
  document.querySelectorAll('[data-feedback-test]').forEach((element) => element.remove())
})

describe('routine reward presentation', () => {
  it('shows compact text without a close button or a second description', async () => {
    render(<Toaster />)
    act(() => { toast({ title: '今日奖励：+10 经验 · +1 硬币', presentation: 'compact', duration: 2000, type: 'background' }) })
    expect(await screen.findByText('今日奖励：+10 经验 · +1 硬币')).toBeVisible()
    expect(screen.queryByRole('button', { name: '关闭通知' })).not.toBeInTheDocument()
    expect(document.querySelector('.compact-feedback-viewport')).toBeInTheDocument()
  })

  it('dismisses routine feedback when a modal appears afterwards', async () => {
    render(<Toaster />)
    act(() => { toast({ title: '今日奖励：+10 经验', presentation: 'compact', duration: 2000 }) })
    await screen.findByText('今日奖励：+10 经验')
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('data-feedback-test', '')
    act(() => document.body.appendChild(dialog))
    await waitFor(() => expect(screen.queryByText('今日奖励：+10 经验')).not.toBeInTheDocument())
  })
})
