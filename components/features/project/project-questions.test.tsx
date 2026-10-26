import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectQuestionsTabs } from './project-questions'
const mocks=vi.hoisted(()=>({user:null as null|{id:string},login:vi.fn(),fetch:vi.fn()}))
vi.mock('@/lib/context/auth-context',()=>({useAuth:()=>({user:mocks.user})}))
vi.mock('@/lib/context/login-prompt-context',()=>({useLoginPrompt:()=>({promptLogin:mocks.login})}))
vi.mock('@/hooks/use-toast',()=>({useToast:()=>({toast:vi.fn()})}))
vi.mock('@/lib/comment-image',()=>({uploadCommentImage:vi.fn()}))
beforeEach(()=>{sessionStorage.clear();mocks.user=null;vi.clearAllMocks();vi.stubGlobal('fetch',mocks.fetch);mocks.fetch.mockResolvedValue({ok:true,json:async()=>({questions:[],feedback:[]})})})
const mount=()=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ProjectQuestionsTabs projectId={7}><p>Existing works</p></ProjectQuestionsTabs></QueryClientProvider>)
describe('questions preserve works and login context',()=>{
 it('defaults to works and requires no prior work to ask',async()=>{mount();expect(screen.getByRole('tab',{name:'大家的作品'})).toHaveAttribute('aria-selected','true');fireEvent.click(screen.getByRole('tab',{name:'问题与解答'}));expect(await screen.findByLabelText('问题或回复')).toBeInTheDocument()})
 it('login continuation captures draft and submits with authenticated identity',async()=>{mount();fireEvent.click(screen.getByRole('tab',{name:'问题与解答'}));const input=await screen.findByLabelText('问题或回复');fireEvent.change(input,{target:{value:'能换铜线吗？'}});fireEvent.click(screen.getByRole('button',{name:'发布问题'}));expect(mocks.login).toHaveBeenCalled();expect(sessionStorage.length).toBe(0);mocks.fetch.mockResolvedValue({ok:true,json:async()=>({question:{id:77},feedback:[],questions:[]})});await mocks.login.mock.calls[0][0]({id:'signed-in'});await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledWith('/api/projects/7/questions',expect.objectContaining({method:'POST',body:expect.stringContaining('能换铜线吗？')})))})
 it('collapses replies after two and shows current quality independent of XP',async()=>{mocks.user={id:'viewer'};const root={id:1,parent_id:null,question_root_id:1,author_id:'a',content:'具体问题',moderation_state:'approved',profiles:{display_name:'甲'}};mocks.fetch.mockImplementation(async(url:string)=>({ok:true,json:async()=>url.includes('/feedback')?{feedback:[{id:1,qualified:true,xp:0,award_event:null}]}:{questions:[root,...[2,3,4].map(id=>({...root,id,parent_id:1,content:`回复${id}`,reply_to_username:'甲'}))]}}));mount();fireEvent.click(screen.getByRole('tab',{name:'问题与解答'}));expect(await screen.findByText('回复2')).toBeInTheDocument();expect(screen.queryByText('回复4')).toBeNull();fireEvent.click(screen.getByText('展开其余 1 条回复'));expect(screen.getByText('回复4')).toBeInTheDocument();expect(await screen.findByText('高质量回复')).toBeInTheDocument()})
})
