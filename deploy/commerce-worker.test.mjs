import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runCommerceTick, runFeishuTick } from './commerce-worker.mjs'

test('invokes both internal queues with authentication, without calling external providers', async () => {
  const requests = []
  const result = await runCommerceTick({ baseUrl: 'http://localhost:1234', secret: 'test-only', fetchImpl: async (url, init) => {
    requests.push({ url: String(url), init })
    return new Response(JSON.stringify({ disabled: true }), { status: 200 })
  } })
  assert.deepEqual(requests.map(r => r.url), ['http://localhost:1234/api/internal/store/reconcile', 'http://localhost:1234/api/internal/support/notifications'])
  assert.equal(requests[0].init.headers.authorization, 'Bearer test-only')
  assert.ok(result.every(r => r.status === 'fulfilled'))
})

test('a failed reconciliation does not prevent support notification work', async () => {
  const result = await runCommerceTick({ baseUrl: 'http://localhost:1234', secret: 'test-only', fetchImpl: async (url) => {
    if (String(url).includes('store/')) throw new Error('unavailable')
    return new Response('{}', { status: 200 })
  } })
  assert.equal(result[0].status, 'rejected')
  assert.equal(result[1].status, 'fulfilled')
})

test('Feishu processing uses its own authenticated internal request and rejects failed persistence', async () => {
  let received
  const result = await runFeishuTick({baseUrl:'http://localhost:1234',secret:'test-only',fetchImpl:async (url,init)=>{
    received={url:String(url),init}
    return new Response('{"sent":1}',{status:200})
  }})
  assert.equal(received.url,'http://localhost:1234/api/internal/support/feishu/dispatch')
  assert.equal(received.init.headers.authorization,'Bearer test-only')
  assert.equal(received.init.redirect,'error')
  assert.equal(result.sent,1)
  await assert.rejects(runFeishuTick({baseUrl:'http://localhost:1234',secret:'test-only',fetchImpl:async()=>new Response('{}',{status:503})}),/HTTP 503/)
})
