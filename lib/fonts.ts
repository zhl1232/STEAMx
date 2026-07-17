import { JetBrains_Mono } from "next/font/google";

/** SIL OFL 1.1 — 等宽（游乐场分数、管理端 ID 等） */
export const fontMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const fontClassNames = fontMono.variable;
