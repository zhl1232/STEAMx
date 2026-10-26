import {beforeEach,describe,expect,it,vi} from 'vitest'
import {NextRequest} from 'next/server'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({from:vi.fn()}))
vi.mock('./server',()=>({supportSession:async()=>({db:{from:mocks.from}}),conversationFor:async()=>({id:'conversation'}),sendSupportMessage:vi.fn()}))
import {messagesHandler} from './handlers'
function query(data:unknown[]) {
  const methods={select:vi.fn(),eq:vi.fn(),gt:vi.fn(),lt:vi.fn(),order:vi.fn(),limit:vi.fn(),in:vi.fn()}
  const q={...methods,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data,error:null}).then(resolve)}
  for(const method of Object.values(methods))method.mockReturnValue(q)
  return q
}
beforeEach(()=>vi.clearAllMocks())
describe('support forward catch-up pagination',()=>{
  it('returns the next contiguous ascending page and forward cursor',async()=>{
    const messages=query(Array.from({length:51},(_,i)=>({seq:i+11,id:`m-${i+11}`,actor_id:'staff'})))
    mocks.from.mockReturnValueOnce(messages).mockReturnValueOnce(query([]))
    const response=await messagesHandler(false,'GET')(new NextRequest('https://example.test/api/support/conversations/conversation/messages?after=10'),{params:Promise.resolve({id:'conversation'})})
    const data=await response.json()
    expect(response.status).toBe(200)
    expect(messages.order).toHaveBeenCalledWith('seq',{ascending:true})
    expect(messages.gt).toHaveBeenCalledWith('seq',10)
    expect(data.messages.map((m:{seq:number})=>m.seq)).toEqual(Array.from({length:50},(_,i)=>i+11))
    expect(data.messages[0]).not.toHaveProperty('actor_id')
    expect(data.nextAfterCursor).toBe(60)
    expect(data.nextCursor).toBe(null)
  })
  it('rejects mixed forward and backward cursors',async()=>{
    const response=await messagesHandler(false,'GET')(new NextRequest('https://example.test/api/support/conversations/conversation/messages?before=30&after=10'),{params:Promise.resolve({id:'conversation'})})
    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
