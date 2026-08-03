import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { validateProjectContent, validateProjectMediaOwnership } from '@/lib/api/project-validation'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { CreateProjectSchema } from '@/lib/schemas'
import type { Database, Json } from '@/lib/supabase/types'
import { getProjects, type ProjectFilters } from '@/lib/api/explore-data'
import { parseExploreSortBy } from '@/lib/explore/presets'
import { getRecommendationViewerKey } from '@/lib/recommendations/viewer'
import { inferProjectSteamWeights } from '@/lib/config/project-steam-weights'
import { logger } from '@/lib/logger'
import { awardXpOnce } from '@/lib/api/server-awards'
import { getSubCategoryNameById, resolveSubCategoryId } from '@/lib/subcategories'

type ProjectInsert = Database['public']['Tables']['projects']['Insert']
type ProjectRow = Database['public']['Tables']['projects']['Row']
type MaterialInsert = Database['public']['Tables']['project_materials']['Insert']
type StepInsert = Database['public']['Tables']['project_steps']['Insert']

/**
 * GET /api/projects
 * 获取项目列表（用于客户端分页）
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const difficultyParam = searchParams.get('difficulty');
  const validDifficulties = ['easy', 'medium', 'hard', 'all', '1', '2', '3', '4', '5', '1-2', '3-4', '5-6'] as const;
  
  // Type predicate or just check
  const difficulty: ProjectFilters['difficulty'] = (validDifficulties as readonly string[]).includes(difficultyParam || '')
    ? (difficultyParam as ProjectFilters['difficulty'])
    : 'all';

  const filters: ProjectFilters = {
    category: searchParams.get('category') || undefined,
    subCategory: searchParams.get('subCategory') || undefined,
    difficulty,
    tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
    searchQuery: searchParams.get('q') || undefined,
  }

  const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0)
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '12', 10) || 12))
  const sortBy = parseExploreSortBy(searchParams.get('sortBy'))

  try {
    const viewerKey = sortBy === 'popular' ? await getRecommendationViewerKey() : undefined
    const { projects, hasMore, total } = await getProjects(filters, {
      page,
      pageSize,
      sortBy,
      shuffleSeed: viewerKey,
      shuffleBatch: 0,
      // 翻页/加载更多也走类别均衡——是否真的混合由 shouldBlendPopularExplore
      // 按筛选最终决定（选了 category/tags/search 会自动降级回单类语义）。
      blendPopular: sortBy === 'popular',
    })

    return NextResponse.json({
      projects,
      hasMore,
      total,
    })
  } catch (error) {
    logger.error('Error in GET /api/projects', { error })
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/projects
 * 创建新项目
 * 需要认证
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    // 检查用户认证
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-projects-create', limit: 6, windowMs: 60_000 })

    const body = await request.json()

    // 验证输入
    const parseResult = CreateProjectSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    validateProjectContent(parseResult.data)
    validateProjectMediaOwnership(parseResult.data, user.id)

    const {
      title,
      description,
      category,
      sub_category_id,
      sub_category,
      difficulty,
      difficulty_stars,
      image_url,
      challenge_id,
      reflection,
      problem_statement,
      iterations,
      materials,
      steps,
    } = parseResult.data;

    let resolvedSubCategoryId: number | null = null
    try {
      resolvedSubCategoryId = await resolveSubCategoryId(
        supabase,
        category,
        sub_category_id,
        sub_category,
      )
    } catch (error) {
      logger.error('Invalid project sub-category', { error, category, sub_category_id, sub_category })
      return NextResponse.json(
        { error: 'Invalid sub category' },
        { status: 400 }
      )
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

    await requireInteractionAccess(supabase, user, 'post')

    // 创建项目
    const newProject: ProjectInsert = {
      title,
      description,
      category,
      sub_category_id: resolvedSubCategoryId,
      difficulty: difficulty ?? null,
      difficulty_stars,
      image_url,
      challenge_id,
      reflection,
      problem_statement,
      iterations,
      steam_weights: steamWeights as unknown as Json,
      author_id: user.id,
      status: 'pending',
    }

    const { data: project, error: projectError } = (await supabase
      .from('projects')
      // Supabase type inference is failing for Insert, casting to any to proceed while ensuring runtime safety via Zod
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(newProject as any)
      .select()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .single()) as { data: ProjectRow | null, error: any };

    if (projectError || !project) {
      // 检查 Supabase 错误代码，如果需要
      if (projectError?.code) {
          logger.error('Supabase error code', { detail: projectError.code });
      }
      throw projectError || new Error('Failed to create project')
    }

    // 并行添加材料和步骤
    const promises: Promise<void>[] = []

    // 添加材料
    if (materials && materials.length > 0) {
      const materialInserts: MaterialInsert[] = materials.map((material, index) => ({
        project_id: project.id,
        material,
        sort_order: index,
      }))

      promises.push(
        (async () => {
          const { error } = await supabase
            .from('project_materials')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .insert(materialInserts as any)
          if (error) throw error
        })()
      )
    }

    // 添加步骤
    if (steps && steps.length > 0) {
      const stepInserts: StepInsert[] = steps.map((step, index) => ({
        project_id: project.id,
        title: step.title,
        description: step.description,
        image_url: step.image_url ?? null,
        sort_order: index,
      }))

      promises.push(
        (async () => {
          const { error } = await supabase
            .from('project_steps')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .insert(stepInserts as any)
          if (error) throw error
        })()
      )
    }

    // 等待所有子资源创建完成，失败时回滚主记录
    if (promises.length > 0) {
      try {
        await Promise.all(promises)
      } catch (childError) {
        const { error: rollbackError } = await supabase
          .from('projects')
          .delete()
          .eq('id', project.id)
          .eq('author_id', user.id)

        if (rollbackError) {
          logger.error('Failed to rollback project after child insert error', { error: rollbackError })
        }

        throw childError
      }
    }

    try {
      await awardXpOnce({
        userId: user.id,
        actionType: 'publish_project',
        resourceId: project.id,
      })
    } catch (awardError) {
      logger.error('Failed to award project XP', { error: awardError, projectId: project.id })
    }

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
