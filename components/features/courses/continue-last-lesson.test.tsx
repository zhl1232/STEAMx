import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { ContinueLastLesson } from './continue-last-lesson'
import { rememberLessonStep } from '@/lib/courses/lesson-step-memory'

vi.mock('next/link', () => ({ default: ({ prefetch: _prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => <a {...props} /> }))
beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); localStorage.clear() })
describe('本机上次课程页码恢复', () => {
  it('匿名浏览也可直接回到最后课时页码，并替换普通继续入口', () => {
    rememberLessonStep(502, 3, 5)
    render(<ContinueLastLesson courseId={5} lessonIds={[501, 502]} fallback={<a href="/next">继续学习</a>} />)
    expect(screen.getByRole('link', { name: '继续上次：第 2 课第 4 页' })).toHaveAttribute('href', '/courses/5/lessons/502?step=4')
    expect(screen.queryByRole('link', { name: '继续学习' })).not.toBeInTheDocument()
  })
  it.each([{ courseId: 6, lessonId: 502, step: 3 }, { courseId: 5, lessonId: 999, step: 3 }, { courseId: 5, lessonId: 502, step: 0 }])('其它课程、无效课时或首页保留普通继续入口：%j', visit => {
    rememberLessonStep(visit.lessonId, visit.step, visit.courseId)
    render(<ContinueLastLesson courseId={5} lessonIds={[501, 502]} fallback={<a href="/next">继续学习</a>} />)
    expect(screen.getByRole('link', { name: '继续学习' })).toHaveAttribute('href', '/next')
    expect(screen.queryByTestId('continue-last-lesson')).not.toBeInTheDocument()
  })
})
