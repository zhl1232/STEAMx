import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    scratchStepCheckResult,
    onDismissScratchBlockHint,
    onCheckScratchStep,
    onFocusScratchStepCheckItem,
    onScratchEditorContextChange,
    onStepChange,
  }: {
    activeStepIndex: number
    scratchBlockHint?: {
      keywords: string[]
      targetItemIndex?: number
      items?: Array<{ findLabel: string; editHint?: string }>
    } | null
    scratchStepCheckResult?: {
      status: string
      items: Array<{
        originalIndex: number
        status: string
        item: { findLabel: string }
      }>
    } | null
    onDismissScratchBlockHint?: () => void
    onCheckScratchStep?: () => void
    onFocusScratchStepCheckItem?: (targetItemIndex: number) => void
    onScratchEditorContextChange?: (context: {
      selectedTargetId?: string
      selectedTargetName?: string
      targets: Array<{ id: string; name: string; blocks?: Array<{ id: string; type: string }> }>
    }) => void
    onStepChange: (index: number) => void
  }) => (
    <div data-testid="lesson-workspace">
      <p>workspace step {activeStepIndex + 1}</p>
      <button type="button" onClick={() => onStepChange(activeStepIndex + 1)}>
        下一页
      </button>
      <button
        type="button"
        onClick={() =>
          onScratchEditorContextChange?.({
            selectedTargetId: 'bear-1',
            selectedTargetName: 'Bear',
          targets: [{ id: 'bear-1', name: 'Bear' }],
        })
      }
    >
      发送 Scratch 上下文
    </button>
      <button
        type="button"
        onClick={() =>
          onScratchEditorContextChange?.({
            selectedTargetId: 'cat-1',
            selectedTargetName: '角色1',
            targets: [
              {
                id: 'cat-1',
                name: '角色1',
                blocks: [{ id: 'hat-1', type: 'event_whenflagclicked' }],
              },
            ],
          })
        }
      >
        发送 Scratch 积木上下文
      </button>
      {onCheckScratchStep ? (
        <button type="button" onClick={onCheckScratchStep}>
          自检这步
        </button>
      ) : null}
      {scratchStepCheckResult ? (
        <div>
          <p>自检状态 {scratchStepCheckResult.status}</p>
          {scratchStepCheckResult.items.map((item) => (
            <span key={`${item.originalIndex}-${item.item.findLabel}`}>
              {item.status}:{item.item.findLabel}
            </span>
          ))}
          {scratchStepCheckResult.items.find((item) => item.status !== 'complete') ? (
            <button
              type="button"
              onClick={() =>
                onFocusScratchStepCheckItem?.(
                  scratchStepCheckResult.items.find((item) => item.status !== 'complete')?.originalIndex ?? 0,
                )
              }
            >
              定位下一处
            </button>
          ) : null}
        </div>
      ) : null}
      {scratchBlockHint?.keywords.length ? (
        <div>
          <p>第 {activeStepIndex + 1} 步要用到</p>
          <p>当前提示 {scratchBlockHint.targetItemIndex ?? 0}</p>
          {scratchBlockHint.keywords.map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
          {scratchBlockHint.items?.map((item) => (
            <span key={`${item.findLabel}-${item.editHint ?? ''}`}>{item.editHint}</span>
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
  beforeEach(() => {
    window.history.replaceState({}, '', '/courses/7/lessons/42')
  })

  it('uses the unified slide and 3D flow in building lesson sidebars', () => {
    const buildingLesson: CourseLessonRow = {
      ...lesson,
      title: '长颈鹿',
      lesson_type: 'building_3d',
      content: {
        building3d: {
          slideImageUrls: Array.from(
            { length: 18 },
            (_, index) => `/slides/giraffe-${index + 1}.webp`,
          ),
          ldrawModelUrl: '/courses/ldraw/giraffe.mpd',
          parts: [],
          steps3d: [
            { title: '搭建四肢', description: '先搭四肢', partIds: [] },
            { title: '搭建身体', description: '再搭身体', partIds: [] },
          ],
        },
      },
      steps: [
        { title: '旧的数据库步骤', description: '不应显示', checklist: [] },
      ],
    }

    render(
      <TutorProvider>
        <LessonPageClient
          courseId={7}
          courseTitle="积木课"
          lesson={buildingLesson}
          previewHref="/courses/7/lessons/42/preview"
        />
      </TutorProvider>,
    )

    const stepButtons = screen.getAllByRole('button', { name: /步骤 \d+/ })
    expect(stepButtons.map((button) => button.textContent)).toEqual([
      expect.stringContaining('认识长颈鹿'),
      expect.stringContaining('联系生活'),
      expect.stringContaining('观察主题'),
      expect.stringContaining('结构分析'),
      expect.stringContaining('搭建四肢'),
      expect.stringContaining('搭建身体'),
      expect.stringContaining('反思完善'),
      expect.stringContaining('延续分享'),
      expect.stringContaining('完成本课'),
    ])
    expect(screen.queryByText('旧的数据库步骤')).not.toBeInTheDocument()
    expect(screen.queryByText('教学目标')).not.toBeInTheDocument()
    expect(screen.queryByText('教学流程')).not.toBeInTheDocument()
  })

  it('restores and records the current building lesson step in the route', async () => {
    const buildingLesson: CourseLessonRow = {
      ...lesson,
      title: '长颈鹿',
      lesson_type: 'building_3d',
      content: {
        building3d: {
          slideImageUrls: Array.from(
            { length: 8 },
            (_, index) => `/slides/giraffe-${index + 1}.webp`,
          ),
          parts: [],
          steps3d: [],
        },
      },
    }
    window.history.replaceState({}, '', '/courses/7/lessons/42?view=works&step=4')

    render(
      <TutorProvider>
        <LessonPageClient
          courseId={7}
          courseTitle="积木课"
          lesson={buildingLesson}
          previewHref="/courses/7/lessons/42/preview"
          initialStepIndex={3}
        />
      </TutorProvider>,
    )

    expect(screen.getByText('workspace step 4')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=works&step=4')

    fireEvent.click(screen.getByRole('button', { name: '下一页' }))

    expect(screen.getByText('workspace step 5')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=works&step=5')

    fireEvent.click(screen.getByRole('button', { name: /步骤 2 联系生活/ }))

    expect(screen.getByText('workspace step 2')).toBeInTheDocument()
    expect(window.location.search).toBe('?view=works&step=2')

    window.history.replaceState({}, '', '/courses/7/lessons/42?view=works&step=3')
    window.dispatchEvent(new PopStateEvent('popstate'))

    await waitFor(() => {
      expect(screen.getByText('workspace step 3')).toBeInTheDocument()
    })

    window.history.replaceState({}, '', '/courses/7')
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(window.location.pathname).toBe('/courses/7')
    expect(window.location.search).toBe('')
  })

  it('keeps playground sidebars compact so step copy is not repeated', () => {
    const playgroundLesson: CourseLessonRow = {
      ...lesson,
      title: '五子棋课',
      lesson_type: 'playground',
      content: {
        summary: '练习第一选',
        playground: { gameKey: 'gomoku' },
      },
      steps: [
        {
          title: '先看成五点',
          description: '这段讲解应只出现在 playground 工作区。',
          hint: '这条提示也不应出现在左侧步骤列表。',
          checklist: [],
        },
      ],
    }

    render(
      <TutorProvider>
        <LessonPageClient
          courseId={7}
          courseTitle="五子棋"
          lesson={playgroundLesson}
          previewHref="/courses/7/lessons/42/preview"
        />
      </TutorProvider>,
    )

    expect(screen.getByRole('button', { name: /步骤 1 先看成五点 当前步骤/ })).toBeInTheDocument()
    expect(screen.queryByText('这段讲解应只出现在 playground 工作区。')).not.toBeInTheDocument()
    expect(screen.queryByText(/这条提示也不应出现在左侧步骤列表/)).not.toBeInTheDocument()
  })

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

  it('adds the current Scratch editor context to the tutor override', async () => {
    const observedOverrides: TutorContextOverride[] = []

    render(
      <TutorProvider>
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

    await act(async () => {
      screen.getByRole('button', { name: '发送 Scratch 上下文' }).click()
    })

    expect(observedOverrides.at(-1)?.scratchEditorContext).toMatchObject({
      selectedTargetName: 'Bear',
      targets: [{ name: 'Bear' }],
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
          keywords: ['重复执行', '说 你好!'],
          items: [
            { label: '重复执行', findLabel: '重复执行' },
            { label: '说 出发啦！', findLabel: '说 你好!', editHint: '把文字改成「出发啦！」' },
          ],
          category: 'control',
          reason: 'next_step',
        },
      })
    })

    expect(screen.getByText('workspace step 2')).toBeInTheDocument()
    expect(screen.getByText('第 2 步要用到')).toBeInTheDocument()
    expect(screen.getByText('当前提示 0')).toBeInTheDocument()
    expect(screen.getByText('重复执行')).toBeInTheDocument()
    expect(screen.getByText('说 你好!')).toBeInTheDocument()
    expect(screen.getByText('把文字改成「出发啦！」')).toBeInTheDocument()

    await act(async () => {
      screen.getByRole('button', { name: '关闭积木提示' }).click()
    })

    expect(screen.queryByText('重复执行')).not.toBeInTheDocument()
  })

  it('advances Scratch block hints inside the same lesson step before changing lesson steps', async () => {
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

    const payload = {
      lessonId: 42,
      stepIndex: 1,
      keywords: ['重复执行', '说 你好!'],
      items: [
        { label: '重复执行', findLabel: '重复执行' },
        { label: '说 出发啦！', findLabel: '说 你好!', editHint: '把文字改成「出发啦！」' },
      ],
      category: 'control' as const,
      reason: 'next_step' as const,
    }

    await act(async () => {
      await dispatchToolCall?.({
        name: 'course.highlight_scratch_blocks',
        payload,
      })
    })

    expect(screen.getByText('workspace step 2')).toBeInTheDocument()
    expect(screen.getByText('当前提示 0')).toBeInTheDocument()
    expect(observedOverrides.at(-1)).toMatchObject({
      lessonStepIndex: 1,
      scratchBlockTargetItemIndex: 0,
    })

    await act(async () => {
      await dispatchToolCall?.({
        name: 'course.highlight_scratch_blocks',
        payload,
      })
    })

    expect(screen.getByText('workspace step 2')).toBeInTheDocument()
    expect(screen.getByText('当前提示 1')).toBeInTheDocument()
    expect(observedOverrides.at(-1)).toMatchObject({
      lessonStepIndex: 1,
      scratchBlockTargetItemIndex: 1,
    })
  })

  it('runs Scratch step self-check and focuses the first unfinished block', async () => {
    const scratchLesson: CourseLessonRow = {
      ...lesson,
      steps: [
        {
          title: '出场说句话',
          description:
            '[[cat:events]] 的 [[block:events|当绿旗被点击]] → [[cat:looks]] 的 [[block:looks|说 出发啦！]]',
          checklist: [],
        },
      ],
    }

    render(
      <TutorProvider>
        <LessonPageClient
          courseId={7}
          courseTitle="工程课"
          lesson={scratchLesson}
          previewHref="/courses/7/lessons/42/preview"
        />
      </TutorProvider>,
    )

    await act(async () => {
      screen.getByRole('button', { name: '发送 Scratch 积木上下文' }).click()
    })

    await act(async () => {
      screen.getByRole('button', { name: '自检这步' }).click()
    })

    expect(screen.getByText('自检状态 needs_work')).toBeInTheDocument()
    expect(screen.getByText('missing:说 你好!')).toBeInTheDocument()

    await act(async () => {
      screen.getByRole('button', { name: '定位下一处' }).click()
    })

    expect(screen.getByText('当前提示 1')).toBeInTheDocument()
    expect(screen.getByText('说 你好!')).toBeInTheDocument()
    expect(screen.getByText('把文字改成「出发啦！」')).toBeInTheDocument()
  })
})
