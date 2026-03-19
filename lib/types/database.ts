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
  gender?: string | null;
  role: "user" | "teacher" | "moderator" | "admin";
  xp: number;
  coins?: number;
  equipped_avatar_frame_id?: string;
  equipped_name_color_id?: string;
  equipped_theme_id?: string | null;
  birth_date?: string | null;
  message_privacy?: "everyone" | "followers_only" | "nobody";
  age_confirmed_at?: string | null;
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
export type ProjectStatus = "draft" | "pending" | "approved" | "rejected";

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
  likes_count?: number;
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

export type ChallengeType = "timed" | "evergreen";
export type ChallengeStatus = "draft" | "active" | "ended" | "archived";

/**
 * 挑战
 */
export interface Challenge {
  id: number | string;
  title: string;
  description: string;
  image_url?: string;
  challenge_type: ChallengeType;
  status: ChallengeStatus;
  participants_count: number;
  completions_count: number;
  difficulty_stars: number;
  start_date?: string;
  end_date?: string;
  tags?: string[];
  scenario?: string;
  driving_question?: string;
  expected_outcome?: string;
  constraints?: string[];
  resources?: unknown[];
  stages?: unknown[];
  steam_weights?: Record<string, number>;
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
 * 挑战完成记录（长期挑战）
 */
export interface ChallengeCompletion {
  user_id: string;
  challenge_id: number;
  project_id?: number;
  completed_at?: string;
}

/**
 * 挑战多维评分
 */
export interface ChallengeRating {
  id: number;
  project_id: number;
  user_id: string;
  creativity: number;
  practicality: number;
  technical: number;
  reflection_depth: number;
  created_at?: string;
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

/**
 * 举报内容类型
 */
export type ReportContentType =
  | "project"
  | "discussion"
  | "discussion_reply"
  | "comment"
  | "message"
  | "completion_comment";

/**
 * 举报原因
 */
export type ReportReason =
  | "spam"
  | "harassment"
  | "inappropriate"
  | "illegal"
  | "other";

/**
 * 举报状态
 */
export type ReportStatus = "pending" | "resolved" | "dismissed";

/**
 * 内容举报
 */
export interface Report {
  id: number;
  reporter_id: string;
  content_type: ReportContentType;
  content_id: number;
  reason: ReportReason;
  description?: string | null;
  status: ReportStatus;
  reviewer_id?: string | null;
  reviewer_note?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}
