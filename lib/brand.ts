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
/**
 * Core tagline shared by /about, the welcome message, and BRAND_HERO_STATEMENT.
 * The homepage hero headline uses BRAND_HOME_HERO_TITLE instead.
 */
export const BRAND_HERO_TITLE = "兴趣是最好的老师";
/**
 * Homepage hero headline (desktop + mobile only). Both layouts may split it at "，"
 * so the parent-facing message stays readable on narrow screens.
 */
export const BRAND_HOME_HERO_TITLE = "陪孩子找个有趣的项目，一起动手做。";
/** Homepage hero subtitle shown under the headline. */
export const BRAND_HERO_SUBTITLE = "搭积木、做小实验、学编程，去自然里观察。";
/** A practical next step shown with the homepage activities and free-course entry. */
export const BRAND_HOME_HERO_GUIDE = "从孩子想做的开始，跟着指导一步步尝试。";
/**
 * Educational statement used by welcome/contact messages. Keep it independent
 * from homepage activity copy and aligned with the deployed welcome-message default.
 */
export const BRAND_HERO_STATEMENT =
  `${BRAND_HERO_TITLE}。在真实项目中动手探索，学会拆解问题、持续迭代。`;

export const BRAND_POSITIONING = "帮家长陪孩子找项目、动手做";

/** Core educational belief — short tagline (about / brand docs; not SEO title spam). */
export const BRAND_CORE_TAGLINE =
  "兴趣是最好的老师。在动手中，让孩子学会解决问题。";

/** Full core positioning statement (about / brand docs). */
export const BRAND_CORE_STATEMENT =
  "兴趣是最好的老师。我们鼓励孩子在动手中发现问题、尝试解决、获得成功反馈，在真实项目的探索与创造中自主定义挑战、持续跨界协作，逐步培养拆解复杂问题与持续迭代的能力，让这种主动学习的能力伴随一生。";

export const BRAND_OFFICIAL_URL = "https://steam.bj.cn";

/** Default meta / Open Graph description; keep aligned with the visible hero copy. */
export const BRAND_DESCRIPTION =
  `${BRAND_FULL_NAME}帮助家长陪孩子找到感兴趣的动手项目，提供积木搭建、科学小实验、编程和自然观察的内容与指导。先挑一节免费课程，一起动手做。`;

/** Extra names search engines may use for the brand entity (never the legacy STEAMX / 史迪姆 names). */
export const BRAND_ALTERNATE_NAMES = [`${BRAND_NAME} STEAM`] as const;

/**
 * Official public profile URLs for Organization.sameAs.
 * Only add verifiable profile pages that crawlers can open (no QR redirects, no guesses).
 */
export const BRAND_SAME_AS: readonly string[] = [];
