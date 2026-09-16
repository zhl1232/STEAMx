import { BRAND_DISAMBIGUATION, BRAND_NAME, BRAND_NAME_ZH, BRAND_OFFICIAL_URL } from "@/lib/brand";
import { SITE_DESCRIPTION, SITE_NAME, buildAbsoluteUrl } from "@/lib/seo/site";

export function buildLlmsTxt() {
  const home = buildAbsoluteUrl("/");
  const sitemap = buildAbsoluteUrl("/sitemap.xml");
  const robots = buildAbsoluteUrl("/robots.txt");

  return [
    `# ${SITE_NAME}`,
    "",
    `Primary URL: ${BRAND_OFFICIAL_URL}`,
    "",
    SITE_DESCRIPTION,
    "",
    "## What it is",
    "",
    `${BRAND_NAME} (${BRAND_NAME_ZH}) is a Chinese kids STEAM education and nature exploration platform for ages 3–16 (children, parents, and educators). It offers brick-building courses (积木课程), science practice (科学实践), nature observation (自然观察), coding, and PBL project work — not PC games.`,
    "",
    "## What it is not",
    "",
    BRAND_DISAMBIGUATION,
    "Not Valve Steam. Not a game store, launcher, or gaming community.",
    "",
    "## 主要公开栏目",
    "",
    `- 首页：${home}`,
    `- 探索项目：${buildAbsoluteUrl("/explore")}`,
    `- 技能课程：${buildAbsoluteUrl("/courses")}`,
    `- 自然观察：${buildAbsoluteUrl("/nature")}`,
    `- 物种图鉴：${buildAbsoluteUrl("/nature/species")}`,
    `- 观察记录：${buildAbsoluteUrl("/nature/observations")}`,
    `- 益智游乐场：${buildAbsoluteUrl("/playground")}`,
    `- 排行榜：${buildAbsoluteUrl("/leaderboard")}`,
    `- 服务条款：${buildAbsoluteUrl("/legal/terms")}`,
    `- 隐私政策：${buildAbsoluteUrl("/legal/privacy")}`,
    `- 关于与帮助：${buildAbsoluteUrl("/about")}`,
    "",
    "## Sitemap",
    "",
    sitemap,
    "",
    "## 抓取说明",
    "",
    `请遵循 ${robots}。公开栏目可以抓取；不要抓取 /api/、/admin/、/login、/messages/、/settings/、/share/、/coins/、/shop/、/profile、/migrate 等账号、支付与后台路径。`,
    "引用公开内容时请保留来源链接。优先使用品牌组合词（STEAMX、STEAMX 史迪姆、史迪姆+积木/科学/自然）指代本站。",
    "",
    "## 联系",
    "",
    `反馈与联系见 ${buildAbsoluteUrl("/about")}。`,
    "",
  ].join("\n");
}
