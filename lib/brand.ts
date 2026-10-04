/**
 * User-facing brand names shared by metadata, navigation, and product surfaces.
 *
 * Keep STEAM as the subject acronym. These constants
 * describe the product brand itself.
 */
export const BRAND_NAME = "创探空间";
/** @deprecated Prefer BRAND_NAME — kept as alias while call sites migrate. */
export const BRAND_NAME_ZH = BRAND_NAME;
export const BRAND_FULL_NAME = BRAND_NAME;
/** Brand slogan (mobile hero / marketing). */
export const BRAND_TAGLINE = "探索 · 创造 · 成长";
/** Desktop / primary homepage hero headline. */
export const BRAND_HERO_TITLE = "兴趣是最好的老师";
/** Homepage hero subtitle shown under the headline. */
export const BRAND_HERO_SUBTITLE = "在真实项目中动手探索，学会拆解问题、持续迭代。";
/** Full hero statement (headline + subtitle) for places that need one sentence. */
export const BRAND_HERO_STATEMENT = `${BRAND_HERO_TITLE}。${BRAND_HERO_SUBTITLE}`;

export const BRAND_POSITIONING = "少儿 STEAM 项目式学习平台";

/** Core educational belief — short tagline (about / brand docs; not SEO title spam). */
export const BRAND_CORE_TAGLINE =
  "兴趣是最好的老师。在动手中，让孩子学会解决问题。";

/** Full core positioning statement (about / brand docs). */
export const BRAND_CORE_STATEMENT =
  "兴趣是最好的老师。我们鼓励孩子在动手中发现问题、尝试解决、获得成功反馈，在真实项目的探索与创造中自主定义挑战、持续跨界协作，逐步培养拆解复杂问题与持续迭代的能力，让这种主动学习的能力伴随一生。";

export const BRAND_OFFICIAL_URL = "https://steam.bj.cn";

/** Default meta / Open Graph description; keep aligned with the visible hero copy. */
export const BRAND_DESCRIPTION =
  `${BRAND_FULL_NAME}是面向 3–16 岁孩子的${BRAND_POSITIONING}。兴趣是最好的老师：孩子在积木搭建、科学实验、自然观察和编程项目中动手发现问题、尝试解决、获得成功反馈。`;

/** Extra names search engines may use for the brand entity (never the legacy STEAMX / 史迪姆 names). */
export const BRAND_ALTERNATE_NAMES = [`${BRAND_NAME} STEAM`] as const;

/**
 * Official public profile URLs for Organization.sameAs.
 * Only add verifiable profile pages that crawlers can open (no QR redirects, no guesses).
 */
export const BRAND_SAME_AS: readonly string[] = [];
