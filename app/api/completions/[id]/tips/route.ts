import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const completionId = Number(id)
    if (Number.isNaN(completionId)) {
      return NextResponse.json({ error: 'Invalid completion id' }, { status: 400 })
    }

    const { data: receivedData, error: receivedError } = await supabase.rpc('get_tip_received_for_resource', {
      p_resource_type: 'completion',
      p_resource_id: completionId,
    } as never)
    if (receivedError) throw receivedError

    const {
      data: { user },
    } = await supabase.auth.getUser()

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
    console.error('Error in GET /api/completions/[id]/tips:', error)
    return NextResponse.json({ error: 'Failed to fetch tips' }, { status: 500 })
  }
}
