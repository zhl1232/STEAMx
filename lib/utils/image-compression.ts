/**
 * 客户端图片压缩：按 bucket 应用预设，自动处理 EXIF 方向，在 Web Worker 中执行。
 *
 * 调用方在 uploadFileSecure / uploadFileSecureWithProgress 内部自动触发压缩，
 * 各业务组件无需直接调用本模块（仅在需要单独压缩的场景下使用）。
 */

import imageCompression from 'browser-image-compression'

import { logger } from '@/lib/logger'

export class ImageCompressionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageCompressionError'
  }
}

interface CompressionPreset {
  /** 文件体积 ≤ 此阈值时跳过压缩，原样返回。单位 KB */
  skipBelowKB: number
  /** 目标输出体积上限。单位 MB */
  targetMB: number
  /** 最长边像素。 */
  maxWidthOrHeight: number
  /** 初始 JPEG 质量（0–1）。库会在不达标时逐步降低。 */
  initialQuality: number
}

export const COMPRESSION_PRESETS: Record<string, CompressionPreset> = {
  avatars: {
    skipBelowKB: 200,
    targetMB: 0.4,
    maxWidthOrHeight: 800,
    initialQuality: 0.85,
  },
  'comment-images': {
    skipBelowKB: 300,
    targetMB: 0.8,
    maxWidthOrHeight: 1600,
    initialQuality: 0.82,
  },
  'project-images': {
    skipBelowKB: 500,
    targetMB: 2.5,
    maxWidthOrHeight: 2560,
    initialQuality: 0.85,
  },
  'project-completions': {
    skipBelowKB: 300,
    targetMB: 0.9,
    maxWidthOrHeight: 1600,
    initialQuality: 0.82,
  },
}

/** 原始输入上限：超过此值直接拒绝，不进入压缩流程。 */
export const RAW_INPUT_CEILING_MB = 50

/**
 * 按 bucket 预设压缩图片。
 * - 体积低于 skipBelowKB：原样返回
 * - 体积超过 RAW_INPUT_CEILING_MB：抛出 ImageCompressionError
 * - 其它：按预设迭代压缩到 targetMB 以下，强制输出 JPEG
 */
export async function compressImageForBucket(
  file: File,
  bucket: string,
  onProgress?: (percent: number) => void,
): Promise<File> {
  if (file.size > RAW_INPUT_CEILING_MB * 1024 * 1024) {
    throw new ImageCompressionError(
      `文件过大（超过 ${RAW_INPUT_CEILING_MB}MB），无法处理`,
    )
  }

  const preset = COMPRESSION_PRESETS[bucket]
  if (!preset) {
    return file
  }

  if (file.size <= preset.skipBelowKB * 1024) {
    return file
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: preset.targetMB,
      maxWidthOrHeight: preset.maxWidthOrHeight,
      initialQuality: preset.initialQuality,
      useWebWorker: true,
      fileType: 'image/jpeg',
      onProgress,
    })

    const originalBase = file.name.replace(/\.[^.]+$/, '')
    return new File([compressed], `${originalBase}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch (error) {
    logger.error('Image compression failed', { error, bucket, size: file.size })
    throw new ImageCompressionError('图片处理失败，请改用 JPG 或 PNG 后重试')
  }
}
