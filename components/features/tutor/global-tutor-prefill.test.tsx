import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { GlobalTutorFab } from './global-tutor-fab'
import { TutorProvider, useTutorContext } from './tutor-context'
const mock = vi.hoisted(() => ({ user: { id: 'a' }, send: vi.fn(), toast: vi.fn(), noop: vi.fn() }))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: mock.user }) }))
vi.mock('@/lib/context/login-prompt-context', () => ({ useLoginPrompt: () => ({ promptLogin: mock.noop }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mock.toast }) }))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({}), useQueryClient: () => ({}) }))
vi.mock('./use-tutor-chat-stream', () => ({ useTutorChatStream: () => ({ messages: [], setMessages: mock.noop, busy: false, sendMessage: mock.send }) }))
vi.mock('./use-tutor-history', () => ({ useTutorHistory: () => ({ view: 'chat' }) }))
vi.mock('./use-tutor-voice', () => ({ useTutorVoice: () => ({ voicePreferences: {}, stopSpeechPlayback: mock.noop }) }))
vi.mock('./use-tutor-fab-drag', () => ({ useTutorFabDrag: () => ({}) }))
vi.mock('./tutor-message-list', () => ({ TutorMessageList: () => null }))
vi.mock('./xiaodi', () => ({ XiaoDi: () => null }))
vi.mock('./tutor-fab-mascot', () => ({ TutorFabMascot: () => null }))
function Harness({ id = '1213' }: { id?: string }) {
 const tutor = useTutorContext()
 return <><button onClick={() => tutor.prefillDraft({ text: '为什么喷发？', projectId: id, userId: mock.user.id })}>选问题</button><GlobalTutorFab open={tutor.open} onToggle={() => tutor.setOpen(!tutor.open)} context={{ contextType: 'project', contextId: id }} /></>
}
beforeEach(() => { mock.user = { id: 'a' }; vi.clearAllMocks() })
test('real composer allows edit, keeps draft on close and protects an existing draft without auto-send', async () => {
 render(<TutorProvider><Harness /></TutorProvider>)
 fireEvent.click(screen.getByText('选问题'))
 const input = await screen.findByRole('textbox')
 expect(input).toHaveValue('为什么喷发？')
 expect(mock.send).not.toHaveBeenCalled()
 fireEvent.change(input, { target: { value: '我想补充的问题' } })
 fireEvent.click(screen.getByRole('button', { name: '收起导师' }))
 fireEvent.click(screen.getByText('选问题'))
 expect(await screen.findByRole('textbox')).toHaveValue('我想补充的问题')
 expect(mock.toast).toHaveBeenCalled()
 expect(mock.send).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button', { name: '发送' }))
 expect(mock.send).toHaveBeenCalledWith('我想补充的问题', [])
})
test('real composer preserves text on project switch, clears on account switch and follows visual viewport height', async () => {
 const viewport = new EventTarget()
 Object.assign(viewport, { height: 400, offsetTop: 0 })
 Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
 const { rerender } = render(<TutorProvider><Harness /></TutorProvider>)
 fireEvent.click(screen.getByText('选问题'))
 await screen.findByRole('textbox')
 await waitFor(() => expect(screen.getByRole('dialog').style.getPropertyValue('--tutor-viewport-height')).toBe('400px'))
 rerender(<TutorProvider><Harness id="1215" /></TutorProvider>)
 expect(screen.getByRole('textbox')).toHaveValue('为什么喷发？')
 fireEvent.click(screen.getByText('选问题'))
 expect(screen.getByRole('textbox')).toHaveValue('为什么喷发？')
 expect(mock.toast).toHaveBeenCalledWith({ title: '已保留当前草稿，请发送或清空文字和照片后再选问题。' })
 mock.user = { id: 'b' }
 rerender(<TutorProvider><Harness id="1215" /></TutorProvider>)
 expect(screen.getByRole('textbox')).toHaveValue('')
 expect(mock.send).not.toHaveBeenCalled()
})
