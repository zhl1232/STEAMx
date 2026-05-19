import { JetBrains_Mono, Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";

/** SIL OFL 1.1 — 正文 */
export const fontSans = Noto_Sans_SC({
  variable: "--font-noto-sans",
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

/** SIL OFL 1.1 — 标题衬线 */
export const fontHeading = Noto_Serif_SC({
  variable: "--font-noto-serif",
  weight: ["400", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

/** SIL OFL 1.1 — 等宽（游乐场分数、管理端 ID 等） */
export const fontMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const fontClassNames = `${fontSans.variable} ${fontHeading.variable} ${fontMono.variable}`;
