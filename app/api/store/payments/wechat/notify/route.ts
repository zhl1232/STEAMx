import { acceptStoreNotification } from '@/lib/store/payment-flow'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const body = await request.text()
    if (Buffer.byteLength(body) > 65536) return Response.json({ code: 'FAIL', message: '请求过大' }, { status: 413 })
    await acceptStoreNotification('wechat', { body, headers: Object.fromEntries(request.headers) })
    return new Response(null, { status: 204 })
  } catch { return Response.json({ code: 'FAIL', message: '通知校验或处理失败' }, { status: 400 }) }
}
