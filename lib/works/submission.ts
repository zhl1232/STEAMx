import { z } from 'zod'

import {
  isOwnedCompletionVideoUrl,
  isOwnedProjectImageUrl,
  ValidationError,
  validateContentSafeIfPresent,
} from '@/lib/api/validation'
import type { WorkSubmissionPayload } from '@/lib/works/types'

export const WorkSubmissionSchema = z.object({
  images: z.array(z.string().url()).min(1).max(9),
  imageCaptions: z.array(z.string().max(200)).optional(),
  videoUrl: z.string().url().nullable().optional(),
  notes: z.string().max(5000).optional(),
  isPublic: z.boolean().optional(),
})

export function validateWorkSubmission(
  payload: WorkSubmissionPayload,
  userId: string,
) {
  validateContentSafeIfPresent(payload.notes, '作品说明')
  for (const caption of payload.imageCaptions ?? []) {
    validateContentSafeIfPresent(caption, '图片说明')
  }

  if (
    payload.images.some(
      (url) => !isOwnedProjectImageUrl(url, userId, { bucket: 'project-completions' }),
    )
  ) {
    throw new ValidationError('作品图片必须使用当前账号上传的文件')
  }

  if (payload.videoUrl && !isOwnedCompletionVideoUrl(payload.videoUrl, userId)) {
    throw new ValidationError('作品视频必须使用当前账号上传的文件')
  }
}
