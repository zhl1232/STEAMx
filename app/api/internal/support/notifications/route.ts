import { NextRequest,NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/auth'
import { runSupportNotifications } from '@/lib/support/notifications'
export async function POST(request:NextRequest) {
  const secret=process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  if(!secret || request.headers.get('authorization')!==`Bearer ${secret}`) return NextResponse.json({error:'Unauthorized'},{status:401})
  try { return NextResponse.json(await runSupportNotifications()) }
  catch(error) { return handleApiError(error) }
}
