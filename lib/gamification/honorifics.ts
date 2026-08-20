import { BADGES, getBadgeDisplayDefinitions } from "./badges";
import { BadgeDisplay, BadgeTier } from "./types";

const TIER_WEIGHT: Record<BadgeTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5,
};

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

/**
 * 推导用户主页首屏展示的精选高光徽章（1~3 枚）
 * - 若用户主动设置了 featured_badge_ids，展示用户指定的（最多 3 枚）
 * - 若未设置，自动从已解锁徽章中选出最高品质的 3 枚
 */
export function deriveFeaturedBadges({
  featuredBadgeIds,
  unlockedBadgeIds,
  allBadges,
}: {
  featuredBadgeIds?: string[] | null;
  unlockedBadgeIds: string[] | Set<string>;
  allBadges?: BadgeDisplay[];
}): BadgeDisplay[] {
  const displayBadges = allBadges || getBadgeDisplayDefinitions(BADGES);
  const badgeMap = new Map<string, BadgeDisplay>(displayBadges.map((b) => [b.id, b]));
  const unlockedSet = unlockedBadgeIds instanceof Set ? unlockedBadgeIds : new Set(unlockedBadgeIds);

  // 用户主动配置
  if (featuredBadgeIds && featuredBadgeIds.length > 0) {
    const customList: BadgeDisplay[] = [];
    for (const id of featuredBadgeIds) {
      const b = badgeMap.get(id);
      if (b && unlockedSet.has(id)) {
        customList.push(b);
      }
      if (customList.length >= 5) break;
    }
    if (customList.length > 0) {
      return customList;
    }
  }

  // 自动精选：筛选出所有已解锁徽章，每个系列（seriesKey）仅保留最高品质的那一枚
  const candidateBadges = displayBadges.filter((b) => unlockedSet.has(b.id));
  if (candidateBadges.length === 0) {
    return [];
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

  return distinctBadges.slice(0, 5);
}
