import { z } from "zod";

import { TUTOR_PLAYGROUND_GAME_KEYS } from "@/lib/ai/tutor/types";

const relativeOrAbsoluteUrlSchema = z.union([
  z.string().url("Invalid image URL"),
  z.string().min(1).startsWith("/"),
]);

// Accept UUID-shaped database identifiers, including legacy seeded IDs whose
// version bits are intentionally zeroed for stable fixtures.
const uuidLikeSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const IterationSchema = z.object({
  description: z.string().min(1).max(2000),
  result: z.string().min(1).max(2000),
  created_at: z.string().min(1),
});

// --- Database Schemas ---

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().nullable().optional(),
  avatar_url: z
    .union([z.string().url(), z.string().min(1).startsWith("/")])
    .nullable()
    .optional(),
  bio: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  xp: z.number().int().default(0),
  // Supabase/Postgres 返回 "YYYY-MM-DD HH:mm:ss..." 或带时区，非严格 ISO 8601，用 string 接受
  created_at: z.string().min(1),
});

// Basic schemas for parts
export const ProjectStepSchema = z.object({
  title: z.string().min(1, "Step title is required").max(200),
  description: z.string().max(1000).optional(),
  image_url: relativeOrAbsoluteUrlSchema.nullable().optional(),
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
  category: z.enum(['科学', '技术', '工程', '艺术', '数学', '其他'], {
    message: "Invalid category", 
  }),
  sub_category_id: z.number().nullable().optional(),
  sub_category: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : undefined
    },
    z.string().max(100).optional()
  ),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  difficulty_stars: z.number().int().min(1).max(6).default(1),
  status: z.enum(['draft', 'pending', 'approved', 'rejected']).default('draft'),
  image_url: relativeOrAbsoluteUrlSchema.nullable().optional(),
  challenge_id: z.number().int().positive().nullable().optional(),
  reflection: z.string().max(5000).nullable().optional(),
  problem_statement: z.string().max(5000).nullable().optional(),
  iterations: z.array(IterationSchema).max(50).optional().default([]),
  materials: z.array(z.string().min(1).max(200)).max(50).optional().default([]), // For simple array of strings (POST API format)
  // Or handle project_materials array of objects if needed, but POST API uses string array for simplicity?
  // Let's check API usage. API expects `materials: string[]`. Admin page uses objects.
  // We need a schema that supports both or distinct schemas.
  // Let's stick to API schema for now, but Admin page might need transformation.
  steps: z.array(ProjectStepSchema).max(50).optional().default([]),
});

export const ChallengeSubmissionSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  notes: z.string().max(5000).nullable().optional(),
  proof_images: z.array(relativeOrAbsoluteUrlSchema).min(1, "At least one image is required").max(9),
  proof_captions: z.array(z.string().max(200)).max(9).optional(),
  proof_video_url: relativeOrAbsoluteUrlSchema.nullable().optional(),
  is_public: z.boolean().default(true),
  reference_project_ids: z.array(z.number().int().positive()).max(10).default([]),
});

export const ChallengeStageProgressSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed']).default('in_progress'),
  notes: z.string().max(5000).nullable().optional(),
  images: z.array(relativeOrAbsoluteUrlSchema).max(9).default([]),
  data: z.record(z.string(), z.unknown()).nullable().optional(),
  video_url: relativeOrAbsoluteUrlSchema.nullable().optional(),
});

export const ChallengeWorkspaceUpdateSchema = z.object({
  project_goal: z.string().max(160).nullable(),
});

export const ChallengeStageCoachSchema = z.object({
  mode: z.enum(['qa', 'review']),
  question: z.string().max(1000).optional(),
  notes: z.string().max(5000).optional(),
  images: z.array(relativeOrAbsoluteUrlSchema).max(9).default([]),
  data: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const ChallengeStageCoachActionSchema = ChallengeStageProgressSchema.extend({
  action: z.enum(['breakdown', 'hint', 'summary']),
});

export const ChallengeTutorSendSchema = z.object({
  stageIndex: z.number().int().min(0).max(50),
  content: z.string().max(4000).default(''),
  images: z.array(relativeOrAbsoluteUrlSchema).max(6).default([]),
}).refine((value) => value.content.trim().length > 0 || value.images.length > 0, {
  message: '消息不能为空',
});

export const TutorContextTypeSchema = z.enum(['global', 'challenge', 'project', 'observation', 'course', 'species']);

export const TutorGlobalSurfaceSchema = z.enum([
  'home', 'explore', 'nature', 'create', 'courses', 'community', 'playground', 'profile', 'users',
]);
export const TutorPlaygroundGameKeySchema = z.enum(TUTOR_PLAYGROUND_GAME_KEYS);
export const TutorSceneCapabilitySchema = z.enum([
  'focusChallengeStage',
  'focusCourseLessonStep',
  'hintMinesweeperCell',
  'speciesAudio',
]);

const ScratchEditorTargetContextSchema = z.object({
  id: z.string().max(120),
  name: z.string().max(80),
  isStage: z.boolean().optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  direction: z.number().finite().optional(),
  size: z.number().finite().optional(),
  visible: z.boolean().optional(),
  costumeName: z.string().max(120).optional(),
  blockCount: z.number().int().min(0).max(5000).optional(),
  blocks: z.array(z.object({
    id: z.string().max(120),
    type: z.string().max(120),
    label: z.string().max(120).optional(),
  })).max(120).optional(),
});

const ScratchEditorContextSchema = z.object({
  selectedTargetId: z.string().max(120).optional(),
  selectedTargetName: z.string().max(80).optional(),
  targets: z.array(ScratchEditorTargetContextSchema).max(20).default([]),
});

export const TutorSendSchema = z.object({
  contextType: TutorContextTypeSchema.default('global'),
  contextId: z.string().max(64).optional(),
  content: z.string().max(4000).default(''),
  images: z.array(relativeOrAbsoluteUrlSchema).max(6).default([]),
  stageIndex: z.number().int().min(0).max(50).optional(),
  lessonId: z.number().int().positive().optional(),
  lessonStepIndex: z.number().int().min(0).max(50).optional(),
  lessonStepCount: z.number().int().min(0).max(50).optional(),
  scratchBlockTargetItemIndex: z.number().int().min(0).max(20).optional(),
  scratchEditorContext: ScratchEditorContextSchema.optional(),
  sceneCapabilities: z.array(TutorSceneCapabilitySchema).max(8).optional(),
  surface: TutorGlobalSurfaceSchema.optional(),
  gameKey: TutorPlaygroundGameKeySchema.optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
}).refine((value) => value.content.trim().length > 0 || value.images.length > 0, {
  message: '消息不能为空',
});

export const TutorSpeechSynthesizeSchema = z.object({
  text: z.string().min(1, '朗读内容不能为空').max(4000, '朗读内容太长'),
});

export const TutorSpeechTranscribeMetaSchema = z.object({
  durationMs: z.coerce.number().int().min(1, '录音时长无效').max(30_000, '录音不能超过 30 秒'),
});

export const ChallengeSubmissionRatingSchema = z.object({
  submissionId: z.number().int().positive(),
  creativeExpression: z.number().int().min(1).max(5),
  completionQuality: z.number().int().min(1).max(5),
  evidenceCompleteness: z.number().int().min(1).max(5),
  reflectionDepth: z.number().int().min(1).max(5),
});

// 私信消息（Supabase 响应校验）
export const MessageSchema = z.object({
  id: z.number().int(),
  sender_id: uuidLikeSchema,
  receiver_id: uuidLikeSchema,
  content: z.string().min(1).max(2000),
  read_at: z.string().nullable().optional(),
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
export type ChallengeSubmissionInput = z.infer<typeof ChallengeSubmissionSchema>;
export type ChallengeStageProgressInput = z.infer<typeof ChallengeStageProgressSchema>;
export type ChallengeWorkspaceUpdateInput = z.infer<typeof ChallengeWorkspaceUpdateSchema>;
export type ChallengeStageCoachInput = z.infer<typeof ChallengeStageCoachSchema>;
export type ChallengeStageCoachActionInput = z.infer<typeof ChallengeStageCoachActionSchema>;
export type ChallengeTutorSendInput = z.infer<typeof ChallengeTutorSendSchema>;
export type TutorSendInput = z.infer<typeof TutorSendSchema>;
export type TutorSpeechSynthesizeInput = z.infer<typeof TutorSpeechSynthesizeSchema>;
export type TutorSpeechTranscribeMetaInput = z.infer<typeof TutorSpeechTranscribeMetaSchema>;
export type ChallengeSubmissionRatingInput = z.infer<typeof ChallengeSubmissionRatingSchema>;
export type LoginFormValues = z.infer<typeof LoginSchema>;
export type SignUpFormValues = z.infer<typeof SignUpSchema>;
