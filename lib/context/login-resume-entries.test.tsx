import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/context/auth-context'
import { ProjectProvider } from '@/lib/context/project-context'
import { LoginPromptProvider } from '@/lib/context/login-prompt-context'


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


import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WorkDetail } from '@/components/features/works/work-detail'
import { ProjectComments } from '@/components/features/project-comments'
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/components/features/project/completion-record-comments', () => ({ CompletionRecordComments: () => null }))
vi.mock('@/components/features/project/tip-project-dialog', () => ({ TipProjectDialog: () => null }))
vi.mock('@/components/features/shared/comment-card', () => ({ CommentCard: () => null }))
vi.mock('@/components/features/shared/bottom-reply-box', () => ({ BottomReplyBox: ({onSubmit}: {onSubmit: (event: React.FormEvent, content: string) => void}) => <button onClick={event => onSubmit(event, '保留这段评论')}>发送测试评论</button> }))
const work = { id: 42, userId: 'owner', projectId: 7, author: '作者', completedAt: '刚刚', proofImages: [], notes: '', isPublic: true, likes: 0, coins: 0, status: 'approved', recordKind: 'final' } as const
function tree(kind: string) { return <StrictMode><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AuthProvider><LoginPromptProvider><ProjectProvider>{kind==='work' ? <WorkDetail work={work as unknown as import('@/lib/mappers/types').Work} canShare={false}/> : <ProjectComments projectId={7} initialComments={[]} initialLikedCommentIds={[]} preserveScrollOnSubmit/>}</ProjectProvider></LoginPromptProvider></AuthProvider></QueryClientProvider></StrictMode> }
function auth(id: string | null) { act(() => mocks.changed?.('SIGNED_IN', id ? {user:{id}} : null)) }
beforeEach(() => {
  localStorage.setItem('steamx:login-nudge:dismissed-day', new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date()))
 vi.clearAllMocks(); sessionStorage.clear(); sessionStorage.setItem('visited','1'); mocks.path='/project/7'; window.history.replaceState({},'',mocks.path)
 vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({count:0,isLiked:false}),{status:200})))
})
it.each(['work','comment'])('resumes real %s component with committed auth exactly once',async kind=>{
 render(tree(kind));auth(null)
 fireEvent.click(kind==='work' ? screen.getByRole('button',{name:/^点赞，/}) : screen.getAllByText('发送测试评论')[0])
 const completed=mocks.dialog!.onSuccess
 act(()=>{completed({isNewUser:true});completed({isNewUser:true})})
 auth('new-user')
 const endpoint=kind==='work' ? '/api/completions/42/likes' : '/api/comments'
 await waitFor(()=>expect(vi.mocked(fetch).mock.calls.filter(([url,init])=>url===endpoint && init?.method==='POST')).toHaveLength(1))
 expect(screen.queryByRole('dialog')).toBeNull()
 act(()=>completed({isNewUser:true}))
 expect(vi.mocked(fetch).mock.calls.filter(([url,init])=>url===endpoint && init?.method==='POST')).toHaveLength(1)
})
it.each(['work','comment'])('cancelled %s intent cannot submit on a late success',async kind=>{
 render(tree(kind));auth(null)
 fireEvent.click(kind==='work' ? screen.getByRole('button',{name:/^点赞，/}) : screen.getAllByText('发送测试评论')[0])
 const completed=mocks.dialog!.onSuccess
 fireEvent.click(screen.getByText('关闭'));auth('new-user');act(()=>completed())
 await act(async()=>{})
 expect(vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0)
})
it.each(['work','comment'])('navigating away invalidates the real %s continuation',async kind=>{
 const view=render(tree(kind));auth(null)
 fireEvent.click(kind==='work' ? screen.getByRole('button',{name:/^点赞，/}) : screen.getAllByText('发送测试评论')[0])
 const completed=mocks.dialog!.onSuccess
 mocks.path='/nature';window.history.pushState({},'',mocks.path);view.rerender(tree(kind))
 auth('new-user');act(()=>completed({isNewUser:true}));await act(async()=>{})
 expect(vi.mocked(fetch).mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0)
 expect(screen.queryByRole('dialog')).toBeNull()
})
