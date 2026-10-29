
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/context/auth-context'

import { LoginPromptProvider } from '@/lib/context/login-prompt-context'


const mocks = vi.hoisted(() => ({
  changed: null as null | ((event: string, session: { user: { id: string } } | null) => void),
  dialog: null as null | { onSuccess: (result?: { isNewUser?: boolean }) => void; onOpenChange: (v: boolean) => void },
  path: '/project/7', push: vi.fn(), callback: vi.fn(),
}))
vi.mock('next/navigation', () => ({ usePathname: () => mocks.path, useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: mocks.push }) }))
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


import { GlobalTutorFab } from '@/components/features/tutor/global-tutor-fab'
void GlobalTutorFab
import { GlobalTutorMount } from '@/components/features/tutor/global-tutor-mount'
import { TutorProvider } from '@/components/features/tutor/tutor-context'
const tutorMocks=vi.hoisted(()=>({ noop:vi.fn(),send:vi.fn(),client:{prefetchQuery:vi.fn(),removeQueries:vi.fn()} }))
vi.mock('@tanstack/react-query',()=>({useQuery:()=>({}),useQueryClient:()=>tutorMocks.client}))
vi.mock('@/components/features/tutor/use-tutor-chat-stream',()=>({useTutorChatStream:()=>({messages:[],setMessages:tutorMocks.noop,busy:false,sendMessage:tutorMocks.send})}))
vi.mock('@/components/features/tutor/use-tutor-history',()=>({useTutorHistory:()=>({view:'chat'})}))
vi.mock('@/components/features/tutor/use-tutor-voice',()=>({useTutorVoice:()=>({voicePreferences:{},stopSpeechPlayback:tutorMocks.noop})}))
vi.mock('@/components/features/tutor/use-tutor-fab-drag',()=>({useTutorFabDrag:()=>({})}))
vi.mock('@/components/features/tutor/tutor-message-list',()=>({TutorMessageList:()=>null}))
vi.mock('@/components/features/tutor/xiaodi',()=>({XiaoDi:()=>null}))
vi.mock('@/components/features/tutor/tutor-fab-mascot',()=>({TutorFabMascot:()=>null}))
function tree() { return <AuthProvider><LoginPromptProvider><TutorProvider><GlobalTutorMount/></TutorProvider></LoginPromptProvider></AuthProvider> }
function auth(id: string|null) {act(()=>mocks.changed?.('SIGNED_IN',id?{user:{id}}:null))}
beforeEach(()=>{ vi.clearAllMocks();sessionStorage.clear();sessionStorage.setItem('visited','1');mocks.path='/project/7';window.history.replaceState({},'',mocks.path) })
it('real Mount transfers only the successful guest login draft across keyed remount and isolates accounts',async()=>{
 render(tree());auth(null)
 fireEvent.click(screen.getByRole('button',{name:'打开 AI 导师'}))
 const input=await screen.findByRole('textbox', {}, { timeout: 15000 })
 fireEvent.change(input,{target:{value:'登录前未发送的问题'}})
 fireEvent.click(screen.getByRole('button',{name:'登录后提问'}))
 const success=mocks.dialog!.onSuccess
 auth('a');act(()=>success({isNewUser:true}))
 await waitFor(()=>expect(screen.getByRole('textbox')).toHaveValue('登录前未发送的问题'))
 expect(tutorMocks.send).not.toHaveBeenCalled()
 auth('b');await waitFor(()=>expect(screen.getByRole('textbox')).toHaveValue(''))
 auth(null);await waitFor(()=>expect(screen.getByRole('textbox')).toHaveValue(''))
 auth('a');await waitFor(()=>expect(screen.getByRole('textbox')).toHaveValue(''))
})
it('cancelling guest login never transfers its draft into a later account',async()=>{
 render(tree());auth(null);fireEvent.click(screen.getByRole('button',{name:'打开 AI 导师'}))
 fireEvent.change(await screen.findByRole('textbox'),{target:{value:'取消的问题'}})
 fireEvent.click(screen.getByRole('button',{name:'登录后提问'}));const late=mocks.dialog!.onSuccess
 fireEvent.click(screen.getByText('关闭'));auth('other');act(()=>late())
 await waitFor(()=>expect(screen.getByRole('textbox')).toHaveValue(''))
 expect(tutorMocks.send).not.toHaveBeenCalled()
})
