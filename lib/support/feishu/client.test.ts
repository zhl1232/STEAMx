import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { FeishuClient } from './client'
const credentials = { appId: 'cli_0123456789abcdef', appSecret: 'private-test-secret' }
describe('Feishu API transport', () => {
  it('caches the token and uses the same stable delivery UUID on retries', async () => {
    const requests: { url: string; init: RequestInit }[] = []
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init! })
      return new Response(JSON.stringify(String(url).includes('/auth/') ? { code: 0, tenant_access_token: 'private-token', expire: 7200 } : { code: 0, data: { message_id: 'om_sent' } }))
    })
    const client = new FeishuClient(credentials, fetchImpl)
    await client.sendText('oc_team', 'hello', 'event-one', 'target-one')
    await client.sendText('oc_team', 'hello', 'event-one', 'target-one')
    expect(requests.filter(item => item.url.includes('/auth/'))).toHaveLength(1)
    const sent = requests.filter(item => item.url.includes('/im/v1/messages'))
    expect(JSON.parse(String(sent[0].init.body)).uuid).toBe(JSON.parse(String(sent[1].init.body)).uuid)
    expect(sent[0].init.headers).toMatchObject({ authorization: 'Bearer private-token' })
    expect(requests.every(item => item.url.startsWith('https://open.feishu.cn/open-apis/') && item.init.redirect === 'error')).toBe(true)
  })
  it('obtains and caches the actual bot open ID', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => new Response(JSON.stringify(String(url).includes('/auth/') ? { code: 0, tenant_access_token: 'token', expire: 7200 } : { code: 0, bot: { open_id: 'ou_real_bot' } })))
    const client = new FeishuClient(credentials, fetchImpl)
    expect(await client.botOpenId()).toBe('ou_real_bot'); expect(await client.botOpenId()).toBe('ou_real_bot'); expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
  it('rejects provider errors with a fixed error and no raw body or credentials', async () => {
    const client = new FeishuClient(credentials, vi.fn(async () => new Response(JSON.stringify({ code: 999, msg: 'private-provider-data' }))))
    await expect(client.botOpenId()).rejects.toThrow(/^feishu_unavailable$/)
  })
  it('renders user-authored at markup as text instead of notifying the whole group', async () => {
    let content = ''
    const client = new FeishuClient(credentials, vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes('/auth/')) return new Response(JSON.stringify({ code: 0, tenant_access_token: 'token', expire: 7200 }))
      content = JSON.parse(JSON.parse(String(init?.body)).content).text
      return new Response(JSON.stringify({ code: 0, data: { message_id: 'om_sent' } }))
    }))
    await client.sendText('oc_team', '<at user_id="all">所有人</at>', 'event', 'target')
    expect(content).not.toContain('<at'); expect(content).toContain('＜at user_id="all">')
  })
})
