import { BADGES, getBadgeDisplayDefinitions } from "./badges";
import { BadgeDisplay, BadgeTier } from "./types";

const TIER_WEIGHT: Record<BadgeTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5,
};

/** 主页佩戴列表和默认精选都最多保存 5 枚徽章。 */
export const FEATURED_BADGE_LIMIT = 5;
/** 公开主页和个人主页首屏统一露出 5 枚徽章。 */
export const PROFILE_BADGE_VISIBLE_LIMIT = 5;

/** 根据等级派生的基础称号（当用户未佩戴且无成就徽章时作为保底） */
export function getLevelDefaultTitle(level = 1): string {
  if (level >= 11) return "宗师创作者";
  if (level >= 8) return "STEAM 达人";
  if (level >= 5) return "造物能手";
  if (level >= 3) return "探索先锋";
  return "探索新手";
}

/**
 * 推导用户主页展示的称号
 * - 若用户主动设置 "none"，返回 null（隐藏称号）
 * - 若用户主动设置了称号，直接返回
 * - 若未设置 (null/undefined)，自动从已解锁徽章中选出最高品质的成就名，无徽章时按等级保底
 */
export function deriveUserTitle({
  equippedTitle,
  unlockedBadgeIds,
  level = 1,
  allBadges = BADGES,
}: {
  equippedTitle?: string | null;
  unlockedBadgeIds: string[] | Set<string>;
  level?: number;
  allBadges?: typeof BADGES;
}): string | null {
  if (equippedTitle === "none") {
    return null;
  }

  if (equippedTitle && equippedTitle.trim() !== "") {
    return equippedTitle.trim();
  }

  const unlockedSet = unlockedBadgeIds instanceof Set ? unlockedBadgeIds : new Set(unlockedBadgeIds);
  if (unlockedSet.size === 0) {
    return getLevelDefaultTitle(level);
  }

  // 筛选已解锁徽章，按阶位从高到低排序
  const unlockedBadges = allBadges.filter((b) => unlockedSet.has(b.id));
  if (unlockedBadges.length === 0) {
    return getLevelDefaultTitle(level);
  }

  unlockedBadges.sort((a, b) => {
    const weightA = a.tier ? TIER_WEIGHT[a.tier] ?? 0 : 0;
    const weightB = b.tier ? TIER_WEIGHT[b.tier] ?? 0 : 0;
    return weightB - weightA;
  });

  return unlockedBadges[0].name || getLevelDefaultTitle(level);
}

/**
 * 获取当前用户所有可供选择佩戴的称号列表（已解锁徽章名称去重 + 等级保底）
 */
export function getAvailableTitles({
  unlockedBadgeIds,
  level = 1,
  allBadges = BADGES,
}: {
  unlockedBadgeIds: string[] | Set<string>;
  level?: number;
  allBadges?: typeof BADGES;
}): string[] {
  const unlockedSet = unlockedBadgeIds instanceof Set ? unlockedBadgeIds : new Set(unlockedBadgeIds);
  const titles = new Set<string>();

  // 等级称号
  titles.add(getLevelDefaultTitle(level));

  // 已解锁徽章称号
  for (const badge of allBadges) {
    if (unlockedSet.has(badge.id) && badge.name) {
      titles.add(badge.name);
    }
  }

  return Array.from(titles);
}

export type FeaturedBadgeSource = "manual" | "default";

export interface FeaturedBadgeSelection {
  badges: BadgeDisplay[];
  source: FeaturedBadgeSource;
}

/**
 * 解析主页佩戴列表：手动设置优先，否则自动精选最高品质徽章。
 * 手动列表和默认精选都最多 FEATURED_BADGE_LIMIT 枚。
 */
export function resolveFeaturedBadges({
  featuredBadgeIds,
  unlockedBadgeIds,
  allBadges,
}: {
  featuredBadgeIds?: string[] | null;
  unlockedBadgeIds: string[] | Set<string>;
  allBadges?: BadgeDisplay[];
}): FeaturedBadgeSelection {
  const displayBadges = allBadges || getBadgeDisplayDefinitions(BADGES);
  const badgeMap = new Map<string, BadgeDisplay>(displayBadges.map((b) => [b.id, b]));
  const unlockedSet = unlockedBadgeIds instanceof Set ? unlockedBadgeIds : new Set(unlockedBadgeIds);

  // NULL/undefined 表示用户尚未手动配置；空数组表示用户明确清空主页佩戴。
  if (featuredBadgeIds !== undefined && featuredBadgeIds !== null && featuredBadgeIds.length === 0) {
    return { badges: [], source: "manual" };
  }

  // 用户主动配置
  if (featuredBadgeIds !== undefined && featuredBadgeIds !== null) {
    const customList: BadgeDisplay[] = [];
    const seenIds = new Set<string>();
    for (const id of featuredBadgeIds) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const b = badgeMap.get(id);
      if (b && unlockedSet.has(id)) {
        customList.push(b);
      }
      if (customList.length >= FEATURED_BADGE_LIMIT) break;
    }
    if (customList.length > 0) {
      return { badges: customList, source: "manual" };
    }
  }

  // 自动精选：筛选出所有已解锁徽章，每个系列（seriesKey）仅保留最高品质的那一枚
  const candidateBadges = displayBadges.filter((b) => unlockedSet.has(b.id));
  if (candidateBadges.length === 0) {
    return { badges: [], source: "default" };
  }

  const seriesBestMap = new Map<string, BadgeDisplay>();
  for (const badge of candidateBadges) {
    const key = badge.seriesKey || badge.id;
    const existing = seriesBestMap.get(key);
    if (!existing) {
      seriesBestMap.set(key, badge);
    } else {
      const weightExisting = existing.tier ? TIER_WEIGHT[existing.tier] ?? 0 : 0;
      const weightBadge = badge.tier ? TIER_WEIGHT[badge.tier] ?? 0 : 0;
      if (weightBadge > weightExisting) {
        seriesBestMap.set(key, badge);
      }
    }
  }

  const distinctBadges = Array.from(seriesBestMap.values());
  distinctBadges.sort((a, b) => {
    const weightA = a.tier ? TIER_WEIGHT[a.tier] ?? 0 : 0;
    const weightB = b.tier ? TIER_WEIGHT[b.tier] ?? 0 : 0;
    return weightB - weightA;
  });

  return { badges: distinctBadges.slice(0, FEATURED_BADGE_LIMIT), source: "default" };
}

/** 推导用户主页佩戴的精选徽章，首屏露出数量由具体布局决定。 */
export function deriveFeaturedBadges(args: Parameters<typeof resolveFeaturedBadges>[0]): BadgeDisplay[] {
  return resolveFeaturedBadges(args).badges;
}
