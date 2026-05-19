import { NextRequest, NextResponse } from 'next/server'

import { runCompletionModeration } from '@/lib/completions/moderate-completion'
import { handleApiError } from '@/lib/api/auth'
import { logger } from '@/lib/logger'

function verifyInternalAuth(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  if (!secret) return false

  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

/**
 * POST /api/internal/moderate-completion
 * Worker 入口：Edge Function / Cron / 提交后异步触发
 */
export async function POST(request: NextRequest) {
  if (!verifyInternalAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const completionId = Number(body?.completionId)
    if (!Number.isInteger(completionId) || completionId <= 0) {
      return NextResponse.json({ error: 'Invalid completionId' }, { status: 400 })
    }

    const result = await runCompletionModeration(completionId)
    return NextResponse.json(result)
  } catch (error) {
    logger.error(error, { context: 'POST /api/internal/moderate-completion' })
    return handleApiError(error)
  }
}
