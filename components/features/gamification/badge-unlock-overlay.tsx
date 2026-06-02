"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import type { Badge } from "@/lib/gamification/types";
import { cn } from "@/lib/utils";
import { BadgeIcon } from "./badge-icon";
import { BadgeTierPill } from "@/components/features/gamification/badge-tier-pill";

type BadgeUnlockPayload = Pick<Badge, "id" | "name" | "description" | "icon" | "tier" | "seriesKey">;

type OverlayState = {
  current: BadgeUnlockPayload | null;
  queue: BadgeUnlockPayload[];
};

const listeners = new Set<(state: OverlayState) => void>();
let overlayState: OverlayState = { current: null, queue: [] };

function emit() {
  listeners.forEach((listener) => listener(overlayState));
}

function setOverlayState(next: OverlayState) {
  overlayState = next;
  emit();
}

function finishCurrentBadgeUnlock() {
  const [next, ...rest] = overlayState.queue;
  setOverlayState({ current: next ?? null, queue: rest });
}

export function showBadgeUnlockOverlay(badge: BadgeUnlockPayload) {
  if (overlayState.current) {
    setOverlayState({ ...overlayState, queue: [...overlayState.queue, badge] });
    return;
  }

  setOverlayState({ current: badge, queue: overlayState.queue });
}

export function BadgeUnlockOverlay() {
  const [state, setState] = useState<OverlayState>(overlayState);
  const badge = state.current;

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  useEffect(() => {
    if (!badge) return;

    confetti({
      particleCount: 120,
      spread: 82,
      startVelocity: 32,
      origin: { y: 0.55 },
    });

    const timeout = window.setTimeout(finishCurrentBadgeUnlock, 3600);
    return () => window.clearTimeout(timeout);
  }, [badge]);

  return (
    <AnimatePresence>
      {badge ? (
        <motion.div
          key={badge.id}
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/18 px-5 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          aria-live="polite"
        >
          <motion.div
            className="relative flex min-h-[300px] w-full max-w-[360px] flex-col items-center justify-center overflow-hidden rounded-xl border border-white/45 bg-white/72 px-7 py-8 text-center shadow-[0_28px_90px_-36px_rgba(15,23,42,0.75)] backdrop-blur-2xl dark:border-white/12 dark:bg-slate-950/72"
            initial={{ scale: 0.78, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: -14, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(250,204,21,0.26),transparent_34%),radial-gradient(circle_at_18%_20%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_82%_72%,rgba(244,114,182,0.16),transparent_30%)]" />
            <motion.div
              className="absolute h-44 w-44 rounded-full border border-amber-200/70 bg-amber-100/20 dark:border-amber-200/20 dark:bg-amber-300/10"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: [0.84, 1.08, 0.96], opacity: [0, 0.7, 0.38], rotate: 360 }}
              transition={{ duration: 2.8, ease: "easeOut" }}
            />
            <motion.div
              className="relative z-10"
              initial={{ rotate: -18, scale: 0.4 }}
              animate={{ rotate: [0, -8, 6, 0], scale: [0.4, 1.18, 0.96, 1] }}
              transition={{ duration: 0.95, ease: "easeOut" }}
            >
              <BadgeIcon
                icon={badge.icon}
                tier={badge.tier}
                seriesKey={badge.seriesKey}
                size="xl"
                showGlow
                className="h-28 w-28"
              />
            </motion.div>
            <motion.div
              className="relative z-10 mt-5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.28 }}
            >
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-600 dark:text-amber-300">
                Badge Unlocked
              </div>
              <div className="mt-2 flex flex-col items-center gap-2">
                {badge.tier ? <BadgeTierPill tier={badge.tier} className="px-2.5 py-0.5 text-[11px]" /> : null}
                <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                  {badge.name}
                </h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {badge.description}
              </p>
              <div
                className={cn(
                  "mx-auto mt-4 h-1.5 w-16 rounded-full",
                  badge.tier === "platinum" ? "bg-cyan-300" : badge.tier === "silver" ? "bg-slate-300" : badge.tier === "bronze" ? "bg-amber-500" : "bg-yellow-300"
                )}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
