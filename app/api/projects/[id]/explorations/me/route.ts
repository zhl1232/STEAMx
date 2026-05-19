import { NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { validateNumber } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/projects/[id]/explorations/me
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { id } = await params
    const projectId = validateNumber(id, 'Project id', { min: 1, integer: true })

    const { data: exploration, error } = await supabase
      .from('project_explorations')
      .select('*')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .maybeSingle()

    if (error) throw error

    const { data: finalRow } = await supabase
      .from('completed_projects')
      .select('id, status, record_kind')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .eq('record_kind', 'final')
      .in('status', ['pending', 'approved', 'rejected'])
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      exploration: exploration ?? null,
      finalCompletion: finalRow ?? null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
