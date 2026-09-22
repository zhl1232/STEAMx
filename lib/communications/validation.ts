import { z } from 'zod'
import { ValidationError } from '@/lib/api/validation'
import { isSafeInternalHref } from '@/lib/utils/safe-internal-href'

const internalHref = z.string().max(512).refine(
  (value) => isSafeInternalHref(value) && !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value),
  '请使用有效的站内链接',
)
const announcementFields = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(500),
  body: z.string().trim().min(1).max(50000),
  level: z.enum(['normal', 'important', 'urgent']),
  action_label: z.string().trim().min(1).max(80).nullable(),
  action_href: internalHref.nullable(),
  expires_at: z.string().datetime({ offset: true }).nullable(),
})
// Defaults belong only to creation: Zod 4 applies inner defaults even inside
// optional fields, which would silently reset omitted fields during PATCH.
export const announcementInput = announcementFields.extend({
  summary: announcementFields.shape.summary.default(''),
  level: announcementFields.shape.level.default('normal'),
  action_label: announcementFields.shape.action_label.default(null),
  action_href: announcementFields.shape.action_href.default(null),
  expires_at: announcementFields.shape.expires_at.default(null),
})
export const announcementPatchInput = announcementFields.partial()
export const welcomeInput = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(2000),
  contact_href: internalHref,
})
export function parseCommunicationInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) throw new ValidationError(result.error.issues[0]?.message || 'Invalid input')
  return result.data
}
export function announcementId(value: string) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new ValidationError('Invalid announcement id')
  return id
}
