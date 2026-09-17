# SEO / GEO 索引清单（运营）

面向 Google Search Console 与百度搜索资源平台的上线核对。规范主域：`https://steam.bj.cn`（旧域 `steamx.cc` / `www.steamx.cc` / `www.steam.bj.cn` 301 到主域）。

## 发现文件

| 资源 | URL |
|------|-----|
| Sitemap | https://steam.bj.cn/sitemap.xml |
| robots.txt | https://steam.bj.cn/robots.txt |
| llms.txt | https://steam.bj.cn/llms.txt |

`robots.txt` 对 `Baiduspider`、`Googlebot`、头条/神马索引爬虫与常见 AI 爬虫放行公开页，并 Disallow `/api/`、`/admin/`、`/login` 等私有路径。


## 站点验证文件清单（仓库 `public/`）

盘点结果（勿编造验证码 HTML 内容；平台换发新文件时按原名替换/新增）：

| 文件 | 用途 | 备注 |
|------|------|------|
| `public/baidu_verify_codeva-KA6qTMYNH9.html` | 百度文件验证 | 部署后可访问 `/baidu_verify_codeva-KA6qTMYNH9.html` |
| `public/baidu_verify_codeva-tQYR4t1xrB.html` | 百度文件验证 | 备选/历史文件名，部署后可访问对应路径 |
| `public/baidu_verify_codeva-6NbDDHF3kH.html` | 百度文件验证 | 主域当前文件验证；部署后可访问 `/baidu_verify_codeva-6NbDDHF3kH.html` |
| （无）Google HTML 文件验证（`*verify*` / `google*.html`） | Google 文件验证 | 未入库；优先 DNS/网域验证，或 meta：`GOOGLE_SITE_VERIFICATION` |
| （无）神马 / 字节跳动验证文件 | 文件验证 | 未入库；根布局已写 meta（`lib/seo/site-verification.ts`） |

**运营注意**：主域为 `steam.bj.cn` 时，百度搜索资源平台与 Google Search Console 须对**新主域重新验证**。仓库内 `baidu_verify_*.html` 可能仍是旧站签发文件，以平台当前下发内容为准，不要假设自动对 `steam.bj.cn` 生效。

## 优先提交的高价值 URL

1. https://steam.bj.cn/
2. https://steam.bj.cn/about
3. https://steam.bj.cn/courses
4. https://steam.bj.cn/explore
5. https://steam.bj.cn/nature
6. https://steam.bj.cn/nature/birds
7. https://steam.bj.cn/nature/insects
8. https://steam.bj.cn/nature/plants
9. https://steam.bj.cn/playground

其余课程/项目/物种/观察等由 sitemap 全量覆盖（搜索引擎定期抓取）；Release 主动推送默认只刷上表高价值 URL，全量推送需显式 `BAIDU_PUSH_MODE=sitemap`。

## Google Search Console

1. 添加资源：网域 `steam.bj.cn`（DNS）或网址前缀 `https://steam.bj.cn/`。
2. 前缀验证可选：把 HTML 标签 token 写入部署环境变量 `GOOGLE_SITE_VERIFICATION`（根布局输出 `google-site-verification` meta）。
3. 提交 sitemap：`https://steam.bj.cn/sitemap.xml`。
4. 用「网址检查」抽检首页、`/about`、`/courses`、`/nature`。

## 百度搜索资源平台

1. 绑定站点 `https://steam.bj.cn`（与旧 steamx.cc 站点区分；新主域需重新验证）。
2. 验证方式任选其一：
   - **文件验证**：详见上方「站点验证文件清单」；若平台下发新文件名，替换/新增对应静态文件，勿手写假验证码。
   - **Meta 验证**：把验证码写入 `BAIDU_SITE_VERIFICATION`，根布局输出 `baidu-site-verification` meta。
3. 提交 sitemap，并对上表高价值 URL 做「普通收录」或主动推送。
4. 主动推送（**默认只推高价值 URL**，不扫全量 sitemap）：
   - GitHub Release secret：`BAIDU_PUSH_TOKEN`（可选）；workflow 固定 `BAIDU_PUSH_SITE=https://steam.bj.cn`，`BAIDU_PUSH_CHUNK_SIZE=10`；默认 high-value 模式。
   - 本地默认高价值：`BAIDU_PUSH_TOKEN=... pnpm seo:baidu-push`
   - 本地全量 sitemap：`BAIDU_PUSH_TOKEN=... BAIDU_PUSH_MODE=sitemap pnpm seo:baidu-push`（或 `BAIDU_PUSH_ALL=1`）
   - 未配置 token 时脚本安全跳过，不阻塞发布；接口 `remain=0` 时停止，下一批超过 remain 会截断。

## 相关环境变量

| 变量 | 用途 |
|------|------|
| `GOOGLE_SITE_VERIFICATION` | Google Search Console meta |
| `BAIDU_SITE_VERIFICATION` | 百度站长 meta（可选；文件验证可替代） |
| `BAIDU_PUSH_TOKEN` | 百度主动推送 token（勿提交仓库） |
| `BAIDU_PUSH_SITE` | 必须为 `https://steam.bj.cn`（默认即此） |
| `BAIDU_PUSH_MODE` / `BAIDU_PUSH_ALL` | 默认 high-value；`sitemap` / `1` 才推全量 sitemap |
| `BAIDU_PUSH_CHUNK_SIZE` | 分批大小（默认 10） |
| `NEXT_PUBLIC_APP_URL` | 生产建议 `https://steam.bj.cn`；SEO 生产环境强制归一到该主域 |

神马 / 字节跳动验证码已写在根布局（不依赖上述 env）。轮换 Google/百度 meta 时只改 env，无需改代码。

## 品牌与消歧页面

- `/about`：可抓取「STEAMX · 史迪姆是什么」正文 + AboutPage JSON-LD，明确非 Valve Steam。
- 首页已含 WebSite / EducationalOrganization JSON-LD 与 Valve 消歧。

## FAQ / GEO 结构化数据

- `/about` 输出 FAQPage JSON-LD（`buildBrandFaqPageJsonLd`），覆盖：STEAMX/史迪姆是什么、是否 Valve Steam、适合谁（3–16）、提供什么（积木/自然观察/编程/PBL）、官网 `steam.bj.cn`。
- 同页可见「常见问题」含上述品牌问答 + 账号/客服支持问答，便于与结构化数据对齐。
- 首页仍保留 WebSite + EducationalOrganization；AboutPage JSON-LD 在 `/about`。

