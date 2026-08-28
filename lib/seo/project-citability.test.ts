import { describe, expect, it } from "vitest";

import {
  buildProjectCiteDescription,
  buildProjectCiteKeywords,
  projectKindLabel,
} from "@/lib/seo/project-citability";

const reviewed = {
  recommendedMinAge: 6,
  recommendedMaxAge: null,
  ageLabel: "6 岁起",
  difficultyBand: "beginner" as const,
  difficultyLabel: "入门",
  supportLevel: "guided" as const,
  supportLabel: "建议成人陪同",
  educationStage: "primary" as const,
  educationStageLabel: "小学",
  status: "reviewed" as const,
};

describe("project citability copy", () => {
  it("leads science projects with age and 科学小实验", () => {
    expect(projectKindLabel("科学")).toBe("科学小实验");
    expect(
      buildProjectCiteDescription({
        title: "静电章鱼",
        description: "用塑料袋制作一只可爱的章鱼，通过摩擦产生静电让它飘浮在空中。",
        category: "科学",
        classification: reviewed,
      }),
    ).toBe("静电章鱼是适合6岁起的科学小实验。用塑料袋制作一只可爱的章鱼，通过摩擦产生静电让它飘浮在空中。");
  });

  it("keeps keywords free of 项目式学习 and adds 科学小实验 for science", () => {
    const keywords = buildProjectCiteKeywords({
      title: "静电章鱼",
      category: "科学",
      subCategory: "物理实验",
      tags: ["静电"],
    });
    expect(keywords).toEqual(expect.arrayContaining(["静电章鱼", "科学", "科学小实验", "STEAM项目"]));
    expect(keywords).not.toContain("项目式学习");
  });
  it("prefers a one-sentence reflection over the long description", () => {
    expect(
      buildProjectCiteDescription({
        title: "静电章鱼",
        description: "用塑料袋制作一只可爱的章鱼，通过摩擦产生静电让它飘浮在空中。",
        category: "科学",
        classification: reviewed,
        reflection: "同种电荷相互排斥，摩擦起电后章鱼会飘起来。",
      }),
    ).toBe("静电章鱼是适合6岁起的科学小实验。同种电荷相互排斥，摩擦起电后章鱼会飘起来。");
  });
});
