"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import type { Badge } from "@/lib/gamification/types";
import { cn } from "@/lib/utils";
import { BadgeIcon } from "./badge-icon";
import { BadgeTierPill } from "@/components/features/gamification/badge-tier-pill";

type BadgeUnlockPayload = Pick<Badge, "id" | "name" | "description" | "icon" | "tier" | "seriesKey">;

type OverlayState = {
  badges: BadgeUnlockPayload[];
};

const SINGLE_AUTO_DISMISS_MS = 3600;

const listeners = new Set<(state: OverlayState) => void>();
let overlayState: OverlayState = { badges: [] };

function emit() {
  listeners.forEach((listener) => listener(overlayState));
}

function setOverlayState(next: OverlayState) {
  overlayState = next;
  emit();
}

export function dismissBadgeUnlockOverlay() {
  if (overlayState.badges.length === 0) return;
  setOverlayState({ badges: [] });
}

/** Test helper: reset module-level overlay queue between cases. */
export function resetBadgeUnlockOverlayForTests() {
  overlayState = { badges: [] };
  emit();
}

export function showBadgeUnlockOverlay(badge: BadgeUnlockPayload) {
  if (overlayState.badges.some((item) => item.id === badge.id)) return;
  setOverlayState({ badges: [...overlayState.badges, badge] });
}

function fireConfetti() {
  confetti({
    particleCount: 120,
    spread: 82,
    startVelocity: 32,
    origin: { y: 0.55 },
  });
}

function SingleBadgeCelebration({
  badge,
  onDismiss,
}: {
  badge: BadgeUnlockPayload;
  onDismiss: () => void;
}) {
  useEffect(() => {
    fireConfetti();
    const timeout = window.setTimeout(onDismiss, SINGLE_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timeout);
  }, [badge.id, onDismiss]);

  return (
    <motion.div
      key={badge.id}
      role="dialog"
      aria-modal="true"
      aria-label={`解锁徽章：${badge.name}`}
      className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/18 px-5 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={onDismiss}
    >
      <motion.div
        className="relative flex min-h-[300px] w-full max-w-[360px] flex-col items-center justify-center overflow-hidden rounded-xl border border-white/45 bg-white/72 px-7 py-8 text-center shadow-[0_28px_90px_-36px_rgba(15,23,42,0.75)] backdrop-blur-2xl dark:border-white/12 dark:bg-slate-950/72"
        initial={{ scale: 0.78, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        onClick={onDismiss}
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
              badge.tier === "platinum"
                ? "bg-cyan-300"
                : badge.tier === "silver"
                  ? "bg-slate-300"
                  : badge.tier === "bronze"
                    ? "bg-amber-500"
                    : "bg-yellow-300",
            )}
          />
          <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">点按任意处继续</p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function BadgeUnlockSummary({
  badges,
  onDismiss,
}: {
  badges: BadgeUnlockPayload[];
  onDismiss: () => void;
}) {
  useEffect(() => {
    fireConfetti();
  }, []);

  return (
    <motion.div
      key="badge-unlock-summary"
      role="dialog"
      aria-modal="true"
      aria-label={`解锁了 ${badges.length} 枚徽章`}
      className="fixed inset-0 z-100 flex items-end justify-center bg-slate-950/28 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10 backdrop-blur-[2px] sm:items-center sm:pb-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={onDismiss}
    >
      <motion.div
        className="relative flex max-h-[min(82vh,640px)] w-full max-w-[400px] flex-col overflow-hidden rounded-2xl border border-white/45 bg-white/88 shadow-[0_28px_90px_-36px_rgba(15,23,42,0.75)] backdrop-blur-2xl dark:border-white/12 dark:bg-slate-950/84"
        initial={{ scale: 0.92, y: 28, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(250,204,21,0.22),transparent_42%),radial-gradient(circle_at_12%_18%,rgba(56,189,248,0.14),transparent_28%)]" />
        <div className="relative z-10 border-b border-slate-200/70 px-5 pb-4 pt-5 text-center dark:border-white/10">
          <div className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-600 dark:text-amber-300">
            Badges Unlocked
          </div>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">
            解锁了 {badges.length} 枚徽章
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">一次看全，点进图鉴还能慢慢翻。</p>
        </div>

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <ul className="grid grid-cols-2 gap-3">
            {badges.map((badge, index) => (
              <motion.li
                key={badge.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.28), duration: 0.22 }}
                className="flex flex-col items-center rounded-xl border border-slate-200/80 bg-white/70 px-3 py-3 text-center dark:border-white/10 dark:bg-slate-900/55"
              >
                <BadgeIcon
                  icon={badge.icon}
                  tier={badge.tier}
                  seriesKey={badge.seriesKey}
                  size="md"
                  showGlow
                  className="h-14 w-14"
                />
                {badge.tier ? (
                  <BadgeTierPill tier={badge.tier} className="mt-2 px-2 py-0.5 text-[10px]" />
                ) : null}
                <p className="mt-1.5 line-clamp-2 text-xs font-bold leading-4 text-slate-900 dark:text-white">
                  {badge.name}
                </p>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex flex-col gap-2 border-t border-slate-200/70 px-4 py-4 dark:border-white/10">
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[hsl(var(--brand-blue))] text-sm font-semibold text-[hsl(var(--brand-blue-foreground))] shadow-[0_14px_26px_-14px_hsl(var(--brand-blue)/0.95)] transition-transform active:scale-[0.98]"
          >
            太棒了
          </button>
          <Link
            href="/profile"
            onClick={onDismiss}
            className="inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-white/5"
          >
            查看图鉴
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function BadgeUnlockOverlay() {
  const [state, setState] = useState<OverlayState>(overlayState);
  const badges = state.badges;
  const mode = badges.length === 0 ? "hidden" : badges.length === 1 ? "single" : "summary";

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return (
    <>
      {mode === "single" ? (
        <SingleBadgeCelebration key={`single-${badges[0].id}`} badge={badges[0]} onDismiss={dismissBadgeUnlockOverlay} />
      ) : null}
      {mode === "summary" ? (
        <BadgeUnlockSummary key="summary" badges={badges} onDismiss={dismissBadgeUnlockOverlay} />
      ) : null}
    </>
  );
}
