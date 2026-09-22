import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast, useToast } from './use-toast'

describe('compact reward feedback', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    const { result, unmount } = renderHook(() => useToast())
    act(() => { result.current.dismiss(); vi.runAllTimers() })
    unmount()
    document.querySelectorAll('[data-feedback-test]').forEach((element) => element.remove())
    vi.useRealTimers()
  })

  it('keeps an existing error instead of replacing it with a daily reward', () => {
    const { result } = renderHook(() => useToast())
    act(() => { toast({ title: '保存失败', variant: 'destructive' }) })
    act(() => { toast({ title: '今日奖励：+10 经验', presentation: 'compact', duration: 2000 }) })
    expect(result.current.toasts.filter((item) => item.open).map((item) => item.title)).toEqual(['保存失败'])
  })

  it('does not show routine feedback over a dialog', () => {
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('data-feedback-test', '')
    document.body.appendChild(dialog)
    const { result } = renderHook(() => useToast())
    act(() => { toast({ title: '今日奖励：+10 经验', presentation: 'compact' }) })
    expect(result.current.toasts.filter((item) => item.open)).toHaveLength(0)
  })

  it('keeps input focus and suppresses routine feedback while typing', () => {
    const input = document.createElement('input')
    input.setAttribute('data-feedback-test', '')
    document.body.appendChild(input)
    input.focus()
    const { result } = renderHook(() => useToast())
    act(() => { toast({ title: '今日奖励：+10 经验', presentation: 'compact' }) })
    expect(document.activeElement).toBe(input)
    expect(result.current.toasts.filter((item) => item.open)).toHaveLength(0)
  })

  it('allows an actionable message to replace a routine reward', () => {
    const { result } = renderHook(() => useToast())
    act(() => { toast({ title: '今日奖励：+10 经验', presentation: 'compact', duration: 2000 }) })
    expect(result.current.toasts[0]).toMatchObject({ title: '今日奖励：+10 经验', duration: 2000, open: true })
    act(() => { toast({ title: '保存失败，请重试', variant: 'destructive' }) })
    expect(result.current.toasts[0].title).toBe('保存失败，请重试')
  })
})
