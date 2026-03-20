import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateUpload, ALLOWED_BUCKETS } from '@/lib/utils/file-validation'
import { logger } from '@/lib/logger'

const IMAGE_ONLY_BUCKETS = ALLOWED_BUCKETS.filter(b => b !== 'project-completion-videos')

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/**
 * Placeholder for future content moderation integration.
 * Currently always returns pass.
 */
async function moderateImage(_publicUrl: string): Promise<{ pass: boolean; reason?: string }> {
  return { pass: true }
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
    const path = `${user.id}/${timestamp}-${random}.${ext}`

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

    const moderation = await moderateImage(publicUrl)
    if (!moderation.pass) {
      await supabaseAdmin.storage.from(bucket).remove([data.path])
      return NextResponse.json(
        { error: moderation.reason || '图片内容审核未通过' },
        { status: 400 }
      )
    }

    return NextResponse.json({ publicUrl })
  } catch (error) {
    return handleApiError(error)
  }
}
