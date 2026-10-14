# SEO / GEO 索引清单

本页统一维护页面身份、品牌验收、站点验证和提交入口。日常频率、故障定位和报表方法见 [SEO 日常运营](seo-daily-operations.md)。核对基线：2026-10-13，`0d322eda40dfdf81c7feb4f37703c9b38bea2b15`；本次不读取搜索后台或重新验证收录。

## 品牌、标题和首页入口

规范主域为 `https://steam.bj.cn`。品牌与搜索常量分别由 `lib/brand.ts`、`lib/seo/site.ts` 维护；旧域归一规则以该版本部署配置和公开响应核验，不以旧站验证替代新主域验证。

当前首页绝对标题为“创探空间｜积木搭建、科学小实验、少儿编程与自然观察”。验收应对照常量、HTML 与对应版本的 `e2e/smoke.spec.ts`，不再硬性要求标题包含旧词“少儿 STEAM”或手机显示旧平台副标题。

| 尺寸 | 首页主视觉验收 |
|---|---|
| 手机 | 短标题“陪孩子，一起动手做”和具体活动介绍；Hero 保留“探索指南”到 `/start`，桌面两枚按钮不显示；免费课程由下方积木推荐卡到 `/courses` 承接 |
| 桌面 | 完整主标题、到 `/courses` 的免费课程按钮、到 `/explore` 的项目按钮和到 `/start` 的探索指南 |

页面保持一个 H1，响应式展示不制造两个不同页面身份。免费描述指课程内容，不保证材料免费或任意套装齐全。README 和运营文档不再复制按钮清单或另一份标题要求。

## 发现与结构化数据

核对 `/robots.txt`、`/sitemap.xml`、`/llms.txt`，首页 canonical 与 og:url 使用带尾斜杠的规范首页 URL。公开页面和允许的公开图片可抓取；不要整体放开私有 API、管理、登录或视频签名访问。

首页 JSON-LD 的组织与网站图谱共用真实品牌和 `/logo.png`，WebSite 指向组织；关于页的 AboutPage/FAQ 必须与可见正文一致。官网账号和 `sameAs` 仅填已取得且可公开访问的真实主页，不拿二维码、假链接或计划账号占位。

`/learn/blocks`、`/learn/scratch`、`/learn/science` 为公开专题，课程入口提供普通链接并进入 sitemap / llms.txt。资源、年龄、材料和更新时间来自真实内容，不能为 SEO 造课或补造资质。llms.txt 是辅助目录，不是收录、排名或 AI 引用承诺。

## 验证文件与配置

Google、百度、Bing 等各自验证新主域并记录结果，不能互相替代。验证码文件按平台原名原文保留，不手写内容；没有代码引用也不是可删证据。现存百度、微信和 Yandex 验证文件同样按此保护。

| 配置 | 用途 |
|---|---|
| `GOOGLE_SITE_VERIFICATION` | Google meta 验证；也可按平台使用 DNS/网域验证 |
| `BAIDU_SITE_VERIFICATION` | 百度 meta，真实文件验证可替代 |
| `BING_SITE_VERIFICATION` | Bing meta，未配置不输出占位值 |
| `NEXT_PUBLIC_APP_URL` | 配合实际站点与 SEO 归一实现核对 |

神马/字节及其他已存在验证实现从 `lib/seo/site-verification.ts` 和根布局核对。配置轮换需确认最终输出及部署方式，不把修改环境变量等同已重新验证成功。

## 主动提交的范围

默认高价值入口为首页、about、courses、explore、nature、nature/birds、nature/insects、nature/plants、playground。三个 learn 专题需逐页核验与提交，不宣称已自动加入上述默认列表。其余详情通过完整 sitemap 被发现；提交不等于收录。

百度参数：`BAIDU_PUSH_TOKEN` 为秘密，`BAIDU_PUSH_SITE` 对应规范主域，`BAIDU_PUSH_CHUNK_SIZE` 默认 10；默认 high-value，显式 `BAIDU_PUSH_MODE=sitemap` 或 `BAIDU_PUSH_ALL=1` 才扩大到全量。无 token 时安全跳过，余量耗尽停止，分批不能超剩余额。

主动推送是外部写操作，须在授权范围内运行 `package.json` 中的 `seo:baidu-push`；公开 GET 检查不授予全量提交权限。Release 只在对应检查成功后按其配置推送。

## 内容、分页和图片回归

项目、课程、课时按真实版本核对 title、description、canonical、noindex、正文和结构化数据。禁用 JavaScript 时仍能阅读课时步骤/提示和进入零件清单；HowTo 只描述实际支持的实践，不给准备/观看内容伪造操作。

后续分页有独立 canonical、普通链接和服务端内容；只有查询成功但页码越界时返回 404，数据库故障不能伪装空列表或物种不存在。搜索/筛选组合按既有 noindex 契约处理。

分享图片和 JSON-LD image 必须公开可访问；迁移资源使用正确公共图片路径。公开图片放行不扩大私有 API 或视频权限；创建时间不冒充独立发布时间。

## 检查结果怎么使用

自动脚本是有限抽样，不是全站爬取或生产业务验收。执行方式、错误处理、平台分别记录及实际排名/索引判断统一见 [日常运营](seo-daily-operations.md)。本页不记录滚动“今日收录量”或把仓库中存在的文件当成平台验证已成功。
