import { NextRequest, NextResponse } from 'next/server'
import { enqueueFeishuEvent, readDiscovery } from '@/lib/support/feishu/service'
import { FeishuBridgeError } from '@/lib/support/feishu/config'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}
async function boundedJson(request: NextRequest) {
  if (Number(request.headers.get('content-length')) > 32768) throw new FeishuBridgeError('request_too_large', 413)
  const reader = request.body?.getReader()
  if (!reader) throw new FeishuBridgeError('request_invalid', 400)
  let total = 0
  const parts: Uint8Array[] = []
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > 32768) { await reader.cancel(); throw new FeishuBridgeError('request_too_large', 413) }
      parts.push(value)
    }
    try { return JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown } catch { throw new FeishuBridgeError('request_invalid', 400) }
  } finally { reader.releaseLock() }
}
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof FeishuBridgeError ? error.code : 'bridge_unavailable' }, { status: error instanceof FeishuBridgeError ? error.status : 503 })
}
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { return NextResponse.json(await enqueueFeishuEvent(await boundedJson(request)), { headers: { 'Cache-Control': 'no-store' } }) }
  catch (error) { return failure(error) }
}
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { return NextResponse.json({ candidates: await readDiscovery() }, { headers: { 'Cache-Control': 'no-store' } }) }
  catch (error) { return failure(error) }
}
