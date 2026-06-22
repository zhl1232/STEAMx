import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LessonWorkspaceRenderer } from './lesson-workspace-renderer'
import type { CourseLessonRow } from '@/lib/courses/types'

vi.mock('@/components/features/courses/scratch-workspace', () => ({
  ScratchWorkspace: () => <div data-testid="scratch-workspace" />,
}))

vi.mock('@/components/features/courses/building-3d-workspace', () => ({
  Building3DWorkspace: () => <div data-testid="building-3d-workspace" />,
  UnsupportedLessonWorkspace: ({ lessonType }: { lessonType: string }) => (
    <div data-testid="unsupported-workspace">{lessonType}</div>
  ),
}))

vi.mock('@/lib/courses/device', () => ({
  canUseScratchEditor: () => true,
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
  })

  it('renders 3D building workspace for building lessons', () => {
    renderWorkspace('building_3d')

    expect(screen.getByTestId('building-3d-workspace')).toBeInTheDocument()
  })

  it('renders a fallback for future lesson types', () => {
    renderWorkspace('future_lab')

    expect(screen.getByTestId('unsupported-workspace')).toHaveTextContent('future_lab')
  })
})

