import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateUpload, ALLOWED_BUCKETS } from '@/lib/utils/file-validation'
import { moderateUploadedImage } from '@/lib/ai/upload-content-moderation'
import { logger } from '@/lib/logger'

const IMAGE_ONLY_BUCKETS = ALLOWED_BUCKETS.filter(b => b !== 'project-completion-videos')

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

function normalizePathPrefix(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null

  const normalized = value
    .split('/')
    .map((segment) => segment.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean)
    .join('/')

  return normalized || null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-upload', limit: 30, windowMs: 60_000 })

    if (!supabaseAdmin) {
      return NextResponse.json({ error: '服务端配置异常' }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const bucket = formData.get('bucket')
    const pathPrefix = normalizePathPrefix(formData.get('pathPrefix'))

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 })
    }

    if (typeof bucket !== 'string' || !IMAGE_ONLY_BUCKETS.includes(bucket)) {
      return NextResponse.json({ error: '不允许的存储桶' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const result = validateUpload(buffer, bucket)

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const ext = MIME_TO_EXT[result.mime] || 'jpg'
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 9)
    const filename = `${timestamp}-${random}.${ext}`
    const path = pathPrefix
      ? `${pathPrefix}/${user.id}/${filename}`
      : `${user.id}/${filename}`

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, Buffer.from(buffer), {
        contentType: result.mime,
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      logger.error('Storage upload error', { error, bucket, path })
      return NextResponse.json({ error: '上传失败，请重试' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(data.path)

    try {
      const moderation = await moderateUploadedImage(publicUrl, '上传图片')
      if (!moderation.pass) {
        await supabaseAdmin.storage.from(bucket).remove([data.path])
        logger.warn('Upload image rejected by moderation', {
          userId: user.id,
          bucket,
          pathPrefix,
          path: data.path,
          mime: result.mime,
          sizeBytes: buffer.byteLength,
          reason: moderation.reason || null,
        })
        return NextResponse.json(
          { error: moderation.reason || '图片内容审核未通过', code: 'image_content_rejected' },
          { status: 400 }
        )
      }
    } catch (moderationError) {
      logger.error('Upload image moderation failed', {
        error: moderationError,
        userId: user.id,
        bucket,
        pathPrefix,
        path: data.path,
        mime: result.mime,
        sizeBytes: buffer.byteLength,
      })
      return NextResponse.json(
        {
          publicUrl,
          moderation: { state: 'pending' },
          error: '图片审核暂时不可用，关联内容将进入人工审核',
          code: 'image_moderation_unavailable',
        },
        { status: 202 },
      )
    }

    return NextResponse.json({ publicUrl, moderation: { state: 'approved' } })
  } catch (error) {
    return handleApiError(error)
  }
}
