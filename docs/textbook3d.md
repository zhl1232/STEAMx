# 3D 物理课本接入说明

## 站内入口
- `/textbook`：课本目录（按册、章列出）。入口只放在游乐场：侧栏和游乐场手机顶栏的「3D 物理课本」。sitemap 已收录。
- `/textbook/<课号>`：单节页面，`p1a-1-1`「我们知道的植物」与 `p1a-1-2`「观察植物」使用站内原生立体书；范围统一由 `lib/textbook3d/native/native-lessons.ts` 判断，其余课程用同源 iframe 嵌入 `/textbook3d/v1/<课号>/index.html?embed=1`。原生课各以前置本课目录进入两个正文页，旧课保留原有课内结构。上一节/下一节按登记表跳转；旧课手机页面仍为全站底部导航预留高度，原生课使用下述阅读外壳。
- 嵌入区提供具有可访问名称的「全屏阅读 / 退出全屏」操作。页面内全屏始终可用，原生 Fullscreen API 作为增强；全屏保留原 iframe 或原生 canvas 及当前阅读位置，使用动态视口及四边安全区，课本外的内容暂时不可聚焦。退出按钮、Escape（含同源子页）、浏览器退出原生全屏、切课或卸载都会清理会话并恢复滚动。项目页的手机/桌面两套 DOM 在 `md` 断点切换；当前课本被祖先布局隐藏时自动退出，恢复原来的滚动和 inert 状态，并把焦点移出隐藏分支。一个页面最多一个沉浸会话，隐藏实例向可见实例交接时先同步释放锁，避免叠加恢复快照。旧 iframe 的课内布局仍由源工程负责；原生课按 [实现与验收标准](textbook3d-implementation.md) 适配。外层全屏本身不证明内部控件已通过手机验收。
- 旧 iframe 加载 20 秒仍未收到有效 ready/progress 时显示重试入口；仅 height 消息不视为课本就绪。同源子页的 `nogl` 状态和 canvas 的 WebGL context lost 也会显示可重试的错误提示。
- 课程课时：课时类型 `textbook_3d`，`content.textbook3d.lessonId` 填课号（见下文）。
- 项目页：`projects.interactive_url` 填 `/textbook3d/v1/<课号>/`（见下文，需要先跑迁移）。

当前目录按学段递增：教科版小学科学一年级上册至六年级下册（教育科学出版社），随后为人教版初中物理八年级上下册、九年级全一册（人民教育出版社）。`lib/textbook3d/registry.ts` 的 `TEXTBOOK3D_VOLUMES` 统一维护册次、学科、出版社与版本，`TEXTBOOK3D_CHAPTERS` 按册次生成，目录与前后节导航共用此顺序。课号保持稳定，不因展示排序变化而改名。

目录默认打开一年级上册，通过 `?volume=<册号>` 选择教材（如 `p6b`、`g9`）；未知册号回退到第一册。选书区按“小学科学 · 教科版”和“初中物理 · 人教版”分组，每个入口显示完整册名（如“一年级上册”），桌面与手机均以双列对齐同年级上下册，选中册次高亮。每次展示所选教材的完整单元与课目，课时返回目录时保留册次。出版社版本同时显示在目录和课时页。课时使用共享运行时、字体及场景模块，旧共享文件默认保留以兼容缓存中的课时 HTML。

## 教材目录依据

- 册次与出版社范围依据[教育部国家课程教学用书目录](https://www.moe.gov.cn/srcsite/A26/s8001/202408/W020240805496325238752.pdf)。
- 现有课目沿用新版内容，不以旧版目录重排或替换；人教物理的章级顺序与[出版社 2024 新教材介绍](https://www.pep.com.cn/xw/zt/hd/12/xjcjs/cz/202409/t20240925_1995627.html)中的 22 章框架一致。
- 教科科学新版依据见[出版社新教材专题](https://www.esph.com.cn/zttj/4e753e04a6ba475396c138ff61e3ec9e.htm)。小学各册和物理各节的新版完整目录页尚未逐项取得核验，不将当前登记表描述为出版社完整目录的已核验副本；后续修正须以对应新版目录页为依据，同时核对关联静态课时内容，不能仅改显示名称。

## 文件放哪里

目录与独立课时页共用全站 `app-shell-wide`，最大宽度和边距由[设计规范](design-system.md#布局-shell)维护；目录按屏宽调整列数。旧课手机课时仍保留全宽 iframe，标题与前后节导航独立留边。原生阅读页按 `native-lessons.ts` 的精确路由范围，在手机窄屏或低矮横屏时隐藏站点页头、页脚与底栏，目录返回与阅读工具浮在边角，不占书本高度；离开该路由自动恢复，不修改全局 body 状态。

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
旧课场景、交互提示与内页布局需要原源工程，再构建同步。主站仓库中的 `public/textbook3d/v1` 是构建产物；缺少下述原目录时不直接手改带哈希的 JS。原生课的新源码和流程见下一节，共用交互和验收契约见 [原生课本实现标准](textbook3d-implementation.md)；不能把重建源码描述为恢复了旧工程。

1. 在课本源码目录（`/workspace/3d-textbook/textbook`）构建：`python3 tools/build_split.py <要发布的全部课号…>`，产物在 `dist-split/`。共享 chunk 由全部入口一起拆出，所以每次要带上全部要发布的课号，不要只构建一节。（旧的 `tools/build.py` 仍然输出内联单文件，只用于课本源码目录本地预览。）
2. 在 `lib/textbook3d/registry.ts` 对应章节追加 `{ id: "<课号>", title: "<节标题>" }`。
3. 同步：`node scripts/textbook3d/sync.mjs <dist-split 目录>`。脚本会检查：课号已登记；构建基址等于 `TEXTBOOK3D_SHARED_BASE`；共享文件名带哈希且每个不超过 1.5MB；课时 HTML 不超过 64KB（防止误放旧的内联包）、入口脚本不超过 200KB；HTML 引用的每个共享文件都存在。
4. 旧的共享文件默认保留，因为一天内缓存的旧 HTML 还会引用它们。确认上线一周以上后可以加 `--prune` 删掉没人引用的旧文件。
5. `pnpm vitest run lib/textbook3d` 确认每课的 HTML、入口脚本和它引用的 chunk 都在。

嵌入协议不兼容时才升到 `v2` 目录，旧版本不覆盖。

## 原生立体课本

当前原生范围为 `p1a-1-1`「我们知道的植物」和 `p1a-1-2`「观察植物」，共用同一个站内阅读器和渲染生命周期。每课前置本课目录，再进入两个正文页；目录不增加课时，也不作为学习完成条件。书角翻页、同帧贴页、静态选中环、部位标签、底边收折、完整 A/B 背景乐以及资源和手机验收，统一由 [原生课本实现标准](textbook3d-implementation.md) 维护。

**范围与来源**：原课本工程未在当前仓库及可访问历史中找到。这两课依据已交付静态包的文字与学习目标和用户反馈重新实现，不是原源码恢复。第一课来源为主站 `72c9a909` 中 `public/textbook3d/v1/shared/p1a-1-1-FQNKSPUC.js`；第二课来源为现有 `public/textbook3d/v1/shared/p1a-1-2-RYG7ZYTU.js`。第二课保留“看、摸、比”、叶/茎/花观察、观察记录表及绘画任务，明确屏幕不能验证真实触感。模型是观察示例，不把其颜色或形状泛化为全部植物。

保留原静态包和合册，原生阅读器通过“更多阅读选项 → 使用旧版”回退。旧版与原生选择由 `textbook-frame.tsx` 统一分流；不能仅因一课迁移而删除共享产物、其他课有教学意义的演示，或将原生范围扩大到整册。

**可维护入口**：

| 入口 | 职责 |
| --- | --- |
| `lib/textbook3d/native/native-lessons.ts` | 原生课号与精确路由判断，供页面外壳和阅读器分流复用 |
| `components/features/textbook3d/textbook-frame.tsx` | 原生界面动态导入、旧 iframe 分流与回退 |
| `components/features/textbook3d/native/plant-lesson.tsx`、`plant-canvas.tsx` | 本课目录、两正文、观察选择、记录、加载与重试，切页保留同一画布 |
| `lib/textbook3d/native/plants.ts`、`observation-plants.ts` | 两课观察内容、第二课目标/方法/记录结构和像素预算入口 |
| `lib/textbook3d/native/plant-models.ts`、`observation-models.ts` | 第一课树/草/花、第二课叶/茎/花的程序几何及资源所有权 |
| `lib/textbook3d/native/book-model.ts`、`book-garden.ts`、`popup-rig.ts`、`book-motion.ts` | 实体书、纸面锚点、局部收纸与底边铰链、有限翻页时间线 |
| `lib/textbook3d/native/book-page-layout.ts`、`plant-stage.ts`、`demand-renderer.ts` | 课文/控件/书角的同帧投影，场景拾取、按需绘制、降级与生命周期 |
| `lib/textbook3d/native/tree-parts.ts` | 部位标签的局部锚点与模型侧避让；各课标签按模型数据扩展 |
| `lib/textbook3d/native/book-music.ts`、`book-audio.ts` | 原创乐谱与合成、有限前瞻调度、纸声/叶声及独占音频会话 |
| `components/features/textbook3d/use-textbook-immersive.ts` | 新旧阅读器共用全屏、互斥会话和退出清理 |
| `components/layout/textbook-reader.module.css`、`conditional-app-shell.tsx` | 原生课精确路由范围内的手机阅读外壳、站点导航收起和退出恢复 |

原生课直接由当前仓库的 Next.js 构建。本地 `pnpm dev` 打开 `/textbook/p1a-1-1` 或 `/textbook/p1a-1-2`，应用构建入口仍为 `pnpm build`，不使用旧 `build_split.py` 或额外静态同步。新增原生课先补教学映射与课程数据，再接入共用书体、交互和清理契约；只修改登记表不等于完成原生迁移。

测试入口、资源预算、真实浏览器测量与当前未验收项见 [实现标准的验收部分](textbook3d-implementation.md#触摸降级与验收)。CPU 几何样板、模拟 DOM 与音频单元测试都不能替代真实 WebGL、手机触控和实际试听；交付保持源码与可用开发预览，不默认生成 ZIP。

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
- 两课原生阅读器均通过用户主动点击「记录本次探索」调用现有完成回调；它记录参与，不评估知识目标，目录跳转、选择示例和答题都不自动触发。第一课旧版完成事件仍只表示点击过三类植物，其外层状态使用「已探索」，不表示验证了“说出五种植物”；旧版课内盖章语义仍是遗留限制。

## 项目页 `projects.interactive_url`
- 迁移 `supabase/migrations/20261026120000_project_interactive_url.sql`：给 `projects` 加一个可空的 `interactive_url text` 列，加格式约束（只能是 NULL 或 `/textbook3d/v<n>/<课号>/` 形式的同源路径）。不改任何现有行，所有项目默认 NULL，页面不变。已加入 `.github/workflows/release.yml` 的 `MIGRATION_ALLOWLIST`，合并后下一次发布会执行；在生产库执行需要单独确认。
- 迁移执行前代码也能运行：项目详情用 `select *` 读取，没有这一列时 `textbook3dLessonId` 就是 undefined，不显示课本。
- 设置后，项目详情页在「制作步骤」前显示「3D 课本」卡片（电脑和手机都有）。项目页不自动记项目完成，只显示课本里的进度。

## 限制
- 同一时刻只让可见课本持有活动渲染与音频会话，避免多实例争用手机资源。项目页因断点保留两套 DOM 时，隐藏实例必须停止工作并遵守沉浸交接与清理契约，不能同时保活两套 WebGL。

## 旧静态课 UX v2（音效 / 合册 / 翻页 / 3D 交互样板）

本节仅说明旧静态运行时；其自动解锁、静音存储和翻页规则不覆盖原生课本标准。
- 共享运行时已含 Web Audio 合成音效（`sfx`）：翻页、按钮、滑块、翻卡、对错、盖章；实验/运动主题音；右上角静音（localStorage）；首次点击解锁；`?embed=1` 可用。
- 翻页：盖章不再自动跳页；仅左右箭头 / 合册书角可翻页。合册模式 `?book=1`：课末/课首向父页发 `prev-lesson`/`next-lesson`，并接受 `steamx-textbook-jump`。
- 3D 交互样板：`g8b-11-4`（拖小球上坡 + 点摩擦垫）、`p4b-2-2`（拖导线接灯泡）。逻辑在课本源码 `core/interact.js`，经场景 import 打进共享 chunk。
- 合册：`public/textbook3d/v1/book-{p1a…p6b,g8a,g8b,g9}.html` 与课目录同级（iframe 相对路径 `课号/index.html?book=1`）；目录、单元分隔、只保活 cur±1。源码 `tools/book.py` → `dist/book-*.html`。
- 课本源码目录：`/workspace/3d-textbook/textbook`（`core/`、`lessons/`、`tools/build_split.py`、`tools/book.py`）。
