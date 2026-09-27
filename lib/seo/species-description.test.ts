import { describe, expect, it } from "vitest";

import { buildSpeciesIntroText, buildSpeciesSeoDescription } from "@/lib/seo/species-description";

// DEV row for /nature/species/osmoderma-barnabita.
const osmoderma = {
  commonName: "凹背臭斑金龟",
  scientificName: "Osmoderma barnabita",
  aliases: [],
  taxonGroup: "鞘翅目 金龟科",
  topicKey: "insects" as const,
  identificationNotes:
    "体长 24–30 mm。体宽厚、硕大肥胖。本地唯一一种大型斑金龟。通体全黑色或黑褐色，体表反光极微弱。前胸背板正中央具纵向中凹（雄虫深、雌虫浅）。被惊扰时雄虫可释放出皮革厂般的怪异浓烈臭味。",
  habitatNotes: "原论坛时代的‘北京神物’级珍稀金龟。",
  seasonalityNotes: "成虫主要在 6–8 月盛夏发生。",
  stats: { totalObservationCount: 0, latestObservedAt: null },
};

describe("species SEO copy", () => {
  it("leads the description with names and taxonomy, then real notes", () => {
    const description = buildSpeciesSeoDescription(osmoderma);
    expect(description.startsWith("凹背臭斑金龟（Osmoderma barnabita），鞘翅目 金龟科昆虫。体长 24–30 mm。")).toBe(true);
    expect(description.length).toBeGreaterThanOrEqual(80);
    expect(description.length).toBeLessThanOrEqual(150);
  });

  it("falls back to a name-specific sentence when notes are empty", () => {
    const description = buildSpeciesSeoDescription({ commonName: "麻雀", topicKey: "birds" });
    expect(description).toBe("麻雀，鸟类。物种档案，包含识别特征、常见环境和近期观察线索。");
  });

  it("builds an intro from taxonomy, aliases, season and observation stats", () => {
    expect(buildSpeciesIntroText({ ...osmoderma, archiveLabel: "昆虫档案" })).toBe(
      "凹背臭斑金龟（学名 Osmoderma barnabita）是创探空间昆虫档案收录的物种，分类上属于鞘翅目 金龟科。常见时段：成虫主要在 6–8 月盛夏发生。社区暂无公开观察记录，欢迎提交第一条观察。",
    );
    expect(
      buildSpeciesIntroText({
        commonName: "麻雀",
        aliases: ["树麻雀", "家雀"],
        stats: { totalObservationCount: 12, latestObservedAt: "2026-09-01T02:00:00Z" },
        archiveLabel: "鸟类档案",
      }),
    ).toBe("麻雀是创探空间鸟类档案收录的物种。别名：树麻雀、家雀。社区已记录 12 条公开观察，最近一次在 2026年9月1日。");
  });
});
