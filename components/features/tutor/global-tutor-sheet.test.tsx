import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GlobalTutorFab } from './global-tutor-fab'
import { TutorProvider, useTutorContext } from './tutor-context'
import type { TutorToolCall } from '@/lib/ai/tutor/tool-calls'

const mock = vi.hoisted(() => ({ noop: vi.fn(), tool: vi.fn(), dispatch: undefined as undefined | ((call: TutorToolCall) => Promise<boolean>) }))
let pathname = '/project/1213'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'a' } }) }))
vi.mock('@/lib/context/login-prompt-context', () => ({ useLoginPrompt: () => ({ promptLogin: mock.noop }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mock.noop }) }))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({}), useQueryClient: () => ({}) }))
vi.mock('./use-tutor-chat-stream', () => ({ useTutorChatStream: (options: { dispatchToolCall: typeof mock.dispatch }) => {
  mock.dispatch = options.dispatchToolCall
  return { messages: [{ role: 'assistant', content: '**试试** 小车' }], setMessages: mock.noop, busy: false, sendMessage: mock.noop }
} }))
vi.mock('./use-tutor-history', () => ({ useTutorHistory: () => ({ view: 'chat' }) }))
vi.mock('./use-tutor-voice', () => ({ useTutorVoice: () => ({ voicePreferences: {}, stopSpeechPlayback: mock.noop }) }))
vi.mock('./use-tutor-fab-drag', () => ({ useTutorFabDrag: () => ({}) }))
vi.mock('./tutor-message-list', () => ({ TutorMessageList: () => <div data-testid="real-message-slot"><a href="#step" onClick={(e) => e.preventDefault()}>试试小车</a></div> }))
vi.mock('./xiaodi', () => ({ XiaoDi: () => null }))
vi.mock('./tutor-fab-mascot', () => ({ TutorFabMascot: () => null }))
vi.mock('@/lib/utils/upload', () => ({
  SecureUploadError: class extends Error {}, getSecureUploadErrorMessage: mock.noop,
  uploadFileSecure: async () => '/photo.png',
}))

function Harness() {
  const tutor = useTutorContext()
  const { registerToolHandler } = tutor
  useEffect(() => registerToolHandler('course.focus_lesson_step', mock.tool), [registerToolHandler])
  return <><button onClick={() => tutor.setOpen(true)}>打开</button>
    <GlobalTutorFab open={tutor.open} onToggle={() => tutor.setOpen(!tutor.open)} context={{ contextType: 'project', contextId: '1213' }} />
  </>
}

beforeEach(() => {
  vi.clearAllMocks()
  pathname = '/project/1213'
  vi.stubGlobal('innerHeight', 800)
  vi.stubGlobal('visualViewport', undefined)
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
afterEach(() => vi.unstubAllGlobals())

it('integrates capture collapse without losing the real composer draft, photos or message DOM', async () => {
  render(<TutorProvider><Harness /></TutorProvider>)
  fireEvent.click(screen.getByText('打开'))
  const panel = screen.getByRole('dialog')
  expect(panel).toHaveAttribute('data-sheet-snap', 'half')
  const input = screen.getByRole('textbox')
  expect(input).not.toHaveFocus()
  fireEvent.change(input, { target: { value: '还有一个问题' } })
  const fileInput = panel.querySelector('input[type="file"]')!
  fireEvent.change(fileInput, { target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] } })
  await screen.findByAltText('待发图片')
  const message = screen.getByTestId('real-message-slot')
  fireEvent.click(screen.getByText('试试小车'))
  expect(panel).toHaveAttribute('data-sheet-snap', 'collapsed')
  expect(screen.getByRole('button', { name: '展开小迪对话' })).toHaveTextContent('小迪：试试 小车')
  fireEvent.click(screen.getByRole('button', { name: '展开小迪对话' }))
  expect(screen.getByRole('textbox')).toBe(input)
  expect(input).toHaveValue('还有一个问题')
  expect(screen.getByAltText('待发图片')).toBeInTheDocument()
  expect(screen.getByTestId('real-message-slot')).toBe(message)
  const call: TutorToolCall = { name: 'course.focus_lesson_step', payload: { lessonId: 1, stepIndex: 0, reason: 'next_step' } }
  await act(async () => { expect(await mock.dispatch?.(call)).toBe(true) })
  expect(mock.tool).toHaveBeenCalledWith(call)
  expect(panel).toHaveAttribute('data-sheet-snap', 'collapsed')
  fireEvent.click(screen.getByRole('button', { name: '展开小迪对话' }))
  fireEvent.click(screen.getByRole('button', { name: '收起导师' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '打开 AI 导师' })).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(screen.getByText('打开'))
  expect(screen.getByRole('dialog')).toHaveAttribute('data-sheet-snap', 'half')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('uses native Enter/Space activation and tracks the keyboard visual viewport including offsetTop', async () => {
  const user = userEvent.setup()
  const viewport = new EventTarget()
  Object.assign(viewport, { height: 800, offsetTop: 0 })
  vi.stubGlobal('visualViewport', viewport)
  render(<TutorProvider><Harness /></TutorProvider>)
  fireEvent.click(screen.getByText('打开'))
  const panel = screen.getByRole('dialog')
  await waitFor(() => expect(panel).toHaveFocus())
  const grip = screen.getByRole('button', { name: /调整小迪面板高度/ })
  grip.focus()
  await user.keyboard('{Enter}')
  expect(panel).toHaveAttribute('data-sheet-snap', 'full')
  await user.keyboard(' ')
  expect(panel).toHaveAttribute('data-sheet-snap', 'half')
  const input = screen.getByRole('textbox')
  act(() => input.focus())
  Object.assign(viewport, { height: 400, offsetTop: 50 })
  act(() => viewport.dispatchEvent(new Event('resize')))
  expect(panel.style.getPropertyValue('--tutor-viewport-height')).toBe('400px')
  expect(panel.style.getPropertyValue('--tutor-viewport-top')).toBe('50px')
  expect(panel.style.getPropertyValue('--tutor-viewport-bottom')).toBe('350px')
  expect(panel).toHaveAttribute('data-sheet-keyboard', 'true')
  expect(panel.style.getPropertyValue('--tutor-sheet-collapsed-bottom')).toBe('')
  Object.assign(viewport, { height: 800, offsetTop: 0 })
  act(() => viewport.dispatchEvent(new Event('resize')))
  expect(panel).toHaveAttribute('data-sheet-keyboard', 'false')
  expect(panel).toHaveAttribute('data-sheet-snap', 'half')
})
