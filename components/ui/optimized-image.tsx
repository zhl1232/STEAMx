"use client"

import Image, { ImageProps } from "next/image"
import { cn } from "@/lib/utils"

/** 通用模糊占位（约 10x10 灰块），用于远程图片加载时的占位，减少布局跳动 */
const DEFAULT_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMCAxMCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJhIiB4MT0iMCUiIHgyPSIxMDAlIiB5MT0iMCUiIHkyPSIxMDAlIj48c3RvcCBzdG9wLWNvbG9yPSIjZTVlNWU1Ii8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZDRkNGQ0Ii8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg=="

/** 预设 sizes，用于用户上传图片的响应式与缓存优化 */
const SIZE_PRESETS = {
  /** 头像 32~128px 容器 */
  avatar: "128px",
  /** 卡片封面：移动端全宽、平板半宽、桌面 1/3 */
  card: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  /** 上传预览/封面：单块大图 */
  cover: "(max-width: 768px) 100vw, 720px",
  /** 作品墙网格：2/4 列 */
  grid: "(max-width: 768px) 50vw, 25vw",
  /** 列表小图/缩略图 */
  thumbnail: "96px",
} as const

/** 按场景的默认质量：列表/卡片用较低质量以加快加载，封面/头像稍高 */
const QUALITY_PRESETS: Record<keyof typeof SIZE_PRESETS, number> = {
  avatar: 80,
  card: 72,
  cover: 80,
  grid: 72,
  thumbnail: 72,
}

export type OptimizedImageVariant = keyof typeof SIZE_PRESETS

interface OptimizedImageProps extends Omit<ImageProps, "sizes" | "quality"> {
  variant?: OptimizedImageVariant
  sizes?: string
  quality?: number
  /** 是否使用模糊占位（远程图未传 blurDataURL 时用默认灰块），首屏 priority 图可不开 */
  blurPlaceholder?: boolean
}

/**
 * 用户上传图片的优化封装：统一 sizes、quality、懒加载，配合 next.config 的缓存与格式优化。
 */
export function OptimizedImage({
  variant = "cover",
  sizes: sizesProp,
  quality: qualityProp,
  className,
  loading,
  priority,
  blurPlaceholder = false,
  blurDataURL,
  placeholder,
  ...rest
}: OptimizedImageProps) {
  const sizes = sizesProp ?? SIZE_PRESETS[variant]
  const quality = qualityProp ?? QUALITY_PRESETS[variant]
  // priority 与 loading="lazy" 互斥，只能二选一
  const loadingProp = priority ? undefined : (loading ?? "lazy")
  const useBlur = blurPlaceholder && !priority && (blurDataURL ?? DEFAULT_BLUR_DATA_URL)
  return (
    <Image
      sizes={sizes}
      quality={quality}
      loading={loadingProp}
      priority={priority}
      placeholder={useBlur ? "blur" : placeholder}
      blurDataURL={useBlur ? (blurDataURL ?? DEFAULT_BLUR_DATA_URL) : blurDataURL}
      className={cn(className)}
      {...rest}
    />
  )
}
