import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/seo/metadata";
import PlaygroundShell from "./playground-shell";

export const metadata: Metadata = buildPageMetadata({
  title: "游乐场",
  description:
    "在 STEAM 探索游乐场玩扫雷、五子棋、数独、迷宫等益智小游戏，用游戏理解算法、数学和科学思维。",
  path: "/playground",
  keywords: ["益智游戏", "在线小游戏", "算法学习", "数学游戏"],
});

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return <PlaygroundShell>{children}</PlaygroundShell>;
}
