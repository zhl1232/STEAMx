import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/auth'
import { ownConversation, supportSession } from '@/lib/support/server'
import { channelFromSearch } from '@/lib/support/validation'
export async function POST(request: NextRequest) {
  try {
    const channel = channelFromSearch(request.nextUrl.searchParams)
    return NextResponse.json({ conversation: await ownConversation(await supportSession(), channel) })
  } catch (error) { return handleApiError(error) }
}
export async function GET(request: NextRequest) {
  try {
    const channel = channelFromSearch(request.nextUrl.searchParams)
    const ctx = await supportSession()
    const result = await ctx.db.from('support_conversations').select('*').eq('user_id', ctx.user.id).eq('channel', channel).maybeSingle()
    if (result.error) throw result.error
    return NextResponse.json({ conversation: result.data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return handleApiError(error) }
}
