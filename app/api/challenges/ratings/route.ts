import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { validateNumber } from '@/lib/api/validation'
import { getChallengeRatingProject } from '@/lib/api/project-access'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const body = await request.json()

    const projectId = validateNumber(body.projectId, 'Project ID', { integer: true, min: 1 })
    const creativity = validateNumber(body.creativity, 'Creativity', { integer: true, min: 1, max: 5 })
    const practicality = validateNumber(body.practicality, 'Practicality', { integer: true, min: 1, max: 5 })
    const technical = validateNumber(body.technical, 'Technical', { integer: true, min: 1, max: 5 })
    const reflectionDepth = validateNumber(body.reflectionDepth, 'Reflection depth', { integer: true, min: 1, max: 5 })

    // Prevent self-rating
    const project = await getChallengeRatingProject(supabase, projectId)

    if (!project) {
      return NextResponse.json({ error: 'Challenge project not found' }, { status: 404 })
    }

    if (project.author_id === user.id) {
      return NextResponse.json({ error: '不能对自己的作品评分' }, { status: 403 })
    }

    // Upsert rating
    const { data, error } = await supabase
      .from('challenge_ratings')
      .upsert(
        {
          project_id: projectId,
          user_id: user.id,
          creativity,
          practicality,
          technical,
          reflection_depth: reflectionDepth,
        } as never,
        { onConflict: 'project_id,user_id' }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ rating: data })
  } catch (error) {
    return handleApiError(error)
  }
}
