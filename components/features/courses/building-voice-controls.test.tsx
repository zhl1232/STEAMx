import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BuildingVoiceControls, type BuildingVoiceControlsProps } from './building-voice-controls'
import type { BuildingVoiceStatus } from './use-building-voice-controls'

const mocks = vi.hoisted(() => ({
  user: { id: 'parent-a' } as { id: string } | null,
  promptLogin: vi.fn(),
  hook: vi.fn(),
  control: {
    status: 'idle' as BuildingVoiceStatus,
    feedback: '',
    isActive: false,
    start: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    exit: vi.fn(),
  },
}))

vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('@/lib/context/login-prompt-context', () => ({ useLoginPrompt: () => ({ promptLogin: mocks.promptLogin }) }))
vi.mock('./use-building-voice-controls', () => ({ useBuildingVoiceControls: (options: unknown) => {
  mocks.hook(options)
  return mocks.control
} }))

function props(): BuildingVoiceControlsProps {
  return {
    courseId: 7, lessonId: 42, navigationKey: 'page-a', stepIndex: 1, stepCount: 3,
    tutorOpen: false, onCloseTutor: vi.fn(), onNavigate: vi.fn(),
  }
}

describe('BuildingVoiceControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'parent-a' }
    Object.assign(mocks.control, { status: 'idle', feedback: '', isActive: false })
  })

  it('starts only after a click, with the current account and displayed page', () => {
    const current = props()
    render(<BuildingVoiceControls {...current} />)
    expect(screen.getByText('会员权益 · 目前免费体验')).toBeInTheDocument()
    expect(mocks.control.start).not.toHaveBeenCalled()
    expect(mocks.hook).toHaveBeenLastCalledWith(expect.objectContaining({
      userId: 'parent-a', courseId: 7, lessonId: 42, navigationKey: 'page-a', stepIndex: 1, stepCount: 3,
    }))

    fireEvent.click(screen.getByRole('button', { name: '开启' }))
    expect(current.onCloseTutor).toHaveBeenCalledOnce()
    expect(mocks.control.start).toHaveBeenCalledOnce()
  })

  it('keeps anonymous lesson navigation usable and asks for login only on voice activation', () => {
    mocks.user = null
    const current = props()
    render(<BuildingVoiceControls {...current} />)
    expect(mocks.promptLogin).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '开启' }))
    expect(mocks.promptLogin).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ title: '登录后开启语音搭建' }))
    expect(mocks.control.start).not.toHaveBeenCalled()
    expect(current.onCloseTutor).not.toHaveBeenCalled()
  })

  it('pauses active listening when the tutor panel is opened', () => {
    Object.assign(mocks.control, { status: 'listening', isActive: true })
    const current = props()
    const { rerender } = render(<BuildingVoiceControls {...current} />)
    expect(mocks.control.pause).not.toHaveBeenCalled()
    rerender(<BuildingVoiceControls {...current} tutorOpen />)
    expect(mocks.control.pause).toHaveBeenCalledOnce()

    Object.assign(mocks.control, { status: 'paused', isActive: false })
    rerender(<BuildingVoiceControls {...current} tutorOpen />)
    expect(screen.getByRole('status')).toHaveTextContent('已打开小迪答疑')
  })

  it('pauses for playing lesson media, and stops that media before resuming listening', () => {
    Object.assign(mocks.control, { status: 'listening', isActive: true })
    const current = props()
    const { container, rerender } = render(
      <div data-building-lesson><video /><BuildingVoiceControls {...current} /></div>,
    )
    const video = container.querySelector('video')!
    const mediaPause = vi.spyOn(video, 'pause').mockImplementation(() => {})
    Object.defineProperty(video, 'paused', { configurable: true, value: false })
    fireEvent(video, new Event('play'))
    expect(mocks.control.pause).toHaveBeenCalledOnce()

    Object.assign(mocks.control, { status: 'paused', isActive: false })
    rerender(<div data-building-lesson><video /><BuildingVoiceControls {...current} /></div>)
    expect(screen.getByRole('status')).toHaveTextContent('课程媒体正在播放')
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    expect(mediaPause).toHaveBeenCalledOnce()
    expect(mocks.control.start).toHaveBeenCalledOnce()
  })

  it('provides manual pause and exit even while an utterance is processing', () => {
    Object.assign(mocks.control, { status: 'processing', isActive: true, feedback: '正在识别口令' })
    render(<BuildingVoiceControls {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: '暂停' }))
    fireEvent.click(screen.getByRole('button', { name: '退出语音搭建' }))
    expect(mocks.control.pause).toHaveBeenCalledOnce()
    expect(mocks.control.exit).toHaveBeenCalledOnce()
  })

  it('shows a daily recognition limit without starting another request automatically', () => {
    Object.assign(mocks.control, { status: 'error', feedback: '今日语音控制已达上限，明天 08:00 后可继续；仍可用按钮翻页。' })
    render(<BuildingVoiceControls {...props()} />)
    expect(screen.getByRole('status')).toHaveTextContent('今日语音控制已达上限')
    expect(screen.getByRole('status')).toHaveTextContent('仍可用按钮翻页')
    expect(screen.getByRole('button', { name: '退出语音搭建' })).toBeEnabled()
    expect(mocks.control.start).not.toHaveBeenCalled()
  })

  it('does not offer voice controls for an empty display flow', () => {
    render(<BuildingVoiceControls {...props()} stepCount={0} />)
    expect(screen.queryByRole('region', { name: '语音搭建' })).not.toBeInTheDocument()
    expect(mocks.control.start).not.toHaveBeenCalled()
  })
})
