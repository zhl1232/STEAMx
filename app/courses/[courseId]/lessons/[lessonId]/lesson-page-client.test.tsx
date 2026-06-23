import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LessonPageClient } from './lesson-page-client'
import { TutorProvider, useTutorContext, type TutorContextOverride } from '@/components/features/tutor/tutor-context'
import type { TutorToolCall } from '@/lib/ai/tutor/tool-calls'
import type { CourseLessonRow } from '@/lib/courses/types'

vi.mock('@/components/layout/mobile-global-header', () => ({
  MobileGlobalHeader: ({ title }: { title: string }) => <div data-testid="mobile-header">{title}</div>,
}))

vi.mock('@/components/features/courses/lesson-workspace-renderer', () => ({
  LessonWorkspaceRenderer: ({
    activeStepIndex,
    scratchBlockHint,
    onDismissScratchBlockHint,
  }: {
    activeStepIndex: number
    scratchBlockHint?: { keywords: string[] } | null
    onDismissScratchBlockHint?: () => void
  }) => (
    <div data-testid="lesson-workspace">
      <p>workspace step {activeStepIndex + 1}</p>
      {scratchBlockHint?.keywords.length ? (
        <div>
          <p>可以先找这些积木</p>
          {scratchBlockHint.keywords.map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
          <button type="button" onClick={onDismissScratchBlockHint}>
            关闭积木提示
          </button>
        </div>
      ) : null}
    </div>
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

function TutorOverrideCapture({
  onChange,
}: {
  onChange: (override: TutorContextOverride) => void
}) {
  const { override } = useTutorContext()
  onChange(override)
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

  it('keeps the tutor context aligned with the active lesson step', async () => {
    let dispatchToolCall: ((toolCall: TutorToolCall) => Promise<boolean>) | null = null
    const observedOverrides: TutorContextOverride[] = []

    render(
      <TutorProvider>
        <TutorDispatchCapture onReady={(dispatch) => {
          dispatchToolCall = dispatch
        }} />
        <TutorOverrideCapture onChange={(override) => {
          observedOverrides.push(override)
        }} />
        <LessonPageClient
          courseId={7}
          courseTitle="工程课"
          lesson={lesson}
          previewHref="/courses/7/lessons/42/preview"
        />
      </TutorProvider>,
    )

    expect(observedOverrides.at(-1)).toMatchObject({
      lessonStepIndex: 0,
      subtitle: '正在做「准备零件」',
    })

    await act(async () => {
      await dispatchToolCall?.({
        name: 'course.focus_lesson_step',
        payload: {
          lessonId: 42,
          stepIndex: 1,
          reason: 'next_step',
        },
      })
    })

    expect(observedOverrides.at(-1)).toMatchObject({
      lessonStepIndex: 1,
      subtitle: '正在做「装上车轮」',
    })
  })

  it('shows Scratch block hints from tutor tool calls', async () => {
    let dispatchToolCall: ((toolCall: TutorToolCall) => Promise<boolean>) | null = null

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

    await act(async () => {
      await dispatchToolCall?.({
        name: 'course.highlight_scratch_blocks',
        payload: {
          lessonId: 42,
          stepIndex: 1,
          keywords: ['重复执行', '外观'],
          category: 'control',
          reason: 'next_step',
        },
      })
    })

    expect(screen.getByText('workspace step 2')).toBeInTheDocument()
    expect(screen.getByText('可以先找这些积木')).toBeInTheDocument()
    expect(screen.getByText('重复执行')).toBeInTheDocument()
    expect(screen.getByText('外观')).toBeInTheDocument()

    await act(async () => {
      screen.getByRole('button', { name: '关闭积木提示' }).click()
    })

    expect(screen.queryByText('重复执行')).not.toBeInTheDocument()
  })
})
