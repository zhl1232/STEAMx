import { NextResponse } from 'next/server'

import { handleSendSmsHook } from '@/lib/auth/send-sms-hook'

// Supabase Auth Send SMS Hook（HTTP）。由 Supabase Auth 服务端调用，不需要登录态/cookie；
// 安全边界是 Standard Webhooks 签名（SUPABASE_SEND_SMS_HOOK_SECRET）。说明见 docs/phone-auth.md。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const result = await handleSendSmsHook(req)
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
