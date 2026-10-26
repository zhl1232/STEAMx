import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { SupportHome } from './support-home'

const state=vi.hoisted(()=>({user:{id:'alice'} as {id:string}|null,search:new URLSearchParams('productId=product&orderId=order'),fetch:vi.fn()}))
vi.mock('@/lib/context/auth-context',()=>({useAuth:()=>({user:state.user,loading:false})}))
vi.mock('@/lib/context/login-prompt-context',()=>({useLoginPrompt:()=>({promptLogin:vi.fn()})}))
vi.mock('next/navigation',()=>({useSearchParams:()=>state.search}))
vi.mock('./support-chat',()=>({supportFetch:(...args:unknown[])=>state.fetch(...args),SupportChat:(props:{conversationId:string;productId?:string;orderId?:string})=><div data-testid="chat">{JSON.stringify(props)}</div>}))
beforeEach(()=>{state.user={id:'alice'};state.fetch.mockReset()})

it('keeps commerce context out of the platform conversation',async()=>{
  state.fetch.mockResolvedValue({conversation:{id:'platform-conversation'}})
  render(<SupportHome />)
  await screen.findByTestId('chat')
  expect(state.fetch).toHaveBeenCalledWith('/api/support/conversation?channel=platform',{method:'POST'})
  expect(JSON.parse(screen.getByTestId('chat').textContent!)).toEqual({conversationId:'platform-conversation'})
})

it('ignores a previous channel response after switching to store support',async()=>{
  let finishPlatform:(value:unknown)=>void=()=>{}
  state.fetch.mockImplementation((url:string)=>url.includes('platform')?new Promise(resolve=>{finishPlatform=resolve}):Promise.resolve({conversation:{id:'store-conversation'}}))
  const {rerender}=render(<SupportHome />)
  await waitFor(()=>expect(state.fetch).toHaveBeenCalledOnce())
  rerender(<SupportHome channel="store" />)
  await screen.findByTestId('chat')
  expect(JSON.parse(screen.getByTestId('chat').textContent!)).toEqual({conversationId:'store-conversation',productId:'product',orderId:'order'})
  await act(async()=>{finishPlatform({conversation:{id:'old-platform'}})})
  expect(screen.getByTestId('chat')).not.toHaveTextContent('old-platform')
})

it('does not display a previous account conversation or error after account changes',async()=>{
  let failAlice:(error:Error)=>void=()=>{}
  state.fetch.mockImplementationOnce(()=>new Promise((_resolve,reject)=>{failAlice=reject})).mockResolvedValue({conversation:{id:'bob-store'}})
  const {rerender}=render(<SupportHome channel="store" />)
  await waitFor(()=>expect(state.fetch).toHaveBeenCalledOnce())
  state.user={id:'bob'}
  rerender(<SupportHome channel="store" />)
  await screen.findByTestId('chat')
  await act(async()=>{failAlice(new Error('Alice private error'))})
  expect(screen.getByTestId('chat')).toHaveTextContent('bob-store')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
