"use client";

import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getAvatarFrameClassName } from "@/lib/shop/items";
import { cn } from "@/lib/utils";

export interface AvatarWithFrameProps {
  src?: string | null;
  alt?: string;
  fallback?: React.ReactNode;
  /** 头像框 id（如 neon_halo, pixel_border），来自 profile.equipped_avatar_frame_id */
  avatarFrameId?: string | null;
  className?: string;
  avatarClassName?: string;
}

/**
 * 带框头像：在 Avatar 外包裹一层边框/光环样式
 */
export function AvatarWithFrame({
  src,
  alt,
  fallback,
  avatarFrameId,
  className,
  avatarClassName,
}: AvatarWithFrameProps) {
  const frameClass = getAvatarFrameClassName(avatarFrameId ?? null);

  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden", frameClass, className)}>
      <Avatar className={cn(avatarClassName, "!h-full !w-full shrink-0 rounded-full ring-2 ring-background")}>
        <AvatarImage src={src ?? undefined} alt={alt} />
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
    </div>
  );
}
