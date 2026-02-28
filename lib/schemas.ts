import { z } from "zod";

// --- Database Schemas ---

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().nullable().optional(),
  avatar_url: z
    .union([z.string().url(), z.string().min(1).startsWith("/")])
    .nullable()
    .optional(),
  bio: z.string().nullable().optional(),
  xp: z.number().int().default(0),
  // Supabase/Postgres 返回 "YYYY-MM-DD HH:mm:ss..." 或带时区，非严格 ISO 8601，用 string 接受
  created_at: z.string().min(1),
});

// Basic schemas for parts
export const ProjectStepSchema = z.object({
  title: z.string().min(1, "Step title is required").max(200),
  description: z.string().max(1000).optional(),
  image_url: z.string().url().nullable().optional(),
  sort_order: z.number().int().optional(),
});

export const ProjectSchema = z.object({
  // 数据库 projects.id 为 bigserial，Supabase 返回 number
  id: z.union([z.string(), z.number()]),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  author_id: z.string().uuid(),
  created_at: z.string().min(1),
  updated_at: z.string().nullable().optional(),
  // Add other fields as necessary based on your actual table structure
  // e.g., is_public, view_count, etc.
});

// Schema for creating/updating a project
export const CreateProjectSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
  category: z.enum(['科学', '技术', '工程', '艺术', '数学'], {
    message: "Invalid category", 
  }),
  sub_category_id: z.number().nullable().optional(),
  difficulty_stars: z.number().min(1).max(5).default(1),
  duration: z.number().min(0).default(60),
  status: z.enum(['draft', 'pending', 'approved', 'rejected']).default('draft'),
  image_url: z.string().url("Invalid image URL").max(500).nullable().optional(),
  materials: z.array(z.string().min(1).max(200)).max(50).optional().default([]), // For simple array of strings (POST API format)
  // Or handle project_materials array of objects if needed, but POST API uses string array for simplicity?
  // Let's check API usage. API expects `materials: string[]`. Admin page uses objects.
  // We need a schema that supports both or distinct schemas.
  // Let's stick to API schema for now, but Admin page might need transformation.
  steps: z.array(ProjectStepSchema).max(50).optional().default([]),
});

// 私信消息（Supabase 响应校验）
export const MessageSchema = z.object({
  id: z.number().int(),
  sender_id: z.string().uuid(),
  receiver_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
  created_at: z.string(),
});

// --- Form Schemas ---

export const LoginSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string().min(6, "密码长度至少需要 6 位"),
});

export const SignUpSchema = LoginSchema.extend({
  // Add any sign-up specific fields if needed in the future
  // e.g. confirmPassword
});

export const ResetPasswordSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
});

// --- Types ---

export type Profile = z.infer<typeof ProfileSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type LoginFormValues = z.infer<typeof LoginSchema>;
export type SignUpFormValues = z.infer<typeof SignUpSchema>;
