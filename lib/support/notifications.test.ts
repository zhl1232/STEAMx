import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({db:{rpc:vi.fn(),from:vi.fn()}}))
vi.mock('./server',()=>({supportDb:()=>mocks.db}))
import {runSupportNotifications,supportNotificationHealth,feishuSignature} from './notifications'
function updateQuery() {const methods={eq:vi.fn(),update:vi.fn()};const q={...methods,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({error:null}).then(resolve)};for(const method of Object.values(methods))method.mockReturnValue(q);return q}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('FEISHU_BRIDGE_ENABLED','false');vi.stubEnv('SUPPORT_FEISHU_WEBHOOK','https://open.feishu.cn/open-apis/bot/v2/hook/test');vi.stubEnv('SUPPORT_FEISHU_SECRET','test-secret');vi.stubEnv('SUPPORT_SITE_URL','https://example.test')})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
describe('support notification outbox',()=>{
  it('does not also deliver the legacy webhook when the app bridge owns notifications',async()=>{
    vi.stubEnv('FEISHU_BRIDGE_ENABLED','true')
    const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock)
    expect(await runSupportNotifications()).toEqual({disabled:true,sent:0,failed:0})
    expect(mocks.db.rpc).not.toHaveBeenCalled();expect(fetchMock).not.toHaveBeenCalled()
  })
  it('disables delivery when configuration is absent or unsafe',async()=>{
    vi.stubEnv('SUPPORT_FEISHU_SECRET','');expect(supportNotificationHealth().configured).toBe(false);expect(await runSupportNotifications()).toMatchObject({disabled:true});expect(mocks.db.rpc).not.toHaveBeenCalled()
    vi.stubEnv('SUPPORT_FEISHU_SECRET','x');vi.stubEnv('SUPPORT_FEISHU_WEBHOOK','https://example.test/hook');expect(supportNotificationHealth().configured).toBe(false)
  })
  it('leaves a persistent retry on webhook failure and never touches messages',async()=>{
    const job={conversation_id:'conversation',message_seq:4,lease_id:'lease',attempts:1};mocks.db.rpc.mockResolvedValue({data:[job],error:null});const query=updateQuery();mocks.db.from.mockReturnValue(query)
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('timeout')))
    expect(await runSupportNotifications()).toEqual({disabled:false,sent:0,failed:1})
    expect(mocks.db.from).toHaveBeenCalledWith('support_notification_outbox')
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({last_error:'delivery_failed',lease_id:null,lease_until:null}))
  })
  it('sends a signed minimal notification and acknowledges the claimed generation only',async()=>{
    mocks.db.rpc.mockResolvedValue({data:[{conversation_id:'conversation',message_seq:4,lease_id:'lease',attempts:1}],error:null});const query=updateQuery();mocks.db.from.mockReturnValue(query)
    const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({code:0})});vi.stubGlobal('fetch',fetchMock)
    expect(await runSupportNotifications()).toEqual({disabled:false,sent:1,failed:0})
    const body=JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.sign).toBe(feishuSignature(body.timestamp,'test-secret'));expect(body.content.text).toContain('/admin/support?conversation=conversation');expect(Object.keys(body.content)).toEqual(['text'])
    expect(query.eq).toHaveBeenCalledWith('message_seq',4);expect(query.eq).toHaveBeenCalledWith('lease_id','lease')
  })
})
