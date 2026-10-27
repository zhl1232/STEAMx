import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { FeishuClient } from './client'
const credentials = { appId: 'cli_0123456789abcdef', appSecret: 'private-test-secret' }
describe('Feishu API transport', () => {
  it.each(['text', 'post'] as const)('replies %s in the root topic with stable reply-specific UUIDs', async type => {
    const requests: { url: string; body: Record<string, unknown> }[] = []
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes('/auth/')) return authResponse()
      requests.push({ url: String(url), body: JSON.parse(String(init?.body)) })
      return new Response(JSON.stringify({ code: 0, data: { message_id: 'om_reply' } }))
    })
    const client = new FeishuClient(credentials, fetchImpl)
    const send = (root?: string) => type === 'text' ? client.sendText('oc_team', '<at user_id="all">hello</at>', 'event', 'target', undefined, root) : client.sendPost('oc_team', 'hello', ['img_safe'], 'event', 'target', undefined, root)
    await send(); await send('om_root'); await send('om_root')
    expect(requests[1].url).toBe('https://open.feishu.cn/open-apis/im/v1/messages/om_root/reply')
    expect(requests[1].body).toMatchObject({ reply_in_thread: true, msg_type: type })
    expect(requests[1].body).not.toHaveProperty('receive_id')
    expect(requests[1].body.uuid).toBe(requests[2].body.uuid)
    expect(requests[1].body.uuid).not.toBe(requests[0].body.uuid)
    expect(String(requests[1].body.uuid)).toHaveLength(32)
  })
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

const png = () => Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(16).fill(0)])
const authResponse = () => new Response(JSON.stringify({ code: 0, tenant_access_token: 'private-token', expire: 7200 }))
describe('Feishu images', () => {
  it('uploads sniffed binary multipart and reuses its authenticated image key in one post', async () => {
    const requests: { url: string; init: RequestInit }[] = []
    const client = new FeishuClient(credentials, vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init! })
      if (String(url).includes('/auth/')) return authResponse()
      return new Response(JSON.stringify({ code: 0, data: String(url).endsWith('/images') ? { image_key: 'img_v3_123-test' } : { message_id: 'om_sent' } }))
    }))
    const key = await client.uploadImage(png())
    await client.sendPost('oc_team', '<at user_id="all">literal</at>', [key], 'event', 'target')
    await client.sendPost('oc_team', 'retry', [key], 'event', 'target')
    const uploaded = requests[1].init.body as FormData
    expect(uploaded.get('image_type')).toBe('message')
    const file = uploaded.get('image') as File
    expect(file.type).toBe('image/png')
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(png())
    expect(requests[1].init.headers).toEqual({ authorization: 'Bearer private-token' })
    const body = JSON.parse(String(requests[2].init.body))
    expect(body.msg_type).toBe('post')
    expect(JSON.parse(body.content).zh_cn.content).toEqual([[{ tag: 'text', text: '<at user_id="all">literal</at>' }], [{ tag: 'img', image_key: key }]])
    expect(body.uuid).toBe(JSON.parse(String(requests[3].init.body)).uuid)
    expect(requests.every(item => item.url.startsWith('https://open.feishu.cn/open-apis/') && item.init.redirect === 'error' && item.init.signal)).toBe(true)
  })
  it('downloads authenticated image bytes even if the MIME header is wrong', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => String(url).includes('/auth/') ? authResponse() : new Response(png(), { headers: { 'content-type': 'text/html' } }))
    const client = new FeishuClient(credentials, fetchImpl)
    expect(await client.downloadImage('om_message', 'img_v3_123-test')).toEqual(png())
    expect(fetchImpl.mock.calls[1][0]).toBe('https://open.feishu.cn/open-apis/im/v1/messages/om_message/resources/img_v3_123-test?type=image')
  })
  it('rejects oversized streams without trusting a small content length and cancels the reader', async () => {
    let cancelled = false
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(5 * 1024 * 1024)); controller.enqueue(new Uint8Array(1)) }, cancel() { cancelled = true } })
    const client = new FeishuClient(credentials, vi.fn(async (url: string | URL | Request) => String(url).includes('/auth/') ? authResponse() : new Response(stream, { headers: { 'content-length': '1' } })))
    await expect(client.downloadImage('om_message', 'img_safe')).rejects.toThrow(/^feishu_image_invalid$/)
    expect(cancelled).toBe(true)
  })
  it('rejects binary provider error bodies and non-images with generic errors', async () => {
    for (const response of [new Response('private-body', { status: 403 }), new Response('private-provider-error', { headers: { 'content-type': 'image/png' } })]) {
      const client = new FeishuClient(credentials, vi.fn(async (url: string | URL | Request) => String(url).includes('/auth/') ? authResponse() : response))
      await expect(client.downloadImage('om_message', 'img_safe')).rejects.toThrow(response.ok ? /^feishu_image_invalid$/ : /^feishu_image_unavailable$/)
    }
  })
  it('rejects invalid upload bytes and image paths before network access', async () => {
    const fetchImpl = vi.fn()
    const client = new FeishuClient(credentials, fetchImpl)
    for (const bytes of [new Uint8Array(5 * 1024 * 1024 + 1), new TextEncoder().encode('<svg/>')]) await expect(client.uploadImage(bytes)).rejects.toThrow(/^feishu_image_invalid$/)
    for (const key of ['img_x/../secret', 'img_x?foo', 'https://example.com/img_a']) await expect(client.downloadImage('om_message', key)).rejects.toThrow(/^feishu_image_invalid$/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('rejects post bodies above the 30KB UTF8 cap before obtaining a token', async () => {
    const fetchImpl = vi.fn()
    const client = new FeishuClient(credentials, fetchImpl)
    await expect(client.sendPost('oc_team', '中'.repeat(11000), ['img_safe'], 'event', 'target')).rejects.toThrow(/^feishu_message_invalid$/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('honors cancellation during a download stream', async () => {
    const abort = new AbortController()
    let cancelled = false
    const stream = new ReadableStream({ start(controller) { controller.enqueue(png()) }, cancel() { cancelled = true } })
    const client = new FeishuClient(credentials, vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/auth/')) return authResponse()
      queueMicrotask(() => abort.abort())
      return new Response(stream)
    }))
    await expect(client.downloadImage('om_message', 'img_safe', abort.signal)).rejects.toThrow(/^feishu_image_unavailable$/)
    expect(cancelled).toBe(true)
  })
})
