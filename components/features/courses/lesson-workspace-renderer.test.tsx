import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LessonWorkspaceRenderer } from './lesson-workspace-renderer'
import type { CourseLessonRow } from '@/lib/courses/types'

vi.mock('@/components/features/courses/scratch-workspace', () => ({
  ScratchWorkspace: ({ blockHint }: { blockHint?: { keywords: string[] } | null }) => (
    <div data-testid="scratch-workspace">
      {blockHint?.keywords.map((keyword) => (
        <span key={keyword}>{keyword}</span>
      ))}
    </div>
  ),
}))

vi.mock('@/components/features/courses/building-3d-workspace', () => ({
  Building3DWorkspace: () => <div data-testid="building-3d-workspace" />,
  UnsupportedLessonWorkspace: ({ lessonType }: { lessonType: string }) => (
    <div data-testid="unsupported-workspace">{lessonType}</div>
  ),
}))

vi.mock('@/components/features/courses/playground-workspace', () => ({
  PlaygroundWorkspace: ({ lesson }: { lesson: { id: number } }) => (
    <div data-testid="playground-workspace">{lesson.id}</div>
  ),
}))

vi.mock('@/components/features/courses/lesson-work-upload', () => ({
  LessonWorkUpload: () => <div data-testid="lesson-work-upload" />,
}))

const baseLesson: CourseLessonRow = {
  id: 1,
  course_id: 1,
  title: '课时',
  lesson_type: 'scratch',
  content: {},
  steps: [],
  resources: [],
  starter_project_path: null,
  sort_order: 1,
  duration_minutes: 20,
  created_at: '2026-06-22T00:00:00.000Z',
  updated_at: '2026-06-22T00:00:00.000Z',
}

function renderWorkspace(lessonType: string) {
  render(
    <LessonWorkspaceRenderer
      courseId={1}
      lesson={{ ...baseLesson, lesson_type: lessonType }}
      previewHref="/preview"
      activeStepIndex={0}
      onStepChange={vi.fn()}
      initialCompleted={false}
      onCompleted={vi.fn()}
    />,
  )
}

describe('LessonWorkspaceRenderer', () => {
  it('renders Scratch workspace for scratch lessons', () => {
    renderWorkspace('scratch')

    expect(screen.getByTestId('scratch-workspace')).toBeInTheDocument()
    expect(screen.getByText('建议在平板或电脑上使用完整编辑器').parentElement).toHaveClass('md:hidden')
  })

  it('passes Scratch block hints to the Scratch workspace', () => {
    render(
      <LessonWorkspaceRenderer
        courseId={1}
        lesson={{ ...baseLesson, lesson_type: 'scratch' }}
        previewHref="/preview"
        activeStepIndex={0}
        scratchBlockHint={{
          stepIndex: 0,
          keywords: ['重复执行'],
          reason: 'next_step',
        }}
        onStepChange={vi.fn()}
        initialCompleted={false}
        onCompleted={vi.fn()}
      />,
    )

    expect(screen.getByText('重复执行')).toBeInTheDocument()
  })

  it('renders 3D building workspace for building lessons', () => {
    renderWorkspace('building_3d')

    expect(screen.getByTestId('building-3d-workspace')).toBeInTheDocument()
  })

  it('renders playground workspace for playground lessons', () => {
    renderWorkspace('playground')

    expect(screen.getByTestId('playground-workspace')).toHaveTextContent('1')
  })

  it('renders a fallback for future lesson types', () => {
    renderWorkspace('future_lab')

    expect(screen.getByTestId('unsupported-workspace')).toHaveTextContent('future_lab')
  })
})
