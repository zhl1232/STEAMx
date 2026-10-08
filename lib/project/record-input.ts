import { z } from 'zod'

export const SubmitCompletionSchema = z.object({
  kind: z.enum(['progress', 'final']),
  recordType: z.string().max(32).optional(),
  stageLabel: z.string().max(64).optional(),
  images: z.array(z.string().url()).max(9).default([]),
  imageCaptions: z.array(z.string().max(200)).optional(),
  videoUrl: z.string().url().nullable().optional(),
  notes: z.string().trim().max(5000).optional(),
  isPublic: z.literal(true).default(true),
}).refine(value => value.kind === 'final' ? value.images.length > 0 : value.images.length > 0 || Boolean(value.notes?.trim()), { message: '探索记录至少填写文字或添加图片，作品需要图片' })
