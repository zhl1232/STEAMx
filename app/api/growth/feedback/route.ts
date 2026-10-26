import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callRpc } from '@/lib/supabase/rpc'
import { handleApiError } from '@/lib/api/auth'
export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type')
    const ids = (request.nextUrl.searchParams.get('ids') || '').split(',').map(Number)
    if (!['comment', 'project_comment'].includes(type || '') || !ids.length || ids.length > 200 || ids.some(id => !Number.isSafeInteger(id) || id < 1)) return NextResponse.json({ error: 'Invalid feedback request' }, { status: 400 })
    const { data, error } = await callRpc(await createClient(), 'growth_exchange_feedback', { p_type: type!, p_ids: ids })
    if (error) throw error
    return NextResponse.json({ feedback: data }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return handleApiError(error) }
}
