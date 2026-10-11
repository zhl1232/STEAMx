import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LessonPartsUnavailable } from './lesson-parts-unavailable'

const { router } = vi.hoisted(() => ({ router: { refresh: vi.fn() } }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks() })

it('backs off three times, preserves the retry limit on rerender, and allows a manual refresh', async () => {
  vi.useFakeTimers()
  const { rerender } = render(<LessonPartsUnavailable lessonHref="/courses/5/lessons/30" />)
  expect(screen.getByRole('status')).toHaveTextContent('正在准备零件清单…')
  for (const [index, delay] of [1500, 3000, 6000].entries()) {
    await act(() => vi.advanceTimersByTimeAsync(delay - 1))
    expect(router.refresh).toHaveBeenCalledTimes(index)
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(router.refresh).toHaveBeenCalledTimes(index + 1)
    rerender(<LessonPartsUnavailable lessonHref="/courses/5/lessons/30" />)
  }
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: '进入课时' })).toHaveAttribute('href', '/courses/5/lessons/30')
  await act(() => vi.advanceTimersByTimeAsync(60_000))
  expect(router.refresh).toHaveBeenCalledTimes(3)
  fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
  expect(router.refresh).toHaveBeenCalledTimes(4)
  await act(() => vi.advanceTimersByTimeAsync(60_000))
  expect(router.refresh).toHaveBeenCalledTimes(4)
})

it('cancels the scheduled retry when unmounted', async () => {
  vi.useFakeTimers()
  const { unmount } = render(<LessonPartsUnavailable lessonHref="/courses/5/lessons/30" />)
  unmount()
  await act(() => vi.advanceTimersByTimeAsync(60_000))
  expect(router.refresh).not.toHaveBeenCalled()
})
