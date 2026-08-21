import { describe, expect, it } from "vitest";
import { deriveFeaturedBadges, deriveUserTitle, getAvailableTitles, getLevelDefaultTitle, resolveFeaturedBadges } from "./honorifics";

describe("honorifics system", () => {
  describe("getLevelDefaultTitle", () => {
    it("returns level based fallback titles", () => {
      expect(getLevelDefaultTitle(1)).toBe("探索新手");
      expect(getLevelDefaultTitle(4)).toBe("探索先锋");
      expect(getLevelDefaultTitle(6)).toBe("造物能手");
      expect(getLevelDefaultTitle(9)).toBe("STEAM 达人");
      expect(getLevelDefaultTitle(12)).toBe("宗师创作者");
    });
  });

  describe("deriveUserTitle", () => {
    it("returns null if equippedTitle is 'none'", () => {
      const title = deriveUserTitle({
        equippedTitle: "none",
        unlockedBadgeIds: ["intro_likes_bronze"],
        level: 4,
      });
      expect(title).toBeNull();
    });

    it("returns custom equippedTitle when set", () => {
      const title = deriveUserTitle({
        equippedTitle: "造物大师",
        unlockedBadgeIds: ["intro_likes_bronze"],
        level: 2,
      });
      expect(title).toBe("造物大师");
    });

    it("automatically derives title from highest tier unlocked badge when not manually set", () => {
      const title = deriveUserTitle({
        equippedTitle: null,
        unlockedBadgeIds: ["intro_likes_bronze", "science_expert_gold"],
        level: 2,
      });
      expect(title).toBe("假说验证者"); // science_expert_gold 的名称
    });

    it("falls back to level title if no badges unlocked", () => {
      const title = deriveUserTitle({
        equippedTitle: null,
        unlockedBadgeIds: [],
        level: 4,
      });
      expect(title).toBe("探索先锋");
    });
  });

  describe("getAvailableTitles", () => {
    it("includes level title and all unlocked badge names", () => {
      const titles = getAvailableTitles({
        unlockedBadgeIds: ["intro_likes_bronze", "tech_expert_silver"],
        level: 3,
      });
      expect(titles).toContain("探索先锋");
      expect(titles).toContain("随手点赞");
      expect(titles).toContain("模块搭建师");
    });
  });

  describe("deriveFeaturedBadges", () => {
    it("returns custom featured badges when specified and unlocked", () => {
      const featured = deriveFeaturedBadges({
        featuredBadgeIds: ["intro_likes_bronze"],
        unlockedBadgeIds: ["intro_likes_bronze", "science_expert_gold"],
      });
      expect(featured).toHaveLength(1);
      expect(featured[0].id).toBe("intro_likes_bronze");
    });

    it("automatically selects top badges (up to 5) by tier when not specified", () => {
      const featured = deriveFeaturedBadges({
        featuredBadgeIds: null,
        unlockedBadgeIds: [
          "intro_likes_bronze",
          "science_expert_gold",
          "tech_expert_silver",
          "intro_publish_platinum",
          "engineering_expert_bronze",
          "art_expert_bronze",
        ],
      });
      // 最多展示 5 个不同系列，且按 platinum, gold, silver, bronze 排序
      expect(featured).toHaveLength(5);
      expect(featured[0].id).toBe("intro_publish_platinum");
      expect(featured[1].id).toBe("science_expert_gold");
      expect(featured[2].id).toBe("tech_expert_silver");
      expect(featured.slice(3).map((badge) => badge.id)).toEqual([
        "intro_likes_bronze",
        "engineering_expert_bronze",
      ]);
    });

    it("keeps up to 5 manually selected badges in the configured order", () => {
      const featured = deriveFeaturedBadges({
        featuredBadgeIds: [
          "intro_likes_bronze",
          "science_expert_gold",
          "tech_expert_silver",
          "intro_publish_platinum",
          "engineering_expert_bronze",
          "art_expert_bronze",
          "math_expert_bronze",
        ],
        unlockedBadgeIds: [
          "intro_likes_bronze",
          "science_expert_gold",
          "tech_expert_silver",
          "intro_publish_platinum",
          "engineering_expert_bronze",
          "art_expert_bronze",
          "math_expert_bronze",
        ],
      });

      expect(featured).toHaveLength(5);
      expect(featured.map((badge) => badge.id)).toEqual([
        "intro_likes_bronze",
        "science_expert_gold",
        "tech_expert_silver",
        "intro_publish_platinum",
        "engineering_expert_bronze",
      ]);
    });

    it("deduplicates badges in the same series, keeping only the highest tier", () => {
      const featured = deriveFeaturedBadges({
        featuredBadgeIds: null,
        unlockedBadgeIds: [
          "playground_explorer_gold", // 金
          "playground_explorer_silver", // 银 (同系列)
          "playground_explorer_bronze", // 铜 (同系列)
          "playground_victories_silver", // 银 (另一系列)
        ],
      });
      // 应该保留 playground_explorer_gold 和 playground_victories_silver，而不是包含同系列银阶
      expect(featured).toHaveLength(2);
      expect(featured.map((b) => b.id)).toEqual([
        "playground_explorer_gold",
        "playground_victories_silver",
      ]);
    });

    it("returns empty array if user has no unlocked badges", () => {
      const featured = deriveFeaturedBadges({
        featuredBadgeIds: null,
        unlockedBadgeIds: [],
      });
      expect(featured).toEqual([]);
    });

    it("reports whether the actual selection is manual or default", () => {
      const defaultSelection = resolveFeaturedBadges({
        featuredBadgeIds: null,
        unlockedBadgeIds: ["intro_likes_bronze", "science_expert_gold"],
      });
      expect(defaultSelection.source).toBe("default");
      expect(defaultSelection.badges.map((badge) => badge.id)).toEqual([
        "science_expert_gold",
        "intro_likes_bronze",
      ]);

      const emptySelection = resolveFeaturedBadges({
        featuredBadgeIds: [],
        unlockedBadgeIds: ["intro_likes_bronze", "science_expert_gold"],
      });
      expect(emptySelection.source).toBe("manual");
      expect(emptySelection.badges).toEqual([]);

      const manualSelection = resolveFeaturedBadges({
        featuredBadgeIds: ["intro_likes_bronze", "intro_likes_bronze", "science_expert_gold"],
        unlockedBadgeIds: ["intro_likes_bronze", "science_expert_gold"],
      });
      expect(manualSelection.source).toBe("manual");
      expect(manualSelection.badges.map((badge) => badge.id)).toEqual([
        "intro_likes_bronze",
        "science_expert_gold",
      ]);
    });
  });
});
