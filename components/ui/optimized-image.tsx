"use client"

import Image, { ImageProps } from "next/image"
import { cn } from "@/lib/utils"

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

export type OptimizedImageVariant = keyof typeof SIZE_PRESETS

interface OptimizedImageProps extends Omit<ImageProps, "sizes" | "quality"> {
  variant?: OptimizedImageVariant
  sizes?: string
  quality?: number
}

/**
 * 用户上传图片的优化封装：统一 sizes、quality、懒加载，配合 next.config 的缓存与格式优化。
 */
export function OptimizedImage({
  variant = "cover",
  sizes: sizesProp,
  quality = 85,
  className,
  loading,
  ...rest
}: OptimizedImageProps) {
  const sizes = sizesProp ?? SIZE_PRESETS[variant]
  return (
    <Image
      sizes={sizes}
      quality={quality}
      loading={loading ?? "lazy"}
      className={cn(className)}
      {...rest}
    />
  )
}
