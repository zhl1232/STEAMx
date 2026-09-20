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
    question: "创探空间是什么？",
    answer:
      "创探空间是面向 3–16 岁孩子、家长和教育者的少儿 STEAM 在线学习与创作平台，提供积木课程、科学实践、自然观察、少儿编程与 PBL。",
  },
  {
    question: "创探空间是 Steam 游戏商店吗？",
    answer:
      "不是。创探空间不是 Valve Steam 游戏平台或游戏商店，而是中国少儿 STEAM 在线学习与创作平台。",
  },
  {
    question: "创探空间适合谁？",
    answer: "面向 3–16 岁孩子，以及陪同学习的家长与教育者。",
  },
  {
    question: "创探空间提供哪些内容？",
    answer: "积木课程、自然观察、少儿编程、科学实践与 PBL 动手项目。",
  },
  {
    question: "创探空间的官网是哪里？",
    answer: "官方网站是 https://steam.bj.cn。",
  },
];
