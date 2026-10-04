import { describe, expect, it } from "vitest";

import {
  buildProjectSeoDescription,
  clampChineseDescription,
  isPlaceholderProjectDescription,
  isPlaceholderProjectStep,
} from "@/lib/seo/project-description";

describe("project copy placeholder detection", () => {
  it("flags importer and title-only descriptions", () => {
    expect(isPlaceholderProjectDescription("材料与步骤见正文。")).toBe(true);
    expect(isPlaceholderProjectDescription("物理探索 木质科技制作")).toBe(true);
    expect(isPlaceholderProjectDescription("投石机", "投石机")).toBe(true);
    expect(isPlaceholderProjectDescription("【启蒙版预览】\n材料与步骤见正文。", "投石机")).toBe(true);
  });

  it("keeps short genuine descriptions", () => {
    expect(isPlaceholderProjectDescription("观察水位变化。", "乌鸦喝水")).toBe(false);
  });

  it("flags generic video steps but keeps real step descriptions", () => {
    expect(isPlaceholderProjectStep({ title: "观看实验视频", description: "请准备好对应实验材料包，跟随本页视频完成操作。" })).toBe(true);
    expect(isPlaceholderProjectStep({ title: "步骤 1", description: "量杯中加入20毫升清水。" })).toBe(false);
  });
});

describe("buildProjectSeoDescription", () => {
  it("prefers a genuine stored description without generated facts", () => {
    const description = buildProjectSeoDescription({
      title: "动态雕塑（悬挂）",
      description: "制作可以随风摆动的悬挂式动态雕塑。",
      reflection: "每层横杆两端配重平衡。",
      steps: [{ title: "设计", description: "剪出形状。" }],
      hasVideo: true,
    });
    expect(description).toBe("制作可以随风摆动的悬挂式动态雕塑。");
    expect(description).not.toContain("标签");
    expect(description).not.toContain("步骤");
  });

  it("falls back from a placeholder to reflection, then a real step body", () => {
    expect(buildProjectSeoDescription({
      title: "大气压力",
      description: "材料与步骤见正文。",
      reflection: "空气压力会作用在物体表面。",
    })).toBe("空气压力会作用在物体表面。");

    expect(buildProjectSeoDescription({
      title: "硬币存水",
      description: "见正文。",
      reflection: "",
      steps: [
        { title: "观看实验视频", description: "请准备好对应实验材料包，跟随本页视频完成操作。" },
        { title: "步骤 1", description: "量杯中加入20毫升清水。" },
      ],
    })).toBe("量杯中加入20毫升清水。");
  });

  it("uses only honest title and video availability when no copy exists", () => {
    expect(buildProjectSeoDescription({ title: "大气压力", hasVideo: true })).toBe("大气压力，页面提供演示视频。");
    expect(buildProjectSeoDescription({ title: "大气压力" })).toBe("大气压力");
  });

  it("cleans video markers before selecting metadata copy", () => {
    expect(buildProjectSeoDescription({
      title: "实验",
      description: "真实说明。\n演示视频：https://example.com/demo.mp4",
      hasVideo: true,
    })).toBe("真实说明。");
  });

  it("ignores cleaned placeholder reflection and continues to a real step", () => {
    expect(buildProjectSeoDescription({
      title: "实验",
      description: "材料与步骤见正文。",
      reflection: "见视频",
      steps: [{ title: "步骤 1", description: "先加入清水。" }],
    })).toBe("先加入清水。");
  });

  it("clamps long factual copy without minimum length padding", () => {
    expect(buildProjectSeoDescription({ title: "短项目", description: "简短。" })).toBe("简短。");
    expect(clampChineseDescription(`${"一".repeat(100)}。${"二".repeat(80)}`)).toBe(`${"一".repeat(100)}。`);
  });
});
