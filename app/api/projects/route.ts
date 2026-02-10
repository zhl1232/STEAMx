import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { CreateProjectSchema } from '@/lib/schemas'
import type { Database } from '@/lib/supabase/types'
import { getProjects, type ProjectFilters } from '@/lib/api/explore-data'

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
  const validDifficulties = ['easy', 'medium', 'hard', 'all', '1-2', '3-4', '5-6'] as const;
  
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

  const page = parseInt(searchParams.get('page') || '0', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '12', 10)

  try {
    const { projects, hasMore } = await getProjects(filters, { page, pageSize })

    return NextResponse.json({
      projects,
      hasMore
    })
  } catch (error) {
    console.error('Error in GET /api/projects:', error)
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

    const body = await request.json()

    // 验证输入
    const parseResult = CreateProjectSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { title, description, category, image_url, materials, steps } = parseResult.data;

    // 创建项目
    const newProject: ProjectInsert = {
      title,
      description,
      category,
      image_url,
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
          console.error('Supabase error code:', projectError.code);
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

    // 等待所有子资源创建完成
    if (promises.length > 0) {
      await Promise.all(promises)
    }

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
