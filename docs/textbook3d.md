# 3D 物理课本接入说明

## 站内入口
- `/textbook`：课本目录（按册、章列出）。入口只放在游乐场：侧栏和游乐场手机顶栏的「3D 物理课本」。sitemap 已收录。
- `/textbook/<课号>`：单节页面，用同源 iframe 嵌入 `/textbook3d/v1/<课号>/index.html?embed=1`，底部有上一节/下一节。手机上页面底部留出全站底部导航的高度，避免盖住课本。
- 课程课时：课时类型 `textbook_3d`，`content.textbook3d.lessonId` 填课号（见下文）。
- 项目页：`projects.interactive_url` 填 `/textbook3d/v1/<课号>/`（见下文，需要先跑迁移）。

当前目录按学段递增：教科版小学科学一年级上册至六年级下册（教育科学出版社），随后为人教版初中物理八年级上下册、九年级全一册（人民教育出版社）。`lib/textbook3d/registry.ts` 的 `TEXTBOOK3D_VOLUMES` 统一维护册次、学科、出版社与版本，`TEXTBOOK3D_CHAPTERS` 按册次生成，目录与前后节导航共用此顺序。课号保持稳定，不因展示排序变化而改名。

目录默认打开一年级上册，通过 `?volume=<册号>` 选择教材（如 `p6b`、`g9`）；未知册号回退到第一册。选书区按“小学科学 · 教科版”和“初中物理 · 人教版”分组，每个入口显示完整册名（如“一年级上册”），桌面与手机均以双列对齐同年级上下册，选中册次高亮。每次展示所选教材的完整单元与课目，课时返回目录时保留册次。出版社版本同时显示在目录和课时页。课时使用共享运行时、字体及场景模块，旧共享文件默认保留以兼容缓存中的课时 HTML。

## 教材目录依据

- 册次与出版社范围依据[教育部国家课程教学用书目录](https://www.moe.gov.cn/srcsite/A26/s8001/202408/W020240805496325238752.pdf)。
- 现有课目沿用新版内容，不以旧版目录重排或替换；人教物理的章级顺序与[出版社 2024 新教材介绍](https://www.pep.com.cn/xw/zt/hd/12/xjcjs/cz/202409/t20240925_1995627.html)中的 22 章框架一致。
- 教科科学新版依据见[出版社新教材专题](https://www.esph.com.cn/zttj/4e753e04a6ba475396c138ff61e3ec9e.htm)。小学各册和物理各节的新版完整目录页尚未逐项取得核验，不将当前登记表描述为出版社完整目录的已核验副本；后续修正须以对应新版目录页为依据，同时核对关联静态课时内容，不能仅改显示名称。

## 文件放哪里

目录与独立课时页共用全站 `app-shell-wide`，最大宽度和边距由[设计规范](design-system.md#布局-shell)维护；目录按屏宽调整列数。手机课时仍保留全宽 iframe，标题与前后节导航独立留边，不将桌面内边距叠加到小屏嵌入区。

```
public/textbook3d/v1/
  <课号>/index.html                 每课约 10KB：外壳 + 对共享文件的引用
  shared/<课号>-<哈希>.js            每课自己的场景和文字，5–10KB
  shared/chunk-<哈希>.js            共享运行时：Three.js + 课本模板（engine/kit），约 745KB
  shared/serif-r|serif-b|wk-<哈希>.woff2  全部课合并的一份字体子集，约 1.1MB
```
- 基址只有一个配置：`lib/textbook3d/registry.ts` 的 `TEXTBOOK3D_SHARED_BASE`（现为 `/textbook3d/v1/shared/`，同源，不用 OSS）。构建时用同一个值设环境变量 `TEXTBOOK3D_ASSET_BASE`，写进每课 HTML；`sync.mjs` 会核对两者一致。以后挪到 OSS/CDN 时改这两处、重建、同步即可；跨域时 CDN 要对字体和 JS 模块开 CORS。
- 缓存（`next.config.mjs`）：
  - 课时 HTML `/textbook3d/:path*`：一天 + 一周后台再验证，允许原地修正。
  - 共享文件 `/textbook3d/:version/shared/:path*`：`max-age=31536000, immutable`。文件名带内容哈希，内容变了文件名就变，所以可以永久缓存。
- 登记表 `lib/textbook3d/registry.ts`：页面、sitemap、课时、项目、测试都只认这里登记的课号，不接受外部 URL。

拆共享文件后，Three.js、课本模板和字体可以跨课缓存；打开后续课时只需下载该课的 HTML、场景和文字。实际资源大小以当前构建产物为准。

## 加一节新课 / 修正已有课
1. 在课本源码目录（`/workspace/3d-textbook/textbook`）构建：`python3 tools/build_split.py <要发布的全部课号…>`，产物在 `dist-split/`。共享 chunk 由全部入口一起拆出，所以每次要带上全部要发布的课号，不要只构建一节。（旧的 `tools/build.py` 仍然输出内联单文件，只用于课本源码目录本地预览。）
2. 在 `lib/textbook3d/registry.ts` 对应章节追加 `{ id: "<课号>", title: "<节标题>" }`。
3. 同步：`node scripts/textbook3d/sync.mjs <dist-split 目录>`。脚本会检查：课号已登记；构建基址等于 `TEXTBOOK3D_SHARED_BASE`；共享文件名带哈希且每个不超过 1.5MB；课时 HTML 不超过 64KB（防止误放旧的内联包）、入口脚本不超过 200KB；HTML 引用的每个共享文件都存在。
4. 旧的共享文件默认保留，因为一天内缓存的旧 HTML 还会引用它们。确认上线一周以上后可以加 `--prune` 删掉没人引用的旧文件。
5. `pnpm vitest run lib/textbook3d` 确认每课的 HTML、入口脚本和它引用的 chunk 都在。

嵌入协议不兼容时才升到 `v2` 目录，旧版本不覆盖。

## 嵌入协议（version: 1）
子页 → 父页（`targetOrigin = location.origin`）：
- `steamx-textbook-ready` `{lesson}`
- `steamx-textbook-height` `{lesson, height}`：父页限制在 420–1400px
- `steamx-textbook-progress` `{lesson, page, pages, predicted, flapOpen, challengeDone}`
- `steamx-textbook-complete` `{lesson}`

父页 → 子页：`steamx-textbook-height-request`、`steamx-textbook-goto {page}`。双方都校验 origin 和 source；父页还校验 `lesson` 与当前课一致。组件：`components/features/textbook3d/textbook-frame.tsx`。

## 课程课时 `textbook_3d`
- 不需要迁移：`course_lessons.lesson_type` 只有格式约束，`textbook_3d` 已在 `lib/courses/lesson-types.ts` 登记，工作区为 `textbook`。
- 课时 `content` 写 `{"textbook3d": {"lessonId": "g8a-3-1"}}`。课号没登记时页面显示「还没有配置」，不会嵌入任意地址。
- 学生在课本里完成课末挑战（`steamx-textbook-complete`）时，`TextbookLessonWorkspace` 调用现有的 `POST /api/courses/<课程>/lessons/<课时>/complete` 记完成；未登录时弹登录框，不记录。

## 项目页 `projects.interactive_url`
- 迁移 `supabase/migrations/20261026120000_project_interactive_url.sql`：给 `projects` 加一个可空的 `interactive_url text` 列，加格式约束（只能是 NULL 或 `/textbook3d/v<n>/<课号>/` 形式的同源路径）。不改任何现有行，所有项目默认 NULL，页面不变。已加入 `.github/workflows/release.yml` 的 `MIGRATION_ALLOWLIST`，合并后下一次发布会执行；在生产库执行需要单独确认。
- 迁移执行前代码也能运行：项目详情用 `select *` 读取，没有这一列时 `textbook3dLessonId` 就是 undefined，不显示课本。
- 设置后，项目详情页在「制作步骤」前显示「3D 课本」卡片（电脑和手机都有）。项目页不自动记项目完成，只显示课本里的进度。

## 限制
- 同一页面只放一个 3D 课本（iOS Safari 的 WebGL 内存有限）。

## UX v2（音效 / 合册 / 翻页 / 3D 交互样板）
- 共享运行时已含 Web Audio 合成音效（`sfx`）：翻页、按钮、滑块、翻卡、对错、盖章；实验/运动主题音；右上角静音（localStorage）；首次点击解锁；`?embed=1` 可用。
- 翻页：盖章不再自动跳页；仅左右箭头 / 合册书角可翻页。合册模式 `?book=1`：课末/课首向父页发 `prev-lesson`/`next-lesson`，并接受 `steamx-textbook-jump`。
- 3D 交互样板：`g8b-11-4`（拖小球上坡 + 点摩擦垫）、`p4b-2-2`（拖导线接灯泡）。逻辑在课本源码 `core/interact.js`，经场景 import 打进共享 chunk。
- 合册：`public/textbook3d/v1/book-{p1a…p6b,g8a,g8b,g9}.html` 与课目录同级（iframe 相对路径 `课号/index.html?book=1`）；目录、单元分隔、只保活 cur±1。源码 `tools/book.py` → `dist/book-*.html`。
- 课本源码目录：`/workspace/3d-textbook/textbook`（`core/`、`lessons/`、`tools/build_split.py`、`tools/book.py`）。
