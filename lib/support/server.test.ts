import {beforeEach,describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({session:{auth:{getUser:vi.fn()},from:vi.fn()},db:{from:vi.fn(),rpc:vi.fn()},rate:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>mocks.session}))
vi.mock('@/lib/supabase/admin',()=>({supabaseAdmin:mocks.db}))
vi.mock('@/lib/api/rate-limit',()=>({requireRateLimit:mocks.rate}))
import {conversationFor,ownConversation,sendSupportMessage,supportSession} from './server'
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',clientId='44444444-4444-4444-8444-444444444444'
function query(result:unknown) {const methods={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn(),single:vi.fn(),insert:vi.fn(),upsert:vi.fn(),limit:vi.fn(),order:vi.fn()};const q={...methods,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(result).then(resolve)};for(const method of Object.values(methods))method.mockReturnValue(q);return q}
const conversation={id,user_id:alice,channel:'store' as const,status:'open' as const,user_read_seq:0,staff_read_seq:0,last_message_seq:0,updated_at:''}
beforeEach(()=>{vi.clearAllMocks();mocks.session.auth.getUser.mockResolvedValue({data:{user:{id:alice}},error:null});mocks.rate.mockResolvedValue(undefined)})
describe('support permissions',()=>{
  it('rejects a different user conversation with no data disclosure',async()=>{
    mocks.db.from.mockReturnValue(query({data:{...conversation,user_id:bob},error:null}))
    await expect(conversationFor(await supportSession(),id)).rejects.toMatchObject({statusCode:404})
  })
  it('requires actual admin profile role, even for an authenticated user',async()=>{
    mocks.session.from.mockReturnValue(query({data:{role:'user'},error:null}))
    await expect(supportSession(true)).rejects.toMatchObject({name:'PermissionError'})
    expect(mocks.db.from).not.toHaveBeenCalled()
  })
  it('allows a restricted user to contact support without social eligibility checks',async()=>{
    mocks.db.from.mockReturnValue(query({data:conversation,error:null}))
    expect(await conversationFor(await supportSession(),id)).toEqual(conversation)
  })
})
describe('support context and retry safety',()=>{
  it.each(['user','admin'] as const)('preserves complaint evidence without public content filtering for %s messages',async role=>{
    const content='举报原文：对方骂我“傻逼”，请协助处理。'
    mocks.db.from.mockReturnValue(query({data:null,error:null}))
    mocks.db.rpc.mockResolvedValue({data:{id:'new',content},error:null})
    const ctx={...await supportSession(),admin:role==='admin'}
    expect(await sendSupportMessage(ctx,conversation,{clientId,content})).toMatchObject({content})
    expect(mocks.db.rpc).toHaveBeenCalledWith('support_send_message',expect.objectContaining({p_role:role,p_content:content}))
    expect(mocks.rate).toHaveBeenCalled()
  })
  it.each(['','字'.repeat(2001)])('still rejects empty or oversized support text',async content=>{
    mocks.db.from.mockReturnValue(query({data:null,error:null}))
    await expect(sendSupportMessage(await supportSession(),conversation,{clientId,content})).rejects.toMatchObject({statusCode:400})
    expect(mocks.db.rpc).not.toHaveBeenCalled()
  })
  it('atomically ensures an independent conversation for the selected channel',async()=>{
    mocks.db.rpc.mockResolvedValue({data:{...conversation,channel:'platform'},error:null})
    expect(await ownConversation(await supportSession(),'platform')).toMatchObject({channel:'platform'})
    expect(mocks.db.rpc).toHaveBeenCalledWith('support_ensure_conversation',{p_user:alice,p_channel:'platform'})
    expect(mocks.db.from).not.toHaveBeenCalled()
  })
  it('rejects commerce context in a platform conversation before looking up private orders',async()=>{
    mocks.db.from.mockReturnValue(query({data:null,error:null}))
    await expect(sendSupportMessage(await supportSession(),{...conversation,channel:'platform'},{clientId,content:'问题',orderId:bob})).rejects.toMatchObject({statusCode:400})
    expect(mocks.db.from).toHaveBeenCalledTimes(1)
    expect(mocks.db.rpc).not.toHaveBeenCalled()
  })
  it('rejects an unavailable or another user order before inserting a message',async()=>{
    const existing=query({data:null,error:null}),order=query({data:null,error:null})
    mocks.db.from.mockReturnValueOnce(existing).mockReturnValueOnce(order)
    await expect(sendSupportMessage(await supportSession(),conversation,{clientId,content:'缺件',orderId:bob})).rejects.toMatchObject({statusCode:404})
    expect(order.eq).toHaveBeenCalledWith('user_id',alice)
    expect(mocks.db.rpc).not.toHaveBeenCalled()
  })
  it('returns a previously committed message before retry rate limiting',async()=>{
    mocks.db.from.mockReturnValue(query({data:{id:'saved-message'},error:null}))
    expect(await sendSupportMessage(await supportSession(),conversation,{clientId,content:'hello'})).toEqual({id:'saved-message'})
    expect(mocks.rate).not.toHaveBeenCalled();expect(mocks.db.rpc).not.toHaveBeenCalled()
  })
  it('stores only minimal order context and records the authenticated actor',async()=>{
    const existing=query({data:null,error:null}),order=query({data:{id:bob,status:'paid',user_id:alice,address_snapshot_encrypted:'private',supplier_cost:99},error:null})
    mocks.db.from.mockReturnValueOnce(existing).mockReturnValueOnce(order);mocks.db.rpc.mockResolvedValue({data:{id:'new'},error:null})
    await sendSupportMessage(await supportSession(),conversation,{clientId,content:'缺件',orderId:bob})
    expect(mocks.db.rpc).toHaveBeenCalledWith('support_send_message',expect.objectContaining({p_actor:alice,p_role:'user',p_context:{orderId:bob,orderStatus:'paid'}}))
    expect(order.select).toHaveBeenCalledWith('id,status,user_id')
  })
})
