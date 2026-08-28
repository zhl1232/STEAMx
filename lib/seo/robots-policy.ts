export const PRIVATE_CRAWLER_DISALLOW = [
  "/api/",
  "/admin/",
  "/login",
  "/messages/",
  "/settings/",
  "/share/",
  "/coins/",
  "/shop/",
  "/profile",
  "/migrate",
] as const;

export const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
] as const;

/** 头条/抖音索引 → 豆包；神马索引 → 通义。文心走 Baiduspider。 */
export const CN_INDEX_CRAWLER_USER_AGENTS = [
  "Bytespider",
  "YisouSpider",
] as const;
