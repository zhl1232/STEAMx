import { z } from "zod";

// --- Database Schemas ---

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  bio: z.string().nullable().optional(),
  xp: z.number().int().default(0),
  created_at: z.string().datetime(),
});

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  author_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable().optional(),
  // Add other fields as necessary based on your actual table structure
  // e.g., is_public, view_count, etc.
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
export type LoginFormValues = z.infer<typeof LoginSchema>;
export type SignUpFormValues = z.infer<typeof SignUpSchema>;
