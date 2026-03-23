import { NextRequest, NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateNumber } from '@/lib/api/validation'
import { CreateProjectSchema } from '@/lib/schemas'
import type { Database, Json } from '@/lib/supabase/types'
import { callRpc } from '@/lib/supabase/rpc'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

import type { SteamWeights } from '@/lib/config/subcategory-steam-weights'

const SteamWeightsSchema = z.object({
  S: z.number().int().min(0).max(100),
  T: z.number().int().min(0).max(100),
  E: z.number().int().min(0).max(100),
  A: z.number().int().min(0).max(100),
  M: z.number().int().min(0).max(100),
})

const AdminProjectUpdateSchema = CreateProjectSchema.omit({
  challenge_id: true,
  difficulty: true,
  iterations: true,
  materials: true,
  problem_statement: true,
  reflection: true,
  steps: true,
  status: true,
  sub_category: true,
}).extend({
  project_materials: z.array(z.object({
    material: z.string().min(1).max(200),
    sort_order: z.number().int().optional(),
  })).max(50).default([]),
  project_steps: CreateProjectSchema.shape.steps,
  steam_weights: SteamWeightsSchema.nullable().optional(),
})

type AdminUpdateProjectArgs = Database['public']['Functions']['admin_update_project']['Args']

function getErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }

  return null
}

/**
 * PATCH /api/admin/projects/[id]
 * 管理端编辑项目内容（不处理审批状态）
 * 需要 moderator/admin 权限
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])

    const { id } = await params
    const projectId = validateNumber(id, 'Project id', { min: 1, integer: true })
    const body = await request.json()
    const parsed = AdminProjectUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 }
      )
    }

    const payload = parsed.data
    const steamWeights =
      ((payload.steam_weights as SteamWeights | null) ?? null) as AdminUpdateProjectArgs['p_steam_weights']

    const { data, error } = await callRpc(supabase, 'admin_update_project', {
      p_project_id: projectId,
      p_title: payload.title,
      p_description: payload.description,
      p_category: payload.category,
      p_sub_category_id: payload.sub_category_id ?? null,
      p_difficulty_stars: payload.difficulty_stars,
      p_image_url: payload.image_url ?? null,
      p_duration: payload.duration,
      p_steam_weights: steamWeights as Json | null,
      p_steps: payload.project_steps,
      p_materials: payload.project_materials.map((material, index) => ({
        material: material.material,
        sort_order: index + 1,
      })),
    })

    if (error) {
      if (getErrorCode(error) === 'P0002') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }

      throw error
    }

    const project = Array.isArray(data) ? data[0] ?? null : null
    return NextResponse.json({ project })
  } catch (error) {
    return handleApiError(error)
  }
}
