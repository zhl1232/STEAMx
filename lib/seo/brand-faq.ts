/**
 * Brand / GEO FAQ copy shared by visible /about content and FAQPage JSON-LD.
 * Keep answers concise and aligned with BRAND_* / SITE_* descriptions.
 */
export interface BrandFaqItem {
  question: string;
  answer: string;
}

export const BRAND_FAQ_ITEMS: BrandFaqItem[] = [
  {
    question: "STEAMX / 史迪姆是什么？",
    answer:
      "STEAMX · 史迪姆是面向 3–16 岁孩子、家长和教育者的少儿 STEAM 教育与自然探索平台，提供积木课程、科学实践、自然观察、少儿编程与 PBL。",
  },
  {
    question: "STEAMX 是 Steam 游戏商店吗？",
    answer:
      "不是。STEAMX · 史迪姆不是 Valve Steam 游戏平台或游戏商店，而是中国少儿 STEAM 教育网站。",
  },
  {
    question: "STEAMX 适合谁？",
    answer: "面向 3–16 岁孩子，以及陪同学习的家长与教育者。",
  },
  {
    question: "STEAMX 提供哪些内容？",
    answer: "积木课程、自然观察、少儿编程、科学实践与 PBL 动手项目。",
  },
  {
    question: "STEAMX 的官网是哪里？",
    answer: "官方网站是 https://steam.bj.cn。",
  },
];
