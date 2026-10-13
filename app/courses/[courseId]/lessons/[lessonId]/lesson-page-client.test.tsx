import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LessonPageClient } from './lesson-page-client'
import { TutorProvider, useTutorContext, type TutorContextOverride } from '@/components/features/tutor/tutor-context'
import type { TutorToolCall } from '@/lib/ai/tutor/tool-calls'
import type { CourseLessonRow } from '@/lib/courses/types'
import type { BuildingVoiceControlsProps } from '@/components/features/courses/building-voice-controls'

const voiceControls = vi.hoisted(() => ({ props: null as BuildingVoiceControlsProps | null }))

vi.mock('@/components/features/courses/building-voice-controls', () => ({
  BuildingVoiceControls: (props: BuildingVoiceControlsProps) => {
    voiceControls.props = props
    return props.stepCount > 0 ? (
      <div data-testid="voice-controls">
        <button type="button" onClick={() => props.onNavigate(props.stepIndex + 1)}>语音下一步</button>
        <button type="button" onClick={() => props.onNavigate(props.stepIndex - 1)}>语音上一步</button>
      </div>
    ) : null
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

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
    buildingNavigationSlot,
    buildingVoiceControlsSlot,
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
    buildingNavigationSlot?: ReactNode
    buildingVoiceControlsSlot?: ReactNode
  }) => (
    <div data-testid="lesson-workspace">
      {buildingNavigationSlot}
      {buildingVoiceControlsSlot}
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
    voiceControls.props = null
  })

  it.each(['scratch', 'playground', 'building_3d'])('renders complete %s step copy before hydration outside the sidebar', (lessonType) => {
    const steps = [
      { title: '观察结构', description: '先观察两侧连接的位置。', hint: '比较两边是否对称。' },
      { title: '尝试改进', description: '调整结构后再试一次。', hint: '记录哪种结构更稳定。' },
    ]
    const publicLesson: CourseLessonRow = {
      ...lesson,
      lesson_type: lessonType,
      steps: lessonType === 'building_3d' ? [{ title: '旧教案', description: '旧的描述不应展示。' }] : steps,
      content: lessonType === 'building_3d'
        ? {
          building3d: {
            ldrawModelUrl: '/courses/ldraw/car.mpd',
            parts: [],
            steps3d: steps.map(({ title, description }) => ({ title, description, partIds: [] })),
          },
        }
        : {},
    }

    const html = renderToString(
      <TutorProvider>
        <LessonPageClient
          courseId={7}
          courseTitle="工程课"
          lesson={publicLesson}
          previewHref="/courses/7/lessons/42/preview"
        />
      </TutorProvider>,
    )
    const document = new DOMParser().parseFromString(html, 'text/html')
    const guide = document.querySelector('details')

    expect(guide).not.toBeNull()
    expect(guide).not.toHaveAttribute('open')
    expect(guide?.closest('aside')).toBeNull()
    for (const step of steps) {
      expect(guide).toHaveTextContent(step.description)
      if (lessonType !== 'building_3d') expect(guide).toHaveTextContent(step.hint)
    }
    expect(guide).not.toHaveTextContent('旧教案')
    const partsLink = document.querySelector('a[href="/courses/7/lessons/42/parts"]')
    if (lessonType === 'building_3d') {
      expect(partsLink).not.toBeNull()
      expect(partsLink?.closest('details')).toBeNull()
    }
    else expect(partsLink).toBeNull()
  })

  it.each(['scratch', 'building_3d'])('renders the optional notice row above the %s workspace', (lessonType) => {
    const html = renderToString(
      <TutorProvider>
        <LessonPageClient
          courseId={1}
          courseTitle="旧课程"
          lesson={{ ...lesson, lesson_type: lessonType, content: lessonType === 'building_3d' ? { building3d: { ldrawModelUrl: '/m.mpd', parts: [], steps3d: [] } } : {} }}
          previewHref="/courses/1/lessons/42/preview"
          noticeSlot={<p data-testid="notice">本课程已更新，前往新版课程：新课</p>}
        />
      </TutorProvider>,
    )
    const document = new DOMParser().parseFromString(html, 'text/html')
    const notice = document.querySelector('[data-testid="notice"]')

    expect(notice).toHaveTextContent('本课程已更新，前往新版课程：新课')
    expect(notice?.closest('aside')).toBeNull()
    expect(notice?.closest('details')).toBeNull()
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

    const stepButtons = within(screen.getByRole('complementary')).getAllByRole('button')
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

    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: /02 联系生活/ }))

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

  it('keeps the phone scroll position between build steps and resets it when changing page kinds', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true, media: '(max-width: 1023px)', onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(),
      removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })
    const buildingLesson: CourseLessonRow = {
      ...lesson,
      title: '救援车',
      lesson_type: 'building_3d',
      content: {
        building3d: {
          ldrawModelUrl: '/courses/ldraw/rescue.mpd',
          slideImageUrls: Array.from({ length: 10 }, (_, index) => `/slides/rescue-${index + 1}.webp`),
          parts: [],
          steps3d: ['搭建底盘', '连接车轮', '装上车身'].map((title) => ({ title, description: title, partIds: [] })),
        },
      },
    }
    window.history.replaceState({}, '', '/courses/7/lessons/42?step=5')

    try {
      render(
        <TutorProvider>
          <LessonPageClient courseId={7} courseTitle="积木课" lesson={buildingLesson} previewHref="/preview" initialStepIndex={4} />
        </TutorProvider>,
      )
      const directory = within(screen.getByRole('complementary'))

      fireEvent.click(screen.getByRole('button', { name: '下一页' }))
      expect(screen.getByText('workspace step 6')).toBeInTheDocument()
      expect(window.location.search).toBe('?step=6')
      fireEvent.click(directory.getByRole('button', { name: /搭建底盘/ }))
      fireEvent.click(directory.getByRole('button', { name: /装上车身/ }))
      expect(screen.getByText('workspace step 7')).toBeInTheDocument()
      expect(scrollTo).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: '下一页' }))
      expect(screen.getByText('workspace step 8')).toBeInTheDocument()
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
      expect(scrollTo).toHaveBeenCalledTimes(1)
      fireEvent.click(directory.getByRole('button', { name: /搭建底盘/ }))
      expect(scrollTo).toHaveBeenCalledTimes(2)
    } finally {
      scrollTo.mockRestore()
      matchMedia.mockRestore()
    }
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
    const sidebar = within(screen.getByRole('complementary'))
    expect(sidebar.queryByText('这段讲解应只出现在 playground 工作区。')).not.toBeInTheDocument()
    expect(sidebar.queryByText(/这条提示也不应出现在左侧步骤列表/)).not.toBeInTheDocument()
  })

  it('uses displayed building pages for voice navigation, URL state and tutor context together', () => {
    const observedOverrides: TutorContextOverride[] = []
    const buildingLesson: CourseLessonRow = {
      ...lesson, lesson_type: 'building_3d',
      content: { building3d: {
        ldrawModelUrl: '/car.mpd', parts: [],
        steps3d: ['准备底盘', '装上轮子', '检查连接'].map((title) => ({ title, description: title, partIds: [] })),
      } },
    }
    render(
      <TutorProvider>
        <TutorOverrideCapture onChange={(override) => { observedOverrides.push(override) }} />
        <LessonPageClient courseId={7} courseTitle="积木课" lesson={buildingLesson} previewHref="/preview" />
      </TutorProvider>,
    )
    const firstKey = voiceControls.props!.navigationKey
    expect(voiceControls.props).toMatchObject({ courseId: 7, lessonId: 42, stepIndex: 0, stepCount: 3 })
    fireEvent.click(screen.getByRole('button', { name: '语音下一步' }))
    expect(screen.getByText('workspace step 2')).toBeInTheDocument()
    expect(window.location.search).toBe('?step=2')
    expect(observedOverrides.at(-1)).toMatchObject({ lessonStepIndex: 1, lessonStepCount: 3, subtitle: '正在做「装上轮子」' })
    expect(voiceControls.props!.navigationKey).not.toBe(firstKey)
    fireEvent.click(screen.getByRole('button', { name: '语音上一步' }))
    expect(window.location.search).toBe('?step=1')
    expect(voiceControls.props!.navigationKey).not.toBe(firstKey)
  })

  it('rejects a captured voice result after manual A → B → A navigation, including before rerender', () => {
    const buildingLesson: CourseLessonRow = {
      ...lesson, lesson_type: 'building_3d',
      content: { building3d: {
        ldrawModelUrl: '/car.mpd', parts: [],
        steps3d: ['准备底盘', '装上轮子', '检查连接'].map((title) => ({ title, description: title, partIds: [] })),
      } },
    }
    render(<TutorProvider><LessonPageClient courseId={7} courseTitle="积木课" lesson={buildingLesson} previewHref="/preview" /></TutorProvider>)
    const captured = voiceControls.props!
    act(() => {
      screen.getByRole('button', { name: '下一页' }).click()
      captured.onNavigate(2)
    })
    expect(screen.getByText('workspace step 2')).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: /准备底盘/ }))
    expect(screen.getByText('workspace step 1')).toBeInTheDocument()
    expect(voiceControls.props!.navigationKey).not.toBe(captured.navigationKey)
    act(() => captured.onNavigate(2))
    expect(screen.getByText('workspace step 1')).toBeInTheDocument()
    expect(window.location.search).toBe('?step=1')
  })

  it('invalidates a pending voice result when browser history restores another page', () => {
    const buildingLesson: CourseLessonRow = {
      ...lesson, lesson_type: 'building_3d',
      content: { building3d: {
        ldrawModelUrl: '/car.mpd', parts: [],
        steps3d: ['准备底盘', '装上轮子', '检查连接'].map((title) => ({ title, description: title, partIds: [] })),
      } },
    }
    render(<TutorProvider><LessonPageClient courseId={7} courseTitle="积木课" lesson={buildingLesson} previewHref="/preview" /></TutorProvider>)
    const captured = voiceControls.props!
    act(() => {
      window.history.replaceState({}, '', '/courses/7/lessons/42?step=2')
      window.dispatchEvent(new PopStateEvent('popstate'))
      captured.onNavigate(2)
    })
    expect(screen.getByText('workspace step 2')).toBeInTheDocument()
    expect(window.location.search).toBe('?step=2')
    expect(voiceControls.props!.navigationKey).not.toBe(captured.navigationKey)
  })

  it('lets Scratch lessons scroll naturally on phones and only pins the editor layout from md up', () => {
    render(
      <TutorProvider>
        <LessonPageClient
          courseId={7}
          courseTitle="Scratch 课"
          lesson={lesson}
          previewHref="/courses/7/lessons/42/preview"
        />
      </TutorProvider>,
    )

    // 手机（< md）上 Scratch 编辑器不可用，只显示上传提示卡：不能锁成 h-dvh 一屏，否则提示卡被挤矮、按钮被裁。
    const workspaceColumn = screen.getByTestId('lesson-workspace').parentElement as HTMLElement
    expect(workspaceColumn).toHaveClass('md:min-h-0')
    expect(workspaceColumn).not.toHaveClass('min-h-0')

    const pageShell = workspaceColumn.parentElement?.parentElement as HTMLElement
    expect(pageShell).toHaveClass('max-md:min-h-screen', 'md:h-[calc(100dvh-4rem)]', 'md:overflow-hidden')
    expect(pageShell).not.toHaveClass('max-md:h-dvh')
    expect(pageShell).not.toHaveClass('overflow-hidden')

    // 平板（md–lg）有编辑器时仍限制侧栏高度，把剩余空间留给编辑器。
    const sidebarColumn = workspaceColumn.parentElement?.firstElementChild as HTMLElement
    expect(sidebarColumn).toHaveClass('max-md:overflow-visible', 'md:max-lg:max-h-[min(48vh,28rem)]', 'md:max-lg:overflow-hidden')
    expect(sidebarColumn).not.toHaveClass('max-lg:max-h-[min(48vh,28rem)]')
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

      const sidebar = within(screen.getByRole('complementary'))
      expect(sidebar.getByText('找到底板和轮子。')).toBeInTheDocument()
      expect(sidebar.queryByText('把轮子对称装到底盘两侧。')).not.toBeInTheDocument()

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

      expect(sidebar.queryByText('找到底板和轮子。')).not.toBeInTheDocument()
      expect(sidebar.getByText('把轮子对称装到底盘两侧。')).toBeInTheDocument()
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
