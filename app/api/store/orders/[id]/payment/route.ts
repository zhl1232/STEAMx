import { isIP } from 'node:net'
import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { validateUUID, ValidationError } from '@/lib/api/validation'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { requireStoreCheckoutAccess, requireSameOrigin } from '@/lib/store/access'
import { initiateStorePayment } from '@/lib/store/payment-flow'
export const runtime = 'nodejs'
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    await requireStoreCheckoutAccess(supabase)
    const id = validateUUID((await params).id, '订单编号')
    const body = await request.json()
    if (!['alipay','wechat'].includes(body.provider) || !['desktop','mobile'].includes(body.device)) throw new ValidationError('请选择有效的支付方式')
    if (/MicroMessenger/i.test(request.headers.get('user-agent') || '')) throw new ValidationError('请使用手机系统浏览器打开此页面后支付')
    await requireRateLimit(supabase, { key: `store-payment:${user.id}`, limit: 15, windowMs: 60000 })
    let clientIp: string | undefined
    if (body.provider === 'wechat' && body.device === 'mobile') {
      const header = process.env.STORE_TRUSTED_CLIENT_IP_HEADER
      const raw = header ? request.headers.get(header)?.trim() : undefined
      if (!raw || !isIP(raw)) throw new ValidationError('移动支付网络信息尚未配置，请使用电脑扫码支付')
      clientIp = raw
    }
    const payment = await initiateStorePayment({ orderId: id, userId: user.id, provider: body.provider, device: body.device, clientIp })
    return NextResponse.json({ payment }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return handleApiError(error) }
}
