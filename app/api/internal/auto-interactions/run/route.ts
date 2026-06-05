import { NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/api/auth'
import { runDueAutoInteractions } from '@/lib/auto-interactions'
import { logger } from '@/lib/logger'

function verifyInternalAuth(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  if (!secret) return false

  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

/**
 * POST /api/internal/auto-interactions/run
 * Worker entry: cron-triggered delayed automatic replies, likes, and collections.
 */
export async function POST(request: NextRequest) {
  if (!verifyInternalAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Number(body?.limit ?? 20)
    const result = await runDueAutoInteractions(limit)
    return NextResponse.json(result)
  } catch (error) {
    logger.error(error, { context: 'POST /api/internal/auto-interactions/run' })
    return handleApiError(error)
  }
}
