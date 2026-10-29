import { NextResponse } from 'next/server'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

/** Existing room reads/actions remain available; all new rooms use the race rules. */
export async function POST() {
  try {
    await requireAuth(await createClient())
    return NextResponse.json({ error: '旧版翻牌房间已停止创建，请使用同步竞速邀请入口', code: 'MEMORY_RACE_REQUIRED' }, { status: 410 })
  } catch (error) { return handleApiError(error) }
}
