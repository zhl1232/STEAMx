import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import drafts from '@/lib/project/science-extensions.dev.json'
import { getScienceSample } from '@/lib/project/science-samples'
import { ScienceExtensionQuestions } from './science-extension-questions'
import { TutorProvider, useTutorContext } from '../tutor/tutor-context'
const state = vi.hoisted(() => ({ user: { id: 'a' } as { id: string } | null, login: vi.fn() }))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: state.user }) }))
vi.mock('@/lib/context/login-prompt-context', () => ({ useLoginPrompt: () => ({ promptLogin: state.login }) }))
function Probe() {
 const ctx = useTutorContext()
 return <><output data-testid="draft">{JSON.stringify({ draft: ctx.pendingDraft, send: ctx.pendingSend, open: ctx.open })}</output><button onClick={() => ctx.setOpen(false)}>关闭</button></>
}
beforeEach(() => { state.user = { id: 'a' }; state.login.mockClear() })
test('question queues text only, opens panel without sending, close cancels pending draft', () => {
 render(<TutorProvider><ScienceExtensionQuestions projectId={1213} questions={['为什么喷发？']} /><Probe /></TutorProvider>)
 fireEvent.click(screen.getByText('为什么喷发？'))
 expect(JSON.parse(screen.getByTestId('draft').textContent!)).toEqual({ draft: { text: '为什么喷发？', userId: 'a', projectId: '1213' }, send: null, open: true })
 fireEvent.click(screen.getByText('关闭'))
 expect(JSON.parse(screen.getByTestId('draft').textContent!).draft).toBeNull()
})
test('guest gets login prompt without a queued draft or auto-send callback', () => {
 state.user = null
 render(<TutorProvider><ScienceExtensionQuestions projectId={1213} questions={['为什么喷发？']} /><Probe /></TutorProvider>)
 fireEvent.click(screen.getByText('为什么喷发？'))
 expect(state.login.mock.calls[0][0]).toBeUndefined()
 expect(JSON.parse(screen.getByTestId('draft').textContent!).draft).toBeNull()
})

afterEach(() => vi.unstubAllEnvs())
test('all three development questions prefill the exact text and project id', () => {
 vi.stubEnv('NODE_ENV', 'development')
 const draft = drafts.find(item => item.extensionQuestions.length === 3)!
 const sample = getScienceSample(draft.id)!
 expect(sample.extensionQuestions).toEqual(draft.extensionQuestions)
 render(<TutorProvider><ScienceExtensionQuestions projectId={sample.id} questions={sample.extensionQuestions!} /><Probe /></TutorProvider>)
 for (const question of draft.extensionQuestions) {
  fireEvent.click(screen.getByRole('button', { name: question }))
  expect(JSON.parse(screen.getByTestId('draft').textContent!)).toEqual({ draft: { text: question, userId: 'a', projectId: String(draft.id) }, send: null, open: true })
 }
})
