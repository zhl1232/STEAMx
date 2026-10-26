import { NextRequest, NextResponse } from 'next/server'
import { runFeishuDispatch } from '@/lib/support/feishu/service'
import { FeishuBridgeError } from '@/lib/support/feishu/config'
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { return NextResponse.json(await runFeishuDispatch(), { headers: { 'Cache-Control': 'no-store' } }) }
  catch (error) { return NextResponse.json({ error: error instanceof FeishuBridgeError ? error.code : 'bridge_unavailable' }, { status: 503 }) }
}
