import type { CreateProjectInput } from '@/lib/schemas'
import {
  isOwnedProjectImageUrl,
  isTrustedLocalAssetUrl,
  validateContentSafe,
  ValidationError,
} from '@/lib/api/validation'

export function validateProjectContent(payload: CreateProjectInput) {
  const textEntries: Array<{ fieldName: string; value: string | null | undefined }> = [
    { fieldName: '项目标题', value: payload.title },
    { fieldName: '项目描述', value: payload.description },
    { fieldName: '项目反思', value: payload.reflection },
    { fieldName: '问题重述', value: payload.problem_statement },
  ]

  for (const material of payload.materials ?? []) {
    textEntries.push({ fieldName: '项目材料', value: material })
  }

  for (const step of payload.steps ?? []) {
    textEntries.push({ fieldName: '步骤标题', value: step.title })
    textEntries.push({ fieldName: '步骤说明', value: step.description })
  }

  for (const iteration of payload.iterations ?? []) {
    textEntries.push({ fieldName: '试错记录', value: iteration.description })
    textEntries.push({ fieldName: '试错结果', value: iteration.result })
  }

  for (const entry of textEntries) {
    if (typeof entry.value === 'string' && entry.value.trim().length > 0) {
      validateContentSafe(entry.value, entry.fieldName)
    }
  }
}

function isOwnedProjectUpload(url: string, userId: string): boolean {
  return (
    isOwnedProjectImageUrl(url, userId) ||
    isOwnedProjectImageUrl(url, userId, 'covers') ||
    isOwnedProjectImageUrl(url, userId, 'steps') ||
    isOwnedProjectImageUrl(url, userId, 'projects')
  )
}

function validateProjectImageUrl(
  imageUrl: string | null | undefined,
  userId: string,
  fieldName: string,
) {
  if (!imageUrl) return
  if (isTrustedLocalAssetUrl(imageUrl)) return
  if (isOwnedProjectUpload(imageUrl, userId)) return

  throw new ValidationError(`${fieldName}必须使用当前账号上传的文件或系统默认图片`)
}

export function validateProjectMediaOwnership(payload: CreateProjectInput, userId: string) {
  validateProjectImageUrl(payload.image_url, userId, '项目封面图片')

  for (const step of payload.steps ?? []) {
    validateProjectImageUrl(step.image_url, userId, '步骤图片')
  }
}
