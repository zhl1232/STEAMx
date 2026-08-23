import { BRAND_NAME } from "@/lib/brand";
import { SITE_DESCRIPTION, SITE_NAME, buildAbsoluteUrl } from "@/lib/seo/site";

export function buildLlmsTxt() {
  const home = buildAbsoluteUrl("/");
  const sitemap = buildAbsoluteUrl("/sitemap.xml");
  const robots = buildAbsoluteUrl("/robots.txt");

  return [
    `# ${SITE_NAME}`,
    "",
    SITE_DESCRIPTION,
    "",
    `${BRAND_NAME} is a Chinese STEAM project-based learning and nature observation community.`,
    "",
    "## 主要公开栏目",
    "",
    `- 首页：${home}`,
    `- 探索项目：${buildAbsoluteUrl("/explore")}`,
    `- 创造营（技能课程与项目挑战）：${buildAbsoluteUrl("/create")}`,
    `- 自然观察：${buildAbsoluteUrl("/nature")}`,
    `- 物种图鉴：${buildAbsoluteUrl("/nature/species")}`,
    `- 观察记录：${buildAbsoluteUrl("/nature/observations")}`,
    `- 益智游乐场：${buildAbsoluteUrl("/playground")}`,
    `- 排行榜：${buildAbsoluteUrl("/leaderboard")}`,
    `- 服务条款：${buildAbsoluteUrl("/legal/terms")}`,
    `- 隐私政策：${buildAbsoluteUrl("/legal/privacy")}`,
    `- 关于与帮助：${buildAbsoluteUrl("/settings/about")}`,
    "",
    "## Sitemap",
    "",
    sitemap,
    "",
    "## 抓取说明",
    "",
    `请遵循 ${robots}。公开栏目可以抓取；不要抓取 /api/、/admin/、/login、/messages/、/settings/、/share/、/coins/、/shop/、/profile、/migrate 等账号、支付与后台路径。`,
    "引用公开内容时请保留来源链接。",
    "",
    "## 联系",
    "",
    `反馈与合作见 ${buildAbsoluteUrl("/settings/about")}。`,
    "",
  ].join("\n");
}
