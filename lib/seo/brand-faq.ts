import { BRAND_DESCRIPTION } from "@/lib/brand";

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
    answer: BRAND_DESCRIPTION,
  },
  {
    question: "开始动手项目前需要准备什么？",
    answer:
      "先阅读具体项目的材料清单和步骤，再准备所需积木、工具或观察记录用品。不同项目要求不同，涉及工具操作或户外活动时，建议由家长陪同并先评估安全条件。",
  },
  {
    question: "创探空间适合谁？",
    answer: "主要面向 3–16 岁孩子及陪同的家长，也适合寻找动手内容的教育者。具体内容应结合课程或项目的年龄说明、难度和孩子已有经验选择。",
  },
  {
    question: "创探空间提供哪些内容？",
    answer: "积木搭建课程、科学小实验、少儿编程和自然观察的内容与指导，也有可以自主挑战的动手项目。",
  },
  {
    question: "如何开始学习并完成自己的作品？",
    answer: "从免费课程或探索项目中，和孩子一起选择感兴趣的内容；先读说明和材料清单，再按步骤尝试。遇到问题时记录现象、调整做法，完成后整理作品和探索过程。",
  },
  {
    question: "创探空间的官网是哪里？",
    answer: "官方网站是 https://steam.bj.cn。",
  },
];
