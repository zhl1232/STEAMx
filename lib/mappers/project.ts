/**
 * 项目数据映射工具函数
 * 统一处理从数据库到应用层的数据转换
 */

import type { Project, Comment } from '@/lib/types'

/**
 * 数据库项目类型（简化版，包含常见字段）
 */
/**
 * 数据库项目类型（简化版，包含常见字段）
 */
export type DbProject = {
  id: number
  title: string
  author_id: string
  image_url: string | null
  category: string | null
  likes_count: number
  description: string | null
  created_at: string
  status?: 'draft' | 'pending' | 'approved' | 'rejected'  // 审核状态
  difficulty?: 'easy' | 'medium' | 'hard'  // 难度
  duration?: number  // 时长
  tags?: string[]  // 标签
  profiles?: {
    display_name?: string
    username?: string
  } | null
  project_materials?: Array<{
    material: string
    sort_order: number
  }> | null
  project_steps?: Array<{
    title: string
    description: string | null
    sort_order: number
  }> | null
  comments?: Array<DbComment> | null
}

export type DbComment = {
  id: number
  author_id: string
  content: string
  created_at: string
  parent_id: number | null
  reply_to_user_id: string | null
  reply_to_username: string | null
  likes_count?: number | null
  image_url?: string | null
  profiles?: {
    display_name?: string
    username?: string
    avatar_url?: string
  } | null
}

/**
 * 映射基础项目信息（不包含关联数据）
 */
export function mapProject(p: DbProject, authorName?: string): Project {
  return {
    id: p.id,
    title: p.title,
    author: authorName || p.profiles?.display_name || p.profiles?.username || 'Unknown',
    author_id: p.author_id,
    image: p.image_url || '',
    category: p.category || '',
    likes: p.likes_count,
    description: p.description || '',
    status: p.status,  // 审核状态
    difficulty: p.difficulty,  // 难度
    duration: p.duration,  // 时长
    tags: p.tags || []  // 标签
  }
}

/**
 * 映射完整项目信息（包含材料、步骤、评论）
 */
export function mapProjectWithDetails(p: DbProject): Project {
  return {
    ...mapProject(p),
    materials: p.project_materials
      ?.sort((a, b) => a.sort_order - b.sort_order)
      .map(m => m.material) || [],
    steps: p.project_steps
      ?.sort((a, b) => a.sort_order - b.sort_order)
      .map(s => ({
        title: s.title,
        description: s.description || ''
      })) || [],
    comments: p.comments?.map(mapComment) || []
  }
}

/**
 * 映射评论/回复信息
 */
export function mapComment(c: DbComment): Comment {
  return {
    id: c.id,
    author: c.profiles?.display_name || c.profiles?.username || 'Unknown',
    userId: c.author_id,
    avatar: c.profiles?.avatar_url,
    content: c.content,
    date: new Date(c.created_at).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    created_at: c.created_at,
    image_url: c.image_url ?? null,
    likes_count: c.likes_count ?? 0,
    parent_id: c.parent_id,
    reply_to_user_id: c.reply_to_user_id,
    reply_to_username: c.reply_to_username
  }
}
