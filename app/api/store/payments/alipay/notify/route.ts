import { acceptStoreNotification } from '@/lib/store/payment-flow'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const body = await request.text()
    if (Buffer.byteLength(body) > 65536) return new Response('failure', { status: 413 })
    await acceptStoreNotification('alipay', { body, headers: Object.fromEntries(request.headers) })
    return new Response('success', { headers: { 'Content-Type': 'text/plain' } })
  } catch { return new Response('failure', { status: 400 }) }
}
