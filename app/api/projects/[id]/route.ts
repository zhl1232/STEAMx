import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { validateProjectContent } from '@/lib/api/project-validation'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateNumber } from '@/lib/api/validation'
import { inferProjectSteamWeights } from '@/lib/config/project-steam-weights'
import { logger } from '@/lib/logger'
import { CreateProjectSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'
import { getSubCategoryNameById, resolveSubCategoryId } from '@/lib/subcategories'

const UpdateProjectSchema = CreateProjectSchema.extend({
  request_re_review: z.boolean().optional().default(true),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-projects-update', limit: 10, windowMs: 60_000 })

    const { id } = await params
    const projectId = validateNumber(id, 'Project id', { min: 1, integer: true })
    const body = await request.json()
    const parsed = UpdateProjectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      )
    }

    validateProjectContent(parsed.data)

    const {
      title,
      description,
      category,
      sub_category_id,
      sub_category,
      difficulty,
      difficulty_stars,
      image_url,
      reflection,
      problem_statement,
      iterations,
      materials,
      steps,
      request_re_review,
    } = parsed.data

    const { data: existingProject, error: existingProjectError } = await supabase
      .from('projects')
      .select('id, author_id')
      .eq('id', projectId)
      .maybeSingle()

    if (existingProjectError) {
      throw existingProjectError
    }

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if ((existingProject as { author_id: string }).author_id !== user.id) {
      return NextResponse.json({ error: '无权编辑该项目' }, { status: 403 })
    }

    let resolvedSubCategoryId: number | null = null
    try {
      resolvedSubCategoryId = await resolveSubCategoryId(
        supabase,
        category,
        sub_category_id,
        sub_category,
      )
    } catch (error) {
      logger.error('Invalid project sub-category during update', { error, category, sub_category_id, sub_category })
      return NextResponse.json({ error: 'Invalid sub category' }, { status: 400 })
    }

    const resolvedSubCategoryName =
      sub_category?.trim() || await getSubCategoryNameById(supabase, resolvedSubCategoryId)
    const steamWeights = inferProjectSteamWeights({
      title,
      description,
      category,
      subCategory: resolvedSubCategoryName,
      steps,
    })

    const { error: projectError } = await supabase
      .from('projects')
      .update({
        title,
        description,
        category,
        sub_category_id: resolvedSubCategoryId,
        difficulty: difficulty ?? null,
        difficulty_stars,
        image_url: image_url ?? null,
        reflection: reflection ?? null,
        problem_statement: problem_statement ?? null,
        iterations,
        steam_weights: steamWeights as unknown as Json,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', projectId)
      .eq('author_id', user.id)

    if (projectError) {
      throw projectError
    }

    const { error: deleteMaterialsError } = await supabase
      .from('project_materials')
      .delete()
      .eq('project_id', projectId)

    if (deleteMaterialsError) {
      throw deleteMaterialsError
    }

    if (materials.length > 0) {
      const { error: insertMaterialsError } = await supabase
        .from('project_materials')
        .insert(materials.map((material, index) => ({
          project_id: projectId,
          material,
          sort_order: index,
        })) as never)

      if (insertMaterialsError) {
        throw insertMaterialsError
      }
    }

    const { error: deleteStepsError } = await supabase
      .from('project_steps')
      .delete()
      .eq('project_id', projectId)

    if (deleteStepsError) {
      throw deleteStepsError
    }

    if (steps.length > 0) {
      const { error: insertStepsError } = await supabase
        .from('project_steps')
        .insert(steps.map((step, index) => ({
          project_id: projectId,
          title: step.title,
          description: step.description,
          image_url: step.image_url ?? null,
          sort_order: index,
        })) as never)

      if (insertStepsError) {
        throw insertStepsError
      }
    }

    if (request_re_review) {
      const { error: reReviewError } = await (
        supabase.rpc as unknown as (fn: string, args: unknown) => Promise<{ error: unknown }>
      )('request_project_re_review', {
        p_project_id: projectId,
      })

      if (reReviewError) {
        logger.error('Failed to request project re-review', { error: reReviewError, projectId })
      }
    }

    return NextResponse.json({
      project: {
        id: projectId,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
