/**
 * 探索页面数据获取函数
 * 用于服务端组件中获取项目列表
 */

import { createClient } from '@/lib/supabase/server'
import { mapDbProject, mapDbCompletion, mapDbComment, type Project, type ProjectCompletion, type Comment } from '@/lib/mappers/types'

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
            // 类型断言：数据库查询返回的类型可能与本地类型定义不同步
            const projectIds = Array.from(new Set((projectsWithMaterials as { project_id: number }[]).map((m) => m.project_id)))
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
      sub_categories (name)
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
 * 分页获取项目评论
 * 
 * @param projectId - 项目 ID
 * @param page - 页码 (0-indexed)
 * @param pageSize - 每页数量
 * @returns 评论列表和总数
 */
export async function getProjectComments(
    projectId: string | number,
    page: number = 0,
    pageSize: number = 10
): Promise<{ comments: Comment[]; total: number; hasMore: boolean }> {
    const supabase = await createClient()

    const from = page * pageSize
    const to = from + pageSize - 1

    const { data: roots, error, count } = await supabase
        .from('comments')
        .select(`
            *,
            profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id)
        `, { count: 'exact' })
        .eq('project_id', projectId)
        .is('parent_id', null)  // Only fetch root comments
        .order('created_at', { ascending: false }) // Newest first
        .range(from, to)

    if (error) {
        console.error('Error fetching project comments:', error)
        return { comments: [], total: 0, hasMore: false }
    }

    let allComments = (roots || []).map(mapDbComment)

    // Fetch replies for these roots
    if (roots && roots.length > 0) {
        const rootIds = (roots as { id: number }[]).map(r => r.id)
        const { data: replies } = await supabase
            .from('comments')
            .select(`
                *,
                profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id)
            `)
            .in('parent_id', rootIds)
            .order('created_at', { ascending: true }) // Oldest first for replies

        if (replies) {
            const mappedReplies = replies.map(mapDbComment)
            allComments = [...allComments, ...mappedReplies]
        }
    }

    return {
        comments: allComments,
        total: count || 0,
        hasMore: (count || 0) > to + 1
    }
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

    // 先查询 completed_projects
    // 使用类型断言因为本地 types.ts 可能未同步数据库最新 schema
    const { data: completions, error } = await supabase
        .from('completed_projects')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_public', true)
        .order('completed_at', { ascending: false })
        .limit(limit)

    if (error || !completions) {
        console.error('Error fetching completions:', error)
        return []
    }

    // 获取所有 user_ids（类型断言：Supabase 类型可能未同步）
    type CompletionRow = { user_id: string; [key: string]: unknown }
    const userIds = [...new Set((completions as CompletionRow[]).map((c) => c.user_id))]

    // 单独查询 profiles
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds)

    // 创建 profiles 映射
    type ProfileRow = { id: string; display_name: string | null; avatar_url: string | null }
    const profilesMap = new Map((profiles as ProfileRow[] || []).map((p) => [p.id, p]))

    // 组合数据
    type CompletionData = { user_id: string; id: number; project_id: number; completed_at: string; proof_images: string[]; proof_video_url: string | null; notes: string | null; is_public: boolean; likes_count: number }
    return (completions as CompletionData[]).map((item) => {
        const profile = profilesMap.get(item.user_id)
        return mapDbCompletion({
            ...item,
            profiles: profile || null
        })
    })
}
