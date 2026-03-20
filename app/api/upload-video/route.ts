import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateVideoUpload } from '@/lib/utils/file-validation'
import { logger } from '@/lib/logger'
import { writeFile, unlink, readFile, mkdir } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execFileAsync = promisify(execFile)

const BUCKET = 'project-completion-videos'
const TMP_DIR = '/tmp/video-processing'
const MAX_DURATION_SECONDS = 15

export const maxDuration = 60

const VIDEO_MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

async function compressVideo(inputPath: string, outputPath: string): Promise<void> {
  const args = [
    '-i', inputPath,
    '-vf', 'scale=-2:720',
    '-c:v', 'libx264',
    '-crf', '28',
    '-preset', 'fast',
    '-c:a', 'aac',
    '-b:a', '64k',
    '-movflags', '+faststart',
    '-t', String(MAX_DURATION_SECONDS),
    '-y',
    outputPath,
  ]

  await execFileAsync('ffmpeg', args, { timeout: 50_000 })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  let inputPath = ''
  let outputPath = ''

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-upload-video', limit: 10, windowMs: 60_000 })

    if (!supabaseAdmin) {
      return NextResponse.json({ error: '服务端配置异常' }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '请选择要上传的视频' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const result = validateVideoUpload(arrayBuffer)

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const nodeBuffer = Buffer.from(arrayBuffer)

    const timestamp = Date.now()
    const random = crypto.randomUUID().slice(0, 8)
    const inputExt = VIDEO_MIME_TO_EXT[result.mime] || 'mp4'

    inputPath = path.join(TMP_DIR, `${user.id}-${timestamp}-${random}-input.${inputExt}`)
    outputPath = path.join(TMP_DIR, `${user.id}-${timestamp}-${random}-output.mp4`)

    await mkdir(TMP_DIR, { recursive: true })
    await writeFile(inputPath, nodeBuffer)

    try {
      await compressVideo(inputPath, outputPath)
    } catch (err) {
      logger.error('FFmpeg compression failed', { error: err })
      return NextResponse.json({ error: '视频压缩失败，请尝试更换格式或缩短视频' }, { status: 500 })
    }

    const compressedBuffer = await readFile(outputPath)
    const storagePath = `${user.id}/${timestamp}-${random}.mp4`

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, compressedBuffer, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      logger.error('Video storage upload error', { error, storagePath })
      return NextResponse.json({ error: '视频上传存储失败，请重试' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(data.path)

    return NextResponse.json({ publicUrl })
  } catch (error) {
    return handleApiError(error)
  } finally {
    const cleanup = async (p: string) => {
      if (p) {
        try { await unlink(p) } catch { /* file may not exist */ }
      }
    }
    await Promise.all([cleanup(inputPath), cleanup(outputPath)])
  }
}
