import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { reconcileStoreTransactions } from '@/lib/store/payment-flow'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  const expected = Buffer.from(`Bearer ${secret || ''}`)
  const actual = Buffer.from(request.headers.get('authorization') || '')
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { return NextResponse.json(await reconcileStoreTransactions()) } catch { return NextResponse.json({ error: '对账暂时不可用' }, { status: 503 }) }
}
