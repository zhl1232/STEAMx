import { NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/api/auth'
import { runDueStoreSyncJobs } from '@/lib/store/alibaba-order'

export const dynamic = 'force-dynamic'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

/** Cron/worker entry for paid-order -> 1688 order orchestration. */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({})) as { limit?: unknown }
    const limit = Number(body.limit ?? 10)
    return NextResponse.json(await runDueStoreSyncJobs(Number.isFinite(limit) ? limit : 10))
  } catch (error) {
    return handleApiError(error)
  }
}
