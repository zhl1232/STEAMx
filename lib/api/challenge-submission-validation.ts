import type { ChallengeSubmissionInput } from '@/lib/schemas'
import {
  isOwnedCompletionVideoUrl,
  isOwnedProjectImageUrl,
  validateContentSafeIfPresent,
  ValidationError,
} from '@/lib/api/validation'

export function validateChallengeSubmissionContent(payload: ChallengeSubmissionInput) {
  validateContentSafeIfPresent(payload.title, '挑战作品标题')
  validateContentSafeIfPresent(payload.notes, '挑战作品说明')

  for (const caption of payload.proof_captions ?? []) {
    validateContentSafeIfPresent(caption, '挑战图片说明')
  }
}

function isOwnedChallengeProofImageUrl(imageUrl: string, userId: string): boolean {
  return (
    isOwnedProjectImageUrl(imageUrl, userId, { bucket: 'project-completions' }) ||
    isOwnedProjectImageUrl(imageUrl, userId, {
      bucket: 'project-completions',
      pathPrefix: 'challenge-submissions',
    })
  )
}

export function validateChallengeSubmissionMediaOwnership(
  payload: ChallengeSubmissionInput,
  userId: string,
) {
  if (payload.proof_images.some((url) => !isOwnedChallengeProofImageUrl(url, userId))) {
    throw new ValidationError('挑战作品图片必须使用当前账号上传的文件')
  }

  if (payload.proof_video_url && !isOwnedCompletionVideoUrl(payload.proof_video_url, userId)) {
    throw new ValidationError('挑战作品视频必须使用当前账号上传的文件')
  }
}
