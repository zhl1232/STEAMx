"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

import {
  getBadgeUnlockState,
  subscribeBadgeUnlockState,
} from "@/lib/gamification/badge-unlock-store";

const LazyBadgeUnlockOverlay = dynamic(
  () =>
    import("@/components/features/gamification/badge-unlock-overlay").then(
      (module) => module.BadgeUnlockOverlay,
    ),
  { ssr: false },
);

export function BadgeUnlockOverlayMount() {
  const state = useSyncExternalStore(
    subscribeBadgeUnlockState,
    getBadgeUnlockState,
    getBadgeUnlockState,
  );

  if (state.badges.length === 0) return null;
  return <LazyBadgeUnlockOverlay />;
}
