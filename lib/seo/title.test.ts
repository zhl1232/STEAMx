import fs from "node:fs";
import path from "node:path";

import { resolveTitle } from "next/dist/lib/metadata/resolvers/resolve-title";
import { describe, expect, it } from "vitest";

import { buildPageMetadata } from "@/lib/seo/metadata";
import { buildPlaygroundMetadata } from "@/lib/seo/playground-metadata";
import {
  SITE_TITLE_TEMPLATE,
  buildSegmentTitle,
  formatDocumentTitle,
  stripSiteTitleSuffix,
} from "@/lib/seo/title";

type TitleInput = Parameters<typeof resolveTitle>[0];

// Mirrors app/layout.tsx (importing the layout would pull next/font into the test).
const rootMetadata = { title: { template: SITE_TITLE_TEMPLATE, default: "创探空间｜首页" } };

/** Mimics Next's layout → page title resolution (template stashed from the parent). */
function resolveChain(...titles: TitleInput[]): string {
  let template: string | null = null;
  let absolute = "";
  for (const title of titles) {
    const resolved = resolveTitle(title, template);
    absolute = resolved.absolute;
    template = resolved.template;
  }
  return absolute;
}

describe("site title template", () => {
  it("root layout uses the shared `%s | 创探空间` template", () => {
    expect(SITE_TITLE_TEMPLATE).toBe("%s | 创探空间");
    const layoutSource = fs.readFileSync(path.resolve(__dirname, "../../app/layout.tsx"), "utf8");
    expect(layoutSource).toMatch(/template:\s*SITE_TITLE_TEMPLATE/);
  });

  it("formats titles with exactly one brand suffix", () => {
    expect(formatDocumentTitle("七巧板 在线拼图")).toBe("七巧板 在线拼图 | 创探空间");
    expect(formatDocumentTitle("探索指南 | 创探空间")).toBe("探索指南 | 创探空间");
    expect(formatDocumentTitle("探索指南｜创探空间")).toBe("探索指南 | 创探空间");
    expect(formatDocumentTitle("LDraw 3D 预览工作台 · 创探空间")).toBe("LDraw 3D 预览工作台 | 创探空间");
    expect(formatDocumentTitle("X | 创探空间 | 创探空间")).toBe("X | 创探空间");
    expect(stripSiteTitleSuffix("创探空间实验室")).toBe("创探空间实验室");
  });

  it("keeps the brand suffix on nested segments (layout title no longer drops the template)", () => {
    // Before: /playground layout set a plain string, so /playground/tangram rendered just "七巧板".
    expect(resolveChain(rootMetadata.title as TitleInput, "游乐场", "七巧板")).toBe("七巧板");

    const playgroundLayout = buildPageMetadata({ title: "游乐场 在线益智小游戏", description: "d", path: "/playground" });
    const tangram = buildPlaygroundMetadata("/playground/tangram");
    expect(resolveChain(rootMetadata.title as TitleInput, playgroundLayout.title as TitleInput)).toBe(
      "游乐场 在线益智小游戏 | 创探空间",
    );
    expect(
      resolveChain(rootMetadata.title as TitleInput, playgroundLayout.title as TitleInput, tangram.title as TitleInput),
    ).toBe("七巧板 在线拼图 | 创探空间");
    // A plain string child below a builder-made layout still gets exactly one suffix.
    expect(resolveChain(rootMetadata.title as TitleInput, buildSegmentTitle("游乐场"), "某子页")).toBe("某子页 | 创探空间");
  });

  it("never double-suffixes when a caller passes a branded title", () => {
    const meta = buildPageMetadata({ title: "探索指南 | 创探空间", description: "d", path: "/start" });
    expect(resolveChain(rootMetadata.title as TitleInput, meta.title as TitleInput)).toBe("探索指南 | 创探空间");
    expect(meta.openGraph?.title).toBe("探索指南");
  });

  it("app route metadata never hard-codes the brand suffix in a title literal", () => {
    const appDir = path.resolve(__dirname, "../../app");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/^(page|layout)\.tsx?$/.test(entry.name)) {
          const source = fs.readFileSync(full, "utf8");
          if (/title:\s*['"`][^'"`\n]*[|｜·]\s*创探空间['"`]/.test(source)) offenders.push(path.relative(appDir, full));
        }
      }
    };
    walk(appDir);
    expect(offenders).toEqual([]);
  });
});
