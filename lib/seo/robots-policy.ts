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
