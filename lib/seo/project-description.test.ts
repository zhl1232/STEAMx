import { describe, expect, it } from "vitest";

import { buildProjectCiteDescription } from "@/lib/seo/project-citability";
import {
  buildProjectOverviewText,
  buildProjectSeoDescription,
  clampChineseDescription,
  isPlaceholderProjectDescription,
  isPlaceholderProjectStep,
} from "@/lib/seo/project-description";

const reviewed = (minAge: number) => ({
  recommendedMinAge: minAge,
  recommendedMaxAge: null,
  ageLabel: `${minAge} 岁起`,
  difficultyBand: "beginner" as const,
  difficultyLabel: "入门",
  supportLevel: "guided" as const,
  supportLabel: "建议成人陪同",
  educationStage: "preschool" as const,
  educationStageLabel: "学前",
  status: "reviewed" as const,
});

// Shape of the imported kejiao16a science-kit rows (e.g. /project/1192 on DEV).
const kitProject = (title: string, grade: string) => ({
  title,
  description: "材料与步骤见正文。",
  category: "科学",
  subCategory: "物理实验",
  classification: reviewed(4),
  tags: ["科教版", grade, `kejiao16a-src:${grade}:006_${title}`],
  materials: [`《${title}》对应实验材料包 1 套（需自行购买）`],
  steps: [{ title: "观看实验视频", description: "请准备好对应实验材料包，跟随本页视频完成操作。" }],
  hasVideo: true,
});

// Shape of /project/348 (real description + steps).
const mobile = {
  title: "动态雕塑（悬挂）",
  description: "制作可以随风摆动的悬挂式动态雕塑，掌握平衡原理与空间构成。灵感来源于艺术大师考尔德的活动雕塑，在艺术创作中融入物理平衡的科学知识。",
  reflection: "每层横杆两端配重平衡后向上悬挂，轻微气流就能让雕塑摆动。",
  category: "艺术",
  subCategory: "雕塑",
  classification: reviewed(8),
  tags: ["平衡", "动态"],
  materials: ["铝丝或细铁丝（多种长度）", "彩色卡纸或薄木片", "鱼线或细绳", "尖嘴钳", "剪刀", "小坠子或小珠子", "挂钩"],
  steps: [
    { title: "设计与裁剪形状", description: "在卡纸上设计并剪出各种有趣的形状。" },
    { title: "制作悬臂", description: "将铝丝剪成不同长度的横杆。" },
    { title: "单层平衡测试", description: "先从最底层开始。" },
    { title: "逐层向上搭建", description: "将已平衡的底层组件挂到上一层横杆的一端。" },
    { title: "微调整体平衡", description: "反复调整每层横杆的悬挂点。" },
    { title: "悬挂调试", description: "在顶部横杆的平衡点系上鱼线。" },
  ],
};

describe("placeholder detection", () => {
  it("flags importer placeholders and title-only summaries", () => {
    expect(isPlaceholderProjectDescription("材料与步骤见正文。")).toBe(true);
    expect(isPlaceholderProjectDescription("物理探索 木质科技制作")).toBe(true);
    expect(isPlaceholderProjectDescription("木质科学")).toBe(true);
    expect(isPlaceholderProjectDescription("见视频")).toBe(true);
    expect(isPlaceholderProjectDescription("投石机", "投石机")).toBe(true);
    expect(isPlaceholderProjectDescription("", "任意")).toBe(true);
  });

  it("keeps short but real summaries", () => {
    expect(isPlaceholderProjectDescription("逐粒向杯中加入小石子，观察水位如何变化。", "乌鸦喝水")).toBe(false);
    expect(isPlaceholderProjectDescription(mobile.description, mobile.title)).toBe(false);
  });

  it("flags 见视频 / watch-the-video steps only", () => {
    expect(isPlaceholderProjectStep({ title: "见视频", description: "见视频" })).toBe(true);
    expect(isPlaceholderProjectStep({ title: "观看实验视频", description: "请准备好对应实验材料包，跟随本页视频完成操作。" })).toBe(true);
    expect(isPlaceholderProjectStep({ title: "步骤 1", description: "量杯中加入20毫升清水。" })).toBe(false);
  });
});

describe("buildProjectSeoDescription", () => {
  it("replaces placeholder summaries with copy assembled from real fields", () => {
    const input = kitProject("大气压力", "幼儿园中班");
    const description = buildProjectSeoDescription({ ...input, citeDescription: "" });
    expect(description).toBe(
      "《大气压力》是创探空间「科学·物理实验」分类下的科学小实验，适合4岁起，难度入门，建议成人陪同。标签：科教版、幼儿园中班。需要准备《大气压力》对应实验材料包。页面附实验演示视频，可边看边做。",
    );
    expect(description).not.toContain("见正文");
    expect(description).not.toContain("kejiao16a");
    expect(description.length).toBeGreaterThanOrEqual(80);
    expect(description.length).toBeLessThanOrEqual(150);
  });

  it("is unique per placeholder project", () => {
    const a = buildProjectSeoDescription({ ...kitProject("大气压力", "幼儿园中班"), citeDescription: "" });
    const b = buildProjectSeoDescription({ ...kitProject("淀粉与碘酒", "幼儿园中班"), citeDescription: "" });
    expect(a).not.toBe(b);
  });

  it("keeps the existing cite copy for real summaries and tops it up with steps / materials", () => {
    const citeDescription = buildProjectCiteDescription({ ...mobile });
    expect(citeDescription).toBe("动态雕塑（悬挂）是适合8岁起的实践项目。每层横杆两端配重平衡后向上悬挂，轻微气流就能让雕塑摆动。");
    const description = buildProjectSeoDescription({ ...mobile, citeDescription });
    expect(description.startsWith(citeDescription)).toBe(true);
    expect(description).toContain("共 6 步：设计与裁剪形状、制作悬臂、单层平衡测试、逐层向上搭建等。");
    expect(description).toContain("材料：铝丝或细铁丝、彩色卡纸或薄木片、鱼线或细绳、尖嘴钳等。");
    expect(description.length).toBeGreaterThanOrEqual(80);
    expect(description.length).toBeLessThanOrEqual(150);
  });

  it("leaves already-long cite copy untouched", () => {
    const citeDescription = "甲".repeat(100);
    expect(buildProjectSeoDescription({ ...mobile, citeDescription })).toBe(citeDescription);
  });
});

describe("buildProjectOverviewText", () => {
  it("summarises steps and materials from the project itself", () => {
    expect(buildProjectOverviewText(mobile)).toBe(
      "《动态雕塑（悬挂）》是创探空间「艺术·雕塑」分类下的实践项目，适合8岁起，难度入门，建议成人陪同。标签：平衡、动态。共 6 个步骤：设计与裁剪形状、制作悬臂、单层平衡测试、逐层向上搭建、微调整体平衡、悬挂调试。需要准备 7 种材料：铝丝或细铁丝、彩色卡纸或薄木片、鱼线或细绳、尖嘴钳、剪刀、小坠子或小珠子等。",
    );
  });

  it("uses the first real step when step titles are generic", () => {
    const text = buildProjectOverviewText({
      title: "硬币存水",
      category: "科学",
      steps: [{ title: "步骤 1", description: "量杯中加入20毫升清水，并滴入两滴色素。" }],
    });
    expect(text).toContain("第一步：量杯中加入20毫升清水，并滴入两滴色素。");
  });
});

describe("clampChineseDescription", () => {
  it("prefers a sentence boundary", () => {
    const text = `${"一".repeat(100)}。${"二".repeat(80)}`;
    expect(clampChineseDescription(text, 150)).toBe(`${"一".repeat(100)}。`);
  });
});
