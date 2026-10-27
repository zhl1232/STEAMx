import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo/metadata";
import { BRAND_FULL_NAME } from "@/lib/brand";
import PlaygroundShell from "./playground-shell";

export const metadata: Metadata = buildPageMetadata({
  title: "游乐场 亲子探索与益智游戏",
  description:
    `在${BRAND_FULL_NAME}游乐场试天平、走迷宫、观察生命游戏、玩函数战争，选择亲子玩法并把好奇带回生活。`,
  path: "/playground",
  keywords: ["创探空间 游乐场", "益智游戏", "在线小游戏", "算法学习", "数学游戏"],
});

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return <PlaygroundShell>{children}</PlaygroundShell>;
}
