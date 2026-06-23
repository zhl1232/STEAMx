import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LessonPageClient } from './lesson-page-client'
import { TutorProvider, useTutorContext } from '@/components/features/tutor/tutor-context'
import type { TutorToolCall } from '@/lib/ai/tutor/tool-calls'
import type { CourseLessonRow } from '@/lib/courses/types'

vi.mock('@/components/layout/mobile-global-header', () => ({
  MobileGlobalHeader: ({ title }: { title: string }) => <div data-testid="mobile-header">{title}</div>,
}))

vi.mock('@/components/features/courses/lesson-workspace-renderer', () => ({
  LessonWorkspaceRenderer: ({ activeStepIndex }: { activeStepIndex: number }) => (
    <div data-testid="lesson-workspace">workspace step {activeStepIndex + 1}</div>
  ),
}))

const lesson: CourseLessonRow = {
  id: 42,
  course_id: 7,
  title: '小车课',
  lesson_type: 'scratch',
  content: { summary: '搭一辆小车' },
  steps: [
    {
      title: '准备零件',
      description: '找到底板和轮子。',
      checklist: [],
    },
    {
      title: '装上车轮',
      description: '把轮子对称装到底盘两侧。',
      checklist: [],
    },
  ],
  resources: [],
  starter_project_path: null,
  sort_order: 1,
  duration_minutes: 20,
  created_at: '2026-06-22T00:00:00.000Z',
  updated_at: '2026-06-22T00:00:00.000Z',
}

function TutorDispatchCapture({
  onReady,
}: {
  onReady: (dispatchToolCall: (toolCall: TutorToolCall) => Promise<boolean>) => void
}) {
  const { dispatchToolCall } = useTutorContext()
  onReady(dispatchToolCall)
  return null
}

describe('LessonPageClient', () => {
  it('focuses and highlights a lesson step from tutor tool calls', async () => {
    const scrollIntoView = vi.fn()
    const originalScrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoView
    let dispatchToolCall: ((toolCall: TutorToolCall) => Promise<boolean>) | null = null

    try {
      render(
        <TutorProvider>
          <TutorDispatchCapture onReady={(dispatch) => {
            dispatchToolCall = dispatch
          }} />
          <LessonPageClient
            courseId={7}
            courseTitle="工程课"
            lesson={lesson}
            previewHref="/courses/7/lessons/42/preview"
          />
        </TutorProvider>,
      )

      expect(screen.getByText('找到底板和轮子。')).toBeInTheDocument()
      expect(screen.queryByText('把轮子对称装到底盘两侧。')).not.toBeInTheDocument()

      await act(async () => {
        await dispatchToolCall?.({
          name: 'course.focus_lesson_step',
          payload: {
            lessonId: 42,
            stepIndex: 1,
            reason: 'stuck',
          },
        })
      })

      expect(screen.queryByText('找到底板和轮子。')).not.toBeInTheDocument()
      expect(screen.getByText('把轮子对称装到底盘两侧。')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /步骤 2 装上车轮/ })).toHaveClass('ring-2')
      expect(scrollIntoView).toHaveBeenCalled()
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView
    }
  })
})
