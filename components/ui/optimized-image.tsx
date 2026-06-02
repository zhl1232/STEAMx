"use client"

import Image, { ImageProps } from "next/image"
import { rewriteAssetUrl } from "@/lib/utils/asset-url"
import { cn } from "@/lib/utils"

/** 通用模糊占位（约 10x10 灰块），用于远程图片加载时的占位，减少布局跳动 */
const DEFAULT_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMCAxMCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJhIiB4MT0iMCUiIHgyPSIxMDAlIiB5MT0iMCUiIHkyPSIxMDAlIj48c3RvcCBzdG9wLWNvbG9yPSIjZTVlNWU1Ii8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZDRkNGQ0Ii8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg=="

/** 预设 sizes，用于用户上传图片的响应式与缓存优化 */
const SIZE_PRESETS = {
  /** 头像 32~128px 容器 */
  avatar: "128px",
  /** 卡片封面：限制桌面目标宽度，避免请求过大的图 */
  card: "(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 360px",
  /**
   * 首页「热门」左侧重点大卡：实际占位可达半栏 ~720px+，沿用 card 的 360px 会导致拉伸发糊。
   */
  featured:
    "(max-width: 640px) 92vw, (max-width: 1024px) 70vw, (max-width: 1536px) 52vw, 720px",
  /** 上传预览/封面：单块大图 */
  cover: "(max-width: 768px) 100vw, 960px",
  /** 作品墙网格：2/4 列 */
  grid: "(max-width: 768px) 46vw, 220px",
  /** 列表小图/缩略图 */
  thumbnail: "128px",
} as const

const QUALITY_PRESETS: Record<keyof typeof SIZE_PRESETS, number> = {
  avatar: 60,
  card: 60,
  featured: 72,
  cover: 72,
  grid: 60,
  thumbnail: 48,
}

const WIDTH_PRESETS: Record<keyof typeof SIZE_PRESETS, number> = {
  avatar: 128,
  card: 480,
  featured: 960,
  cover: 1280,
  grid: 320,
  thumbnail: 160,
}

const GENERATED_PROJECT_IMAGE_CACHE_VERSION = "20260522-tech-images"

function shouldRewriteStaticAssets() {
  if (process.env.NEXT_PUBLIC_FORCE_REMOTE_ASSETS === "true") return true
  return process.env.NODE_ENV === "production"
}

function isConfiguredStaticAssetUrl(src: string) {
  const baseUrl = process.env.NEXT_PUBLIC_ASSETS_BASE_URL?.trim().replace(/\/+$/, "")
  return Boolean(baseUrl && src.startsWith(`${baseUrl}/`))
}

export type OptimizedImageVariant = keyof typeof SIZE_PRESETS

interface OptimizedImageProps extends Omit<ImageProps, "sizes" | "quality"> {
  variant?: OptimizedImageVariant
  sizes?: string
  quality?: number
  /** 是否使用模糊占位（远程图未传 blurDataURL 时用默认灰块），首屏 priority 图可不开 */
  blurPlaceholder?: boolean
}

function isSupabasePublicStorageUrl(src: string): boolean {
  try {
    const url = new URL(src)
    const isSupabaseHost =
      url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.opentrust.net")

    return isSupabaseHost && url.pathname.includes("/storage/v1/object/public/")
  } catch {
    return false
  }
}

function supportsSupabaseRenderTransform(src: string): boolean {
  try {
    const url = new URL(src)
    return url.hostname.endsWith(".supabase.co")
  } catch {
    return false
  }
}

function toSupabaseTransformedUrl(src: string, width: number, quality: number): string {
  if (!isSupabasePublicStorageUrl(src) || !supportsSupabaseRenderTransform(src)) {
    return src
  }

  const url = new URL(src)
  url.pathname = url.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")
  url.searchParams.set("width", String(width))
  url.searchParams.set("quality", String(quality))

  return url.toString()
}

export function withGeneratedProjectImageCacheVersion(src: string): string {
  const [withoutHash, hash = ""] = src.split("#", 2)
  const [pathname, query = ""] = withoutHash.split("?", 2)

  if (!/^\/projects\/generated\/project-\d+\.webp$/.test(pathname)) {
    return src
  }

  const params = new URLSearchParams(query)
  if (!params.has("v")) {
    params.set("v", GENERATED_PROJECT_IMAGE_CACHE_VERSION)
  }

  const hashPart = hash ? `#${hash}` : ""
  return `${pathname}?${params.toString()}${hashPart}`
}

export function getOptimizedImageSrc(
  src: string,
  variant: OptimizedImageVariant = "cover",
  qualityProp?: number,
): string {
  const quality = qualityProp ?? QUALITY_PRESETS[variant]
  const width = WIDTH_PRESETS[variant]
  const versionedSrc = withGeneratedProjectImageCacheVersion(src)
  const rewrittenSrc = shouldRewriteStaticAssets()
    ? rewriteAssetUrl(versionedSrc) ?? versionedSrc
    : versionedSrc

  if (variant === "cover") {
    return rewrittenSrc
  }

  return isSupabasePublicStorageUrl(rewrittenSrc) && supportsSupabaseRenderTransform(rewrittenSrc)
    ? toSupabaseTransformedUrl(rewrittenSrc, width, quality)
    : rewrittenSrc
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
  const rawSrc = typeof rest.src === "string" ? rest.src : null
  const useDirectSupabaseTransform =
    rawSrc !== null &&
    variant !== "cover" &&
    isSupabasePublicStorageUrl(rawSrc) &&
    supportsSupabaseRenderTransform(rawSrc)
  const src = rawSrc !== null ? getOptimizedImageSrc(rawSrc, variant, quality) : rest.src
  const useDirectStaticAsset = typeof src === "string" && isConfiguredStaticAssetUrl(src)

  return (
    <Image
      {...rest}
      src={src}
      sizes={sizes}
      quality={quality}
      loading={loadingProp}
      priority={priority}
      unoptimized={useDirectSupabaseTransform || useDirectStaticAsset}
      placeholder={useBlur ? "blur" : placeholder}
      blurDataURL={useBlur ? (blurDataURL ?? DEFAULT_BLUR_DATA_URL) : blurDataURL}
      className={cn(className)}
    />
  )
}
