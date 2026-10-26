import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectQuestionsTabs } from './project-questions'
const mocks=vi.hoisted(()=>({user:null as null|{id:string},login:vi.fn(),fetch:vi.fn()}))
vi.mock('@/lib/context/auth-context',()=>({useAuth:()=>({user:mocks.user})}))
vi.mock('@/lib/context/login-prompt-context',()=>({useLoginPrompt:()=>({promptLogin:mocks.login})}))
vi.mock('@/hooks/use-toast',()=>({useToast:()=>({toast:vi.fn()})}))
vi.mock('@/lib/comment-image',()=>({uploadCommentImage:vi.fn()}))
beforeEach(()=>{sessionStorage.clear();mocks.user=null;vi.restoreAllMocks();vi.clearAllMocks();vi.stubGlobal('fetch',mocks.fetch);mocks.fetch.mockResolvedValue({ok:true,json:async()=>({questions:[],feedback:[]})})})
const mount=()=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ProjectQuestionsTabs projectId={7}><p>Existing works</p></ProjectQuestionsTabs></QueryClientProvider>)
describe('questions preserve works and login context',()=>{
 it('defaults to works and requires no prior work to ask',async()=>{mount();expect(screen.getByRole('tab',{name:'大家的作品'})).toHaveAttribute('aria-selected','true');fireEvent.click(screen.getByRole('tab',{name:'问题与解答'}));expect(await screen.findByLabelText('问题或回复')).toBeInTheDocument()})
 it('login continuation captures draft and submits with authenticated identity',async()=>{mount();fireEvent.click(screen.getByRole('tab',{name:'问题与解答'}));const input=await screen.findByLabelText('问题或回复');fireEvent.change(input,{target:{value:'能换铜线吗？'}});fireEvent.click(screen.getByRole('button',{name:'发布问题'}));expect(mocks.login).toHaveBeenCalled();expect(sessionStorage.length).toBe(0);mocks.fetch.mockResolvedValue({ok:true,json:async()=>({question:{id:77},feedback:[],questions:[]})});await mocks.login.mock.calls[0][0]({id:'signed-in'});await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledWith('/api/projects/7/questions',expect.objectContaining({method:'POST',body:expect.stringContaining('能换铜线吗？')})))})
 it('collapses replies after two and shows current quality independent of XP',async()=>{mocks.user={id:'viewer'};const root={id:1,parent_id:null,question_root_id:1,author_id:'a',content:'具体问题',moderation_state:'approved',profiles:{display_name:'甲'}};mocks.fetch.mockImplementation(async(url:string)=>({ok:true,json:async()=>url.includes('/feedback')?{feedback:[{id:1,qualified:true,xp:0,award_event:null}]}:{questions:[root,...[2,3,4].map(id=>({...root,id,parent_id:1,content:`回复${id}`,reply_to_username:'甲'}))]}}));mount();fireEvent.click(screen.getByRole('tab',{name:'问题与解答'}));expect(await screen.findByText('回复2')).toBeInTheDocument();expect(screen.queryByText('回复4')).toBeNull();fireEvent.click(screen.getByText('展开其余 1 条回复'));expect(screen.getByText('回复4')).toBeInTheDocument();expect(await screen.findByText('高质量回复')).toBeInTheDocument()})
})

const question={id:1,parent_id:null,question_root_id:1,author_id:'a',content:'具体问题',moderation_state:'approved',profiles:{display_name:'甲'}}
const serveQuestions=()=>mocks.fetch.mockImplementation(async(url:string,options?:RequestInit)=>({ok:true,json:async()=>options?.method==='POST'?{question:{id:77}}:url.includes('/feedback')?{feedback:[]}:{questions:[question]}}))
const openQuestions=()=>fireEvent.click(screen.getByRole('tab',{name:'问题与解答'}))
const submitBody=()=>JSON.parse(mocks.fetch.mock.calls.find(([,options])=>options?.method==='POST')![1].body)
const shortcut=(context:object)=>act(()=>window.dispatchEvent(new CustomEvent('project-question',{detail:{projectId:'7',context}})))

describe('question draft restoration',()=>{
 beforeEach(()=>{mocks.user={id:'viewer'};serveQuestions()})
 it.each(['tab switch','full remount'])('restores the reply target and text after %s',async(mode)=>{
  vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
  vi.spyOn(HTMLElement.prototype,'scrollIntoView').mockImplementation(()=>{})
  const view=mount();openQuestions();shortcut({area:'materials'})
  fireEvent.click(await screen.findByRole('button',{name:'回复'}))
  fireEvent.change(screen.getByLabelText('问题或回复'),{target:{value:'补充一个具体回复'}})
  if(mode==='tab switch'){
   fireEvent.click(screen.getByRole('tab',{name:'大家的作品'}));openQuestions()
  }else{
   view.unmount();mount();openQuestions()
  }
  expect(await screen.findByLabelText('问题或回复')).toHaveValue('补充一个具体回复')
  expect(screen.getByText('回复 @甲')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'发表回复'}))
  await waitFor(()=>expect(submitBody()).toMatchObject({content:'补充一个具体回复',parent_id:1,context:{area:'materials'}}))
 })
 it.each([true,false])('applies an explicit shortcut with questions mounted=%s and keeps it on remount',async(mounted)=>{
  vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
  vi.spyOn(HTMLElement.prototype,'scrollIntoView').mockImplementation(()=>{})
  const view=mount();openQuestions()
  fireEvent.click(await screen.findByRole('button',{name:'回复'}))
  fireEvent.change(screen.getByLabelText('问题或回复'),{target:{value:'这个步骤能换材料吗？'}})
  if(!mounted)fireEvent.click(screen.getByRole('tab',{name:'大家的作品'}))
  shortcut({area:'materials'})
  expect(await screen.findByText('关于项目材料')).toBeInTheDocument()
  shortcut({area:'step',step:2,title:'连接铜线'})
  expect(await screen.findByText('关于第2步：连接铜线')).toBeInTheDocument()
  view.unmount();mount();openQuestions()
  expect(await screen.findByLabelText('问题或回复')).toHaveValue('这个步骤能换材料吗？')
  expect(screen.getByText('关于第2步：连接铜线')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'发布问题'}))
  await waitFor(()=>expect(submitBody()).toMatchObject({parent_id:null,context:{area:'step',step:2,title:'连接铜线'}}))
 })
 it('keeps an anonymous shortcut draft for the login continuation',async()=>{
  mocks.user=null
  vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
  vi.spyOn(HTMLElement.prototype,'scrollIntoView').mockImplementation(()=>{})
  mount();shortcut({area:'materials'})
  fireEvent.change(await screen.findByLabelText('问题或回复'),{target:{value:'匿名材料问题'}})
  shortcut({area:'step',step:3,title:'固定连接'})
  expect(screen.getByLabelText('问题或回复')).toHaveValue('匿名材料问题')
  fireEvent.click(screen.getByRole('button',{name:'发布问题'}))
  expect(sessionStorage.length).toBe(0)
  await act(async()=>{await mocks.login.mock.calls[0][0]({id:'signed-in'})})
  expect(submitBody()).toMatchObject({content:'匿名材料问题',parent_id:null,context:{area:'step',step:3,title:'固定连接'}})
 })
 it('does not restore another account reply draft',async()=>{
  const view=mount();openQuestions()
  fireEvent.click(await screen.findByRole('button',{name:'回复'}))
  fireEvent.change(screen.getByLabelText('问题或回复'),{target:{value:'原账户的回复'}})
  view.unmount();mocks.user={id:'another-viewer'};const other=mount();openQuestions()
  expect(await screen.findByLabelText('问题或回复')).toHaveValue('')
  expect(screen.queryByRole('button',{name:'发表回复'})).toBeNull()
  other.unmount();mocks.user={id:'viewer'};mount();openQuestions()
  expect(await screen.findByLabelText('问题或回复')).toHaveValue('')
 })
})
