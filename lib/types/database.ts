/**
 * 数据库类型定义
 * 包含 Supabase 数据库中的主要表结构类型
 */

/**
 * 用户配置文件
 */
export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  role: 'user' | 'moderator' | 'admin';
  xp: number;
  coins?: number;
  equipped_avatar_frame_id?: string;
  equipped_name_color_id?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * 主分类
 */
export interface Category {
  id: number;
  name: string;
  icon?: string;
  sort_order: number;
  created_at?: string;
}

/**
 * 子分类
 */
export interface SubCategory {
  id: number;
  category_id: number;
  name: string;
  sort_order: number;
  created_at?: string;
}

/**
 * 项目状态
 */
export type ProjectStatus = 'draft' | 'pending' | 'approved' | 'rejected';

/**
 * 项目
 */
export interface Project {
  id: number | string;
  title: string;
  description?: string;
  author_id: string;
  image_url?: string;
  category?: string;
  sub_category_id?: number;
  difficulty_stars: number;
  duration?: number;
  likes_count: number;
  views_count?: number;
  status?: ProjectStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * 项目材料
 */
export interface ProjectMaterial {
  id: number;
  project_id: number;
  material: string;
  sort_order: number;
}

/**
 * 项目步骤
 */
export interface ProjectStep {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  sort_order: number;
}

/**
 * 评论
 */
export interface Comment {
  id: number | string;
  project_id?: number;
  discussion_id?: number;
  author_id: string;
  content: string;
  created_at?: string;
}

/**
 * 讨论
 */
export interface Discussion {
  id: number | string;
  title: string;
  content: string;
  author_id: string;
  tags?: string[];
  likes_count: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * 挑战
 */
export interface Challenge {
  id: number | string;
  title: string;
  description: string;
  image_url?: string;
  participants_count: number;
  start_date?: string;
  end_date?: string;
  tags?: string[];
  created_at?: string;
}

/**
 * 标签
 */
export interface Tag {
  id: number;
  name: string;
  category?: string;
  created_by?: string;
  created_at?: string;
}

/**
 * 点赞
 */
export interface Like {
  user_id: string;
  project_id: number;
  created_at?: string;
}

/**
 * 完成的项目
 */
export interface CompletedProject {
  user_id: string;
  project_id: number;
  completed_at?: string;
}

/**
 * 挑战参与者
 */
export interface ChallengeParticipant {
  user_id: string;
  challenge_id: number;
  joined_at?: string;
}

/**
 * 私信消息
 */
export interface Message {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}
