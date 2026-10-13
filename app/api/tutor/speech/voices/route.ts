import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { getTutorVoiceAccess } from '@/lib/ai/tutor/voice-access'
import { isTutorVoice } from '@/lib/ai/tutor/voice-catalog'

export async function GET() {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    return NextResponse.json(await getTutorVoiceAccess(supabase, user), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return handleApiError(error) }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'tutor-voice-preference', limit: 20, windowMs: 60_000 })
    const access = await getTutorVoiceAccess(supabase, user)
    if (!access.canChoose) return NextResponse.json({ error: '会员可以选择朗读声音。' }, { status: 403 })
    const body = await request.json().catch(() => null)
    if (!isTutorVoice(body?.voice)) return NextResponse.json({ error: '请选择可用音色。' }, { status: 400 })
    const { error } = await supabase.auth.updateUser({ data: { tutor_voice: body.voice } })
    if (error) throw error
    return NextResponse.json({ ...access, voice: body.voice }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return handleApiError(error) }
}
