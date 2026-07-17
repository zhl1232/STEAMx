import type { Badge } from "@/lib/gamification/types";

export type BadgeUnlockPayload = Pick<
  Badge,
  "id" | "name" | "description" | "icon" | "tier" | "seriesKey"
>;

export type BadgeUnlockState = {
  badges: BadgeUnlockPayload[];
};

const listeners = new Set<() => void>();
let state: BadgeUnlockState = { badges: [] };

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(next: BadgeUnlockState) {
  state = next;
  emit();
}

export function getBadgeUnlockState() {
  return state;
}

export function subscribeBadgeUnlockState(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dismissBadgeUnlockOverlay() {
  if (state.badges.length === 0) return;
  setState({ badges: [] });
}

export function resetBadgeUnlockOverlayForTests() {
  setState({ badges: [] });
}

export function showBadgeUnlockOverlay(badge: BadgeUnlockPayload) {
  if (state.badges.some((item) => item.id === badge.id)) return;
  setState({ badges: [...state.badges, badge] });
}
