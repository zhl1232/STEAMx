"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import {
  AvatarWithFrame,
  type AvatarWithFrameProps,
} from "@/components/ui/avatar-with-frame"
import { getDefaultAvatarPath } from "@/lib/profile/avatar-options"
import { cn } from "@/lib/utils"

export interface UserAvatarProps
  extends Omit<AvatarWithFrameProps, "src" | "alt" | "fallback"> {
  /** 头像所属用户；有 userId 时会自动使用稳定的默认头像并默认链接到公开主页。 */
  userId?: string | null
  name?: string | null
  src?: string | null
  alt?: string
  fallback?: ReactNode
  /** 显式传 null 可关闭默认的个人主页链接（例如头像已经位于另一层 Link 内）。 */
  href?: string | null
  linkClassName?: string
}

function getFallback(name?: string | null) {
  return name?.trim().slice(0, 1).toUpperCase() || "?"
}

/**
 * 公共用户头像入口：统一默认头像、头像框、尺寸样式和个人主页链接。
 * 尺寸仍由 AvatarWithFrame 的 className 传入，各业务场景只负责决定大小。
 */
export function UserAvatar({
  userId,
  name,
  src,
  alt,
  fallback,
  href,
  linkClassName,
  ...avatarProps
}: UserAvatarProps) {
  const label = alt || name || "用户"
  const resolvedSrc = src || (userId ? getDefaultAvatarPath(userId) : undefined)
  const profileHref = href === undefined && userId ? `/users/${userId}` : href
  const avatar = (
    <AvatarWithFrame
      {...avatarProps}
      src={resolvedSrc}
      alt={label}
      fallback={fallback ?? getFallback(name)}
    />
  )

  if (!profileHref) return avatar

  return (
    <Link
      href={profileHref}
      aria-label={`查看${label}的个人主页`}
      className={cn(
        "inline-flex shrink-0 rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        linkClassName,
      )}
    >
      {avatar}
    </Link>
  )
}
