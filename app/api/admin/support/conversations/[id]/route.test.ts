import {beforeEach,describe,expect,it,vi} from 'vitest'
import {NextRequest} from 'next/server'
const mocks=vi.hoisted(()=>({update:vi.fn(),eq:vi.fn(),select:vi.fn(),maybeSingle:vi.fn()}))
vi.mock('@/lib/support/server',()=>({supportSession:async()=>({db:{from:()=>({update:mocks.update})}}),conversationFor:async()=>({id:'conversation',last_message_seq:8})}))
import {PATCH} from './route'
beforeEach(()=>{vi.clearAllMocks();const query={eq:mocks.eq,select:mocks.select,maybeSingle:mocks.maybeSingle};mocks.update.mockReturnValue(query);mocks.eq.mockReturnValue(query);mocks.select.mockReturnValue(query)})
const request=(body:unknown)=>new NextRequest('https://example.test/api/admin/support/conversations/conversation',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
describe('support status compare-and-set',()=>{
  it('returns 409 when a new user message changed the rendered sequence',async()=>{
    mocks.maybeSingle.mockResolvedValue({data:null,error:null})
    const response=await PATCH(request({status:'resolved',expectedLastMessageSeq:7}),{params:Promise.resolve({id:'conversation'})})
    expect(response.status).toBe(409)
    expect(mocks.eq).toHaveBeenCalledWith('last_message_seq',7)
  })
  it('updates only the sequence actually rendered by the operator',async()=>{
    mocks.maybeSingle.mockResolvedValue({data:{id:'conversation'},error:null})
    const response=await PATCH(request({status:'resolved',expectedLastMessageSeq:8}),{params:Promise.resolve({id:'conversation'})})
    expect(response.status).toBe(200)
    expect(mocks.eq).toHaveBeenCalledWith('last_message_seq',8)
  })
  it('rejects a status change without a rendered sequence',async()=>{
    const response=await PATCH(request({status:'resolved'}),{params:Promise.resolve({id:'conversation'})})
    expect(response.status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
