/**
 * 探索页面数据获取函数
 * 用于服务端组件中获取项目列表
 */

import { createClient } from '@/lib/supabase/server'
import { mapDbProject, mapDbCompletion, type Project, type ProjectCompletion } from '@/lib/mappers/types'

/**
 * 项目筛选参数
 */
export interface ProjectFilters {
    category?: string
    subCategory?: string // 按子分类筛选（单选）
    difficulty?: 'easy' | 'medium' | 'hard' | 'all' | '1-2' | '3-4' | '5-6'
    minDuration?: number
    maxDuration?: number
    materials?: string[]
    tags?: string[]  // 标签筛选（多选）
    searchQuery?: string
}

/**
 * 分页参数
 */
export interface PaginationOptions {
    page?: number
    pageSize?: number
}

/**
 * 获取已审核通过的项目列表
 * 
 * @param filters - 筛选条件
 * @param pagination - 分页参数
 * @returns 项目列表和总数
 */
export async function getProjects(
    filters: ProjectFilters = {},
    pagination: PaginationOptions = {}
): Promise<{ projects: Project[]; total: number; hasMore: boolean }> {
    const supabase = await createClient()

    const {
        category,
        subCategory,
        difficulty,
        minDuration,
        maxDuration,
        materials,
        tags,
        searchQuery
    } = filters

    const {
        page = 0,
        pageSize = 12
    } = pagination

    const from = page * pageSize
    const to = from + pageSize - 1

    // 构建查询
    let selectStatement = `
      *,
      profiles:author_id (display_name),
      project_materials (*),
      project_steps (*),
      sub_categories (name)
    `

    // 如果有子分类筛选，需要使用 inner join
    if (subCategory) {
        selectStatement = `
          *,
          profiles:author_id (display_name),
          project_materials (*),
          project_steps (*),
          sub_categories!inner (name)
        `
    }

    let query = supabase
        .from('projects')
        .select(selectStatement, { count: 'exact' })
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .range(from, to)

    // 应用筛选条件
    if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
    }

    if (category && category !== '全部') {
        query = query.eq('category', category)
    }

    if (subCategory) {
        query = query.eq('sub_categories.name', subCategory)
    }

    // 难度筛选：支持星级范围
    if (difficulty && difficulty !== 'all') {
        if (difficulty === '1-2') {
            query = query.gte('difficulty_stars', 1).lte('difficulty_stars', 2)
        } else if (difficulty === '3-4') {
            query = query.gte('difficulty_stars', 3).lte('difficulty_stars', 4)
        } else if (difficulty === '5-6') {
            query = query.gte('difficulty_stars', 5).lte('difficulty_stars', 6)
        } else {
            query = query.eq('difficulty', difficulty)
        }
    }

    // 标签筛选：匹配包含所有选中标签的项目（AND 关系）
    if (tags && tags.length > 0) {
        // 使用 contains 操作符检查 tags 数组是否包含所有指定的标签
        query = query.contains('tags', tags)
    }

    if (minDuration !== undefined || maxDuration !== undefined) {
        if (minDuration !== undefined) {
            query = query.gte('duration', minDuration)
        }
        if (maxDuration !== undefined) {
            query = query.lte('duration', maxDuration)
        }
    }

    // 材料筛选需要特殊处理
    if (materials && materials.length > 0) {
        const { data: projectsWithMaterials } = await supabase
            .from('project_materials')
            .select('project_id')
            .in('material', materials)

        if (projectsWithMaterials && projectsWithMaterials.length > 0) {
            const projectIds = Array.from(new Set(projectsWithMaterials.map((m: any) => m.project_id)))
            query = query.in('id', projectIds)
        } else {
            // 没有匹配的项目
            return { projects: [], total: 0, hasMore: false }
        }
    }

    const { data, error, count } = await query

    if (error) {
        console.error('Error fetching projects:', error)
        return { projects: [], total: 0, hasMore: false }
    }

    const projects = (data || []).map(mapDbProject)
    const total = count || 0
    const hasMore = total > to + 1

    return { projects, total, hasMore }
}

/**
 * 获取单个项目详情
 * 
 * @param id - 项目 ID
 * @returns 项目详情或 null
 */
export async function getProjectById(id: string | number): Promise<Project | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('projects')
        .select(`
      *,
      profiles:author_id (display_name),
      project_materials (*),
      project_steps (*),
      sub_categories (name),
      comments (
        *,
        profiles:author_id (display_name, avatar_url)
      )
    `)
        .eq('id', id)
        .single()

    if (error || !data) {
        console.error('Error fetching project:', error)
        return null
    }

    return mapDbProject(data)
}

/**
 * 获取相关项目推荐
 * 
 * @param projectId - 当前项目 ID
 * @param category - 项目分类
 * @param limit - 返回数量
 * @returns 相关项目列表
 */
export async function getRelatedProjects(
    projectId: string | number,
    category: string,
    limit: number = 3
): Promise<Project[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('projects')
        .select(`
      *,
      profiles:author_id (display_name),
      project_materials (*),
      project_steps (*),
      sub_categories (name)
    `)
        .eq('category', category)
        .eq('status', 'approved')
        .neq('id', projectId)
        .limit(limit)

    if (error || !data) {
        console.error('Error fetching related projects:', error)
        return []
    }

    return data.map(mapDbProject)
}

/**
 * 获取项目的完成记录（作品墙）
 * 
 * @param projectId - 项目 ID
 * @param limit - 返回数量
 * @returns 完成记录列表
 */
export async function getProjectCompletions(
    projectId: string | number,
    limit: number = 4
): Promise<ProjectCompletion[]> {
    const supabase = await createClient()

    // 注意：proof_images 是 text[] 类型，Supabase JS client 会正确处理
    // 默认只获取公开的记录 (is_public = true)

    // 由于我们还没有更新本地 Database types，这里使用 any 绕过类型检查
    // 实际上我们在 migration 002 中已经添加了 proof_images 等字段
    const { data, error } = await supabase
        .from('completed_projects')
        .select(`
            *,
            profiles:user_id (display_name, avatar_url)
        `)
        .eq('project_id', projectId)
        .eq('is_public', true)
        .order('completed_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('Error fetching completions:', error)
        return []
    }

    return (data || []).map((item: any) => mapDbCompletion(item))
}
