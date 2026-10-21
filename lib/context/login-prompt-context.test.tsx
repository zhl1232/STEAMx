import { StrictMode, useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './auth-context'
import { ProjectProvider, useProjects } from './project-context'
import { LoginPromptProvider, useLoginPrompt } from './login-prompt-context'
import { useLoginContinuation } from '@/hooks/use-login-continuation'

const mocks = vi.hoisted(() => ({
  changed: null as null | ((event: string, session: { user: { id: string } } | null) => void),
  dialog: null as null | { onSuccess: (result?: { isNewUser?: boolean }) => void; onOpenChange: (v: boolean) => void },
  path: '/project/7', push: vi.fn(), callback: vi.fn(),
}))
vi.mock('next/navigation', () => ({ usePathname: () => mocks.path, useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/lib/auth/visit-prompt', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/auth/visit-prompt')>(),
  hasVisitedPrompt: () => sessionStorage.getItem('visited') === '1',
  markVisitPrompt: () => sessionStorage.setItem('visited', '1'),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({
  auth: { onAuthStateChange: (cb: typeof mocks.changed) => {
    mocks.changed = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  } },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }),
}) }))
vi.mock('@/lib/testing/playwright-smoke', () => ({ isPlaywrightSmokeClient: () => false }))
vi.mock('@/lib/context/gamification-context', () => ({ useGamification: () => ({ addXp: vi.fn(), checkBadges: vi.fn() }) }))
vi.mock('@/lib/context/notification-context', () => ({ useNotifications: () => ({ createNotification: vi.fn() }) }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/components/layout/login-dialog', () => ({ LoginDialog: (props: {
  onSuccess: (result?: { isNewUser?: boolean }) => void; onOpenChange: (v: boolean) => void; title: string
}) => { mocks.dialog = props; return <div role="dialog" aria-label={props.title}>
  <button onClick={() => props.onOpenChange(false)}>先探索</button>
  <button onClick={() => props.onOpenChange(false)}>关闭</button>
</div> } }))

function Harness() {
  const { promptLogin } = useLoginPrompt()
  const { toggleCollection, startExploration } = useProjects()
  const [draft, setDraft] = useState('我的问题')
  const resumeCollection = useLoginContinuation(() => toggleCollection(7))
  const resumeStart = useLoginContinuation(() => startExploration(7))
  return <>
    <input aria-label="草稿" value={draft} onChange={e => setDraft(e.target.value)} />
    <button onClick={() => promptLogin(mocks.callback, { title: '手动登录' })}>手动</button>
    <button onClick={() => promptLogin(resumeCollection)}>收藏</button>
    <button onClick={() => promptLogin(resumeStart)}>开始</button>
    <button onClick={() => promptLogin()}>普通登录</button>
  </>
}
function tree() { return <StrictMode><AuthProvider><LoginPromptProvider><ProjectProvider><Harness /></ProjectProvider></LoginPromptProvider></AuthProvider></StrictMode> }
function auth(id: string | null) { act(() => mocks.changed?.(id ? 'SIGNED_IN' : 'INITIAL_SESSION', id ? { user: { id } } : null)) }
function success(isNewUser = false) { act(() => mocks.dialog?.onSuccess({ isNewUser })) }
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); mocks.path = '/project/7'
  window.history.replaceState({}, '', '/project/7')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ collected: true, action: 'collected' }), { status: 200 })))
})

describe('tab prompt and authenticated continuations', () => {
  it.each(['/project/7', '/nature', '/explore', '/courses'])('does not auto prompt guests on the first page %s', path => {
    mocks.path = path; render(tree()); auth(null)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('prompts guests once on the second page, after auth initializes', () => {
    const view = render(tree()); auth(null)
    expect(screen.queryByRole('dialog')).toBeNull()
    mocks.path = '/nature'; window.history.pushState({}, '', '/nature'); view.rerender(tree())
    expect(screen.getByRole('dialog', { name: '登录或注册' })).toBeInTheDocument()
  })
  it('prompts guests after about 30 seconds on one page', () => {
    vi.useFakeTimers()
    try {
      render(tree()); auth(null)
      expect(screen.queryByRole('dialog')).toBeNull()
      act(() => { vi.advanceTimersByTime(30_000) })
      expect(screen.getByRole('dialog', { name: '登录或注册' })).toBeInTheDocument()
    } finally { vi.useRealTimers() }
  })
  it('does not prompt on lesson pages', () => {
    mocks.path = '/courses/5/lessons/30'; sessionStorage.setItem('steamx:login-nudge:views', '3'); render(tree()); auth(null)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('does not flash for an existing session', () => {
    render(tree()); auth('existing'); expect(screen.queryByRole('dialog')).toBeNull()
  })
  it.each(['/login','/auth/callback','/settings/security','/legal/privacy','/admin'])('excludes %s', path => {
    mocks.path = path; render(tree()); auth(null); expect(screen.queryByRole('dialog')).toBeNull()
  })
  it.each(['先探索','关闭'])('does not repeat the same day after %s, route change or provider remount', name => {
    const view = render(tree()); auth(null)
    mocks.path = '/nature'; window.history.pushState({}, '', '/nature'); view.rerender(tree())
    fireEvent.click(screen.getByText(name)); view.rerender(tree())
    mocks.path = '/explore'; window.history.pushState({}, '', '/explore'); view.rerender(tree())
    expect(screen.queryByRole('dialog')).toBeNull()
    view.unmount(); render(tree()); auth(null)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('never replaces a manual request while authentication is loading', () => {
    render(tree()); fireEvent.click(screen.getByText('手动')); auth(null)
    expect(screen.getByRole('dialog', { name: '手动登录' })).toBeInTheDocument()
  })
  it('waits for committed user state, invokes once and retains the draft', async () => {
    render(tree()); auth(null)
    fireEvent.change(screen.getByLabelText('草稿'), { target: { value: '还未发送' } })
    fireEvent.click(screen.getByText('手动')); const completed = mocks.dialog!.onSuccess
    act(() => { completed({ isNewUser: true }); completed({ isNewUser: true }) })
    expect(mocks.callback).not.toHaveBeenCalled()
    auth('new'); await waitFor(() => expect(mocks.callback).toHaveBeenCalledTimes(1))
    act(() => completed({ isNewUser: true })); auth('new')
    expect(mocks.callback).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }))
    expect(mocks.push).not.toHaveBeenCalled(); expect(screen.getByLabelText('草稿')).toHaveValue('还未发送')
  })
  it.each(['收藏','开始'])('resumes %s through the real ProjectProvider after the real AuthProvider updates', async action => {
    render(tree()); auth(null)
    fireEvent.click(screen.getByText(action)); success(true)
    expect(fetch).not.toHaveBeenCalled(); auth('new')
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(fetch).toHaveBeenCalledWith(action === '收藏' ? '/api/projects/7/collection' : '/api/projects/7/explorations/start', { method: 'POST' })
    expect(mocks.push).not.toHaveBeenCalled()
  })
  it('cancels an intent and ignores a late success even after another login opens', async () => {
    render(tree()); auth(null)
    fireEvent.click(screen.getByText('手动')); const late = mocks.dialog!.onSuccess
    fireEvent.click(screen.getByText('关闭')); fireEvent.click(screen.getByText('普通登录'))
    act(() => late({ isNewUser: true })); auth('new'); success(true)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.callback).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled()
  })
  it('cancels the old action when navigating during login', async () => {
    localStorage.setItem('steamx:login-nudge:dismissed-day', new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date()))
    const view = render(tree()); auth(null)
    fireEvent.click(screen.getByText('手动')); const late = mocks.dialog!.onSuccess
    mocks.path = '/nature'; window.history.pushState({}, '', '/nature'); view.rerender(tree())
    act(() => late()); auth('new'); await act(async () => {})
    expect(mocks.callback).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).toBeNull()
  })
  it.each([true, false])('only the delayed onboarding prompt enters onboarding (new=%s)', async isNew => {
    const view = render(tree()); auth(null)
    mocks.path = '/nature'; window.history.pushState({}, '', '/nature'); view.rerender(tree())
    auth('person'); success(isNew)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.push).toHaveBeenCalledTimes(isNew ? 1 : 0)
    if (isNew) expect(mocks.push).toHaveBeenCalledWith('/start')
  })
})
