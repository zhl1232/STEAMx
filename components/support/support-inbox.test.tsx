import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { SupportInbox } from './support-inbox'
const state=vi.hoisted(()=>({search:new URLSearchParams(),fetch:vi.fn()}))
vi.mock('next/navigation',()=>({useSearchParams:()=>state.search}))
vi.mock('./support-chat',async()=>{
  const {useEffect}=await import('react')
  return {supportFetch:(...args:unknown[])=>state.fetch(...args),SupportChat:({onChannelResolved}:{onChannelResolved:(channel:'store')=>void})=>{useEffect(()=>onChannelResolved('store'),[onChannelResolved]);return <p>已加载商城会话</p>}}
})
const response={conversations:[],nextOffset:null,notificationHealth:{configured:false,pending:0}}
beforeEach(()=>{state.search=new URLSearchParams();state.fetch.mockReset().mockResolvedValue(response)})
it('loads independently filtered inboxes',async()=>{
  render(<SupportInbox />)
  await screen.findByText('暂时没有平台帮助咨询。')
  fireEvent.click(screen.getByRole('button',{name:'商城客服'}))
  await screen.findByText('暂时没有商城客服咨询。')
  expect(state.fetch).toHaveBeenCalledWith('/api/admin/support/conversations?channel=store&offset=0')
  expect(screen.getByRole('button',{name:'商城客服'})).toHaveAttribute('aria-pressed','true')
})
it('uses the server conversation channel when opening a notification deep link',async()=>{
  state.search=new URLSearchParams('conversation=store-conversation')
  render(<SupportInbox />)
  await screen.findByText('商城客服会话')
  expect(screen.getByRole('button',{name:'商城客服'})).toHaveAttribute('aria-pressed','true')
  fireEvent.click(screen.getByRole('button',{name:'返回商城客服收件箱'}))
  await screen.findByText('暂时没有商城客服咨询。')
  await waitFor(()=>expect(state.fetch).toHaveBeenCalledWith('/api/admin/support/conversations?channel=store&offset=0'))
})

it('ignores an earlier platform inbox response after switching to store',async()=>{
  let finishPlatform:(value:unknown)=>void=()=>{}
  state.fetch.mockImplementation((url:string)=>url.includes('channel=platform')?new Promise(resolve=>{finishPlatform=resolve}):Promise.resolve(response))
  render(<SupportInbox />)
  await waitFor(()=>expect(state.fetch).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button',{name:'商城客服'}))
  await screen.findByText('暂时没有商城客服咨询。')
  await act(async()=>{finishPlatform({...response,conversations:[{id:'platform-old',channel:'platform',updated_at:'2026-10-26T00:00:00Z',status:'open',unreadCount:3}]})})
  expect(screen.queryByText(/platform-old/)).not.toBeInTheDocument()
  expect(screen.getByText('暂时没有商城客服咨询。')).toBeInTheDocument()
})
