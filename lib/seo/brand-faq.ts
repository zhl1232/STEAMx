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
      "创探空间是面向 3–16 岁孩子、家长和教育者的少儿 STEAM 学习与创作平台，提供积木课程、科学实践、自然观察、少儿编程与 PBL。",
  },
  {
    question: "开始动手项目前需要准备什么？",
    answer:
      "先阅读具体项目的材料清单和步骤，再准备所需积木、工具或观察记录用品。不同项目要求不同，涉及工具操作或户外活动时，建议由家长陪同并先评估安全条件。",
  },
  {
    question: "创探空间适合谁？",
    answer: "面向 3–16 岁孩子，以及陪同学习的家长与教育者。具体内容应结合课程或项目的年龄说明、难度和孩子已有经验选择。",
  },
  {
    question: "创探空间提供哪些内容？",
    answer: "积木课程、自然观察、少儿编程、科学实践与 PBL 动手项目。",
  },
  {
    question: "如何开始学习并完成自己的作品？",
    answer: "从技能课程或项目探索选择感兴趣的内容，阅读说明，按步骤尝试；遇到问题时记录现象、调整做法，完成后整理自己的作品和探索过程。",
  },
  {
    question: "创探空间的官网是哪里？",
    answer: "官方网站是 https://steam.bj.cn。",
  },
];
