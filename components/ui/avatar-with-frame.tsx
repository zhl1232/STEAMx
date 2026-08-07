"use client";

import * as React from "react";
import { Atom, Cog } from "lucide-react";
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

function ScienceOrbitLayer({ layer }: { layer: "back" | "front" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "avatar-frame-science-orbit__orbit",
        `avatar-frame-science-orbit__orbit--${layer}`,
      )}
    />
  );
}

function ScienceOrbitIconLayer({ layer }: { layer: "back" | "front" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "avatar-frame-science-orbit__icon-layer",
        `avatar-frame-science-orbit__icon-layer--${layer}`,
      )}
    >
      <span className="avatar-frame-science-orbit__motion avatar-frame-science-orbit__motion--atom">
        <span className="avatar-frame-science-orbit__icon-position avatar-frame-science-orbit__icon-position--atom">
          <span className="avatar-frame-science-orbit__icon-facing avatar-frame-science-orbit__icon-facing--atom">
            <Atom className="avatar-frame-science-orbit__atom" />
          </span>
        </span>
      </span>
      <span className="avatar-frame-science-orbit__motion avatar-frame-science-orbit__motion--gear">
        <span className="avatar-frame-science-orbit__icon-position avatar-frame-science-orbit__icon-position--gear">
          <span className="avatar-frame-science-orbit__icon-facing avatar-frame-science-orbit__icon-facing--gear">
            <Cog className="avatar-frame-science-orbit__gear" />
          </span>
        </span>
      </span>
    </span>
  );
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
  const isScienceOrbit = frameClass === "avatar-frame-science-orbit";

  return (
    <div className={cn(
      "relative inline-flex shrink-0 items-center justify-center rounded-full",
      frameClass,
      className,
    )}>
      {isScienceOrbit ? (
        <>
          <span className="avatar-frame-science-orbit__flat-orbit" aria-hidden="true">
            <span className="avatar-frame-science-orbit__flat-motion avatar-frame-science-orbit__flat-motion--blue">
              <span className="avatar-frame-science-orbit__flat-node avatar-frame-science-orbit__flat-node--blue" />
            </span>
            <span className="avatar-frame-science-orbit__flat-motion avatar-frame-science-orbit__flat-motion--violet">
              <span className="avatar-frame-science-orbit__flat-node avatar-frame-science-orbit__flat-node--violet" />
            </span>
          </span>
          <ScienceOrbitLayer layer="back" />
          <ScienceOrbitIconLayer layer="back" />
        </>
      ) : null}
      <Avatar className={cn(avatarClassName, "relative z-[1] h-full! w-full! shrink-0 rounded-full ring-2 ring-background")}>
        <AvatarImage src={src ?? undefined} alt={alt} />
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      {isScienceOrbit ? (
        <>
          <ScienceOrbitLayer layer="front" />
          <ScienceOrbitIconLayer layer="front" />
        </>
      ) : null}
    </div>
  );
}
