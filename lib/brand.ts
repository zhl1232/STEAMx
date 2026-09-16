/**
 * User-facing brand names shared by metadata, navigation, and product surfaces.
 *
 * Keep STEAM as the subject acronym; do not use steam教育 as a head keyword. These constants
 * describe the product brand itself.
 */
export const BRAND_NAME = "STEAMX";
export const BRAND_NAME_ZH = "史迪姆";
export const BRAND_FULL_NAME = `${BRAND_NAME} · ${BRAND_NAME_ZH}`;
export const BRAND_TAGLINE = "少儿编程 · 积木 · 自然观察";

export const BRAND_POSITIONING = "少儿 STEAM 教育与自然探索平台";

/** Core educational belief — short tagline (about / brand docs; not SEO title spam). */
export const BRAND_CORE_TAGLINE =
  "兴趣是最好的老师。在动手中，让孩子学会解决问题的能力。";

/** Full core positioning statement (about / brand docs). */
export const BRAND_CORE_STATEMENT =
  "史迪姆相信：兴趣是最好的老师；孩子在动手中发现问题、尝试解决、成功反馈——在真实项目的探索与创造中，自主定义挑战、持续跨界协作，掌握拆解复杂问题并持续迭代的终身能力。";

export const BRAND_OFFICIAL_URL = "https://steam.bj.cn";

/** Human-facing / hero copy. Avoid jargon like「项目式学习」on the homepage surface. */
export const BRAND_DESCRIPTION =
  `${BRAND_FULL_NAME}是面向 3–16 岁孩子、家长和教育者的${BRAND_POSITIONING}（非游戏平台），提供积木课程、科学实践、自然观察、少儿编程与 PBL，帮助孩子在动手实践中学习、创造和分享。`;

/** Crawler / AI-overview disambiguation: win STEAMX / 品类组合查询，避开 Valve Steam. */
export const BRAND_DISAMBIGUATION =
  `${BRAND_FULL_NAME}不是 Valve Steam 游戏平台或游戏商店，而是中国少儿 STEAM 教育网站，官网 ${BRAND_OFFICIAL_URL}。`;

export const BRAND_ALTERNATE_NAMES = [
  BRAND_NAME,
  BRAND_NAME_ZH,
  `${BRAND_NAME} ${BRAND_NAME_ZH}`,
  `${BRAND_NAME}${BRAND_NAME_ZH}`,
  "STEAMX史迪姆",
] as const;
