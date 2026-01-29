/**
 * 类型映射工具
 * 从数据库类型 (Database) 转换为前端友好的类型
 * 这是类型定义的单一来源 (Single Source of Truth)
 */

import type { Database } from '@/lib/supabase/types'

// ============================================================
// 数据库表类型提取
// ============================================================

type DbProject = Database['public']['Tables']['projects']['Row']
type DbProfile = Database['public']['Tables']['profiles']['Row']
type DbComment = Database['public']['Tables']['comments']['Row']
type DbDiscussion = Database['public']['Tables']['discussions']['Row']
type DbDiscussionReply = Database['public']['Tables']['discussion_replies']['Row']
type DbChallenge = Database['public']['Tables']['challenges']['Row']
type DbProjectMaterial = Database['public']['Tables']['project_materials']['Row']
type DbProjectStep = Database['public']['Tables']['project_steps']['Row']
type DbSubCategory = Database['public']['Tables']['sub_categories']['Row']
type DbCompletedProject = Database['public']['Tables']['completed_projects']['Row']

// ============================================================
// 前端类型定义
// ============================================================

/**
 * 项目类型
 * 从数据库 projects 表映射而来
 */
export interface Project {
    id: string | number
    title: string
    author: string
    author_id: string
    image: string
    category: string
    sub_category_id?: number
    sub_category?: string // 子分类名称
    likes: number
    description?: string
    materials?: string[]
    steps?: ProjectStep[]
    comments?: Comment[]
    difficulty?: 'easy' | 'medium' | 'hard'
    difficulty_stars?: number  // 1-6 星
    duration?: number
    tags?: string[]
    status?: 'draft' | 'pending' | 'approved' | 'rejected'
}

/**
 * 项目步骤类型
 */
export interface ProjectStep {
    title: string
    description: string
    image_url?: string
}

/**
 * 评论类型
 */
export interface Comment {
    id: string | number
    author: string
    userId?: string
    avatar?: string
    content: string
    date: string
    parent_id?: number | null
    reply_to_user_id?: string | null
    reply_to_username?: string | null
}

/**
 * 讨论类型
 */
export interface Discussion {
    id: string | number
    title: string
    author: string
    content: string
    date: string
    replies: Comment[]
    likes: number
    tags: string[]
}

/**
 * 挑战类型
 */
export interface Challenge {
    id: string | number
    title: string
    description: string
    image: string
    participants: number
    daysLeft: number
    endDate?: string
    joined: boolean
    tags: string[]
}

/**
 * 用户资料类型
 */
export interface Profile {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    bio: string | null
    xp: number
    role: 'user' | 'moderator' | 'admin'
}

/**
 * 项目完成记录类型
 */
export interface ProjectCompletion {
    userId: string
    projectId: string | number
    author: string
    avatar?: string
    completedAt: string
    proofImages: string[]
    proofVideoUrl?: string
    notes?: string
    isPublic: boolean
}

// ============================================================
// 类型映射函数
// ============================================================

/**
 * 将数据库 Project 类型映射为前端 Project 类型
 */
export function mapDbProject(
    dbProject: DbProject & {
        profiles?: Pick<DbProfile, 'display_name'> | null
        project_materials?: DbProjectMaterial[]
        project_steps?: DbProjectStep[]
        sub_categories?: Pick<DbSubCategory, 'name'> | null
        comments?: any[]
    }
): Project {
    return {
        id: dbProject.id,
        title: dbProject.title,
        author: dbProject.profiles?.display_name || 'Unknown',
        author_id: dbProject.author_id || '',
        image: dbProject.image_url || '',
        category: dbProject.category || '',
        sub_category_id: dbProject.sub_category_id || undefined,
        sub_category: dbProject.sub_categories?.name || undefined,
        likes: dbProject.likes_count,
        description: dbProject.description || '',
        materials: dbProject.project_materials
            ?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(m => m.material) || [],
        steps: dbProject.project_steps
            ?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(s => ({
                title: s.title,
                description: s.description || '',
                image_url: s.image_url || undefined
            })) || [],
        comments: dbProject.comments?.map(c => mapDbComment(c)) || [],
        difficulty: (dbProject.difficulty as 'easy' | 'medium' | 'hard') || undefined,
        difficulty_stars: dbProject.difficulty_stars || 3,
        duration: dbProject.duration || undefined,
        tags: (dbProject as any).tags || [],  // 从数据库获取标签
        status: (dbProject.status as 'draft' | 'pending' | 'approved' | 'rejected') || 'pending'
    }
}

/**
 * 将数据库 Comment 类型映射为前端 Comment 类型
 */
export function mapDbComment(
    dbComment: any
): Comment {
    return {
        id: dbComment.id,
        author: dbComment.profiles?.display_name || 'Unknown',
        userId: dbComment.author_id,
        avatar: dbComment.profiles?.avatar_url || undefined,
        content: dbComment.content,
        date: new Date(dbComment.created_at).toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }),
        parent_id: dbComment.parent_id || null,
        reply_to_user_id: dbComment.reply_to_user_id || null,
        reply_to_username: dbComment.reply_to_username || null
    }
}

/**
 * 将数据库 Discussion 类型映射为前端 Discussion 类型
 */
export function mapDbDiscussion(
    dbDiscussion: DbDiscussion & {
        profiles?: Pick<DbProfile, 'display_name'> | null
        discussion_replies?: any[]
    }
): Discussion {
    return {
        id: dbDiscussion.id,
        title: dbDiscussion.title,
        author: dbDiscussion.profiles?.display_name || 'Unknown',
        content: dbDiscussion.content,
        date: new Date(dbDiscussion.created_at).toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        replies: dbDiscussion.discussion_replies?.map(mapDbComment) || [],
        likes: dbDiscussion.likes_count,
        tags: dbDiscussion.tags || []
    }
}

/**
 * 将数据库 Challenge 类型映射为前端 Challenge 类型
 */
export function mapDbChallenge(
    dbChallenge: DbChallenge,
    joined: boolean = false
): Challenge {
    const endDate = dbChallenge.end_date ? new Date(dbChallenge.end_date) : null
    const daysLeft = endDate
        ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0

    return {
        id: dbChallenge.id,
        title: dbChallenge.title,
        description: dbChallenge.description || '',
        image: dbChallenge.image_url || '',
        participants: dbChallenge.participants_count,
        daysLeft,
        endDate: dbChallenge.end_date || undefined,
        joined,
        tags: dbChallenge.tags || []
    }
}

/**
 * 将数据库 Profile 类型映射为前端 Profile 类型
 */
export function mapDbProfile(dbProfile: DbProfile): Profile {
    return {
        id: dbProfile.id,
        username: dbProfile.username,
        display_name: dbProfile.display_name,
        avatar_url: dbProfile.avatar_url,
        bio: dbProfile.bio,
        xp: dbProfile.xp,
        role: (dbProfile.role as 'user' | 'moderator' | 'admin') || 'user'
    }
}

/**
 * 将数据库 CompletedProject 类型映射为前端 ProjectCompletion 类型
 */
export function mapDbCompletion(
    dbCompletion: DbCompletedProject & {
        profiles?: Pick<DbProfile, 'display_name' | 'avatar_url'> | null
    }
): ProjectCompletion {
    const data = dbCompletion as any;
    return {
        userId: data.user_id,
        projectId: data.project_id,
        author: dbCompletion.profiles?.display_name || 'Unknown',
        avatar: dbCompletion.profiles?.avatar_url || undefined,
        completedAt: new Date(data.completed_at || '').toLocaleDateString('zh-CN'),
        proofImages: data.proof_images || [],
        proofVideoUrl: data.proof_video_url || undefined,
        notes: data.notes || undefined,
        isPublic: data.is_public ?? true
    }
}
