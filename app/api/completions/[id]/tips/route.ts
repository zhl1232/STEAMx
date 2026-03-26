import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { getAccessibleCompletion } from '@/lib/api/completion-access'
import { validateNumber } from '@/lib/api/validation'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    await requireRateLimit(supabase, { key: 'api-completion-tips', limit: 30, windowMs: 60_000 })
    const { id } = await params
    const completionId = validateNumber(id, 'Completion id', { min: 1, integer: true })

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const completion = await getAccessibleCompletion(supabase, completionId, user?.id)
    if (!completion) {
      return NextResponse.json({ error: '作品不存在' }, { status: 404 })
    }

    const { data: receivedData, error: receivedError } = await supabase.rpc('get_tip_received_for_resource', {
      p_resource_type: 'completion',
      p_resource_id: completionId,
    } as never)
    if (receivedError) throw receivedError

    let myTipped = 0
    if (user) {
      const { data: myTipData, error: myTipError } = await supabase.rpc('get_my_tip_for_resource', {
        p_resource_type: 'completion',
        p_resource_id: completionId,
      } as never)
      if (myTipError) throw myTipError
      myTipped = (myTipData as number) ?? 0
    }

    return NextResponse.json({
      received: (receivedData as number) ?? 0,
      myTipped,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
