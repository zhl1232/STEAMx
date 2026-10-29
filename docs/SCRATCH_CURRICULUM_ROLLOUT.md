# 原创 Scratch 课程维护与验收

本课程面向 7–10 岁初学者，六阶段共 48 节，每节附起始作品、参考作品和积木图示。D 盘旧课件只作主题参考；正式内容和作品均在本仓库重新编写、生成。旧 Scratch 课程有历史学习记录，发布新课时仅从发现入口隐藏，不能删除旧课程或进度。

## 当前状态与待验收

2026-10-12 文档核对基于 `main@f4eb9e8caee04d79997d9ed4f9401f3f8dcf2510`，本次未进行生产或真实学员账号验收。最近的生产记录（2026-09-23）为新课 #8 已审核上架、48 节公开，旧课 #1 保留历史直达；2026-10-04 增加旧课新版入口。以下历史段落中的“尚未导入”等表述仅代表当时阶段。

**仍待验收：真实学员账号的保存、退出后续学、旧课进度与作品访问。** 匿名页面、模拟登录和文件加载检查不能关闭此项；任务见 [下一步](next-step.md)。旧课程和学习记录继续保留，不能因新课发布删除。

## 本地验收

1. 运行 `node scripts/generate-scratch-curriculum-projects.mjs`，再运行 `node scripts/scratch-curriculum/import.mjs`。导入器默认只读，核对 48 节顺序、96 个 SB3、图示、必需积木及起始/参考差异。
2. 运行 `node scripts/scratch-curriculum/verify-vm.mjs`，用 Scratch VM 对 96 个 SB3 做加载与绿旗烟测；再在浏览器逐节核对步骤文字、所需角色和积木、默认参数与图示一致。重点人工验收消息、变量、列表、克隆、画笔、自定义积木及综合作品的实际效果；无渲染器的 VM 烟测不能代替这一步。
3. 运行 `pnpm build:scratch`、`pnpm type-check`、目标 Vitest、`pnpm lint`、`pnpm build`；在浏览器检查桌面与手机的课程阶段目录、课时侧栏、参考预览、起始作品加载、保存与续学。确认旧课程直达和历史作品仍可打开。

## 生产变更顺序

下列步骤会修改远端应用或数据库，需完成上述本地验收、确认目标环境和明确发布授权后执行。

1. 先检查目标数据库的待应用迁移清单，按 [数据库连接与迁移](database-psql.md) 用 `pnpm db:push` 应用 `20260923170000_course_catalog_visibility.sql`。应用代码依赖 `is_listed` 列，不能先部署新应用。2026-09-23 已在目标 Supabase host `spb-bp1n04y14st4y299.supabase.opentrust.net` 应用并确认无待执行迁移。
2. 部署包含 `public/courses/scratch-original/v1/` 的应用版本，检查 `GET /api/assets/courses/scratch-original/v1/s01-l01/starter.sb3` 和图示返回正确 MIME、可在编辑器打开。
3. 执行 `node scripts/scratch-curriculum/import.mjs --apply --expect-host=<目标 Supabase host>`，只导入未上架草稿。人工核对 48 节、年龄 7–10、成人支持 `guided`，并把 `classification_status` 审核为 `reviewed`。草稿始终不可见。
4. 用 `node scripts/scratch-curriculum/publish.mjs --expect-host=<目标 Supabase host> --legacy-id=<旧课 ID>` 做只读预览；确认课程 ID、历史课程 ID 和课时数后加 `--apply` 发布。该脚本调用迁移中的事务函数，原子地将新课设为 `approved`/`is_listed=true`，并将旧课设为 `is_listed=false`。
5. 回读新旧课程状态和课时数，实际访问 `/courses`、新课第一节、旧课历史链接、学习进度、项目保存与参考预览。若新课需撤回，先设新课 `is_listed=false`，再恢复旧课 `is_listed=true`；不要删除任一课程。

各命令模式的副作用及限定只读预检统一见 [数据库连接与迁移](database-psql.md#命令模式与副作用)。生产发布前需确认目标 host 和完整待执行迁移范围，不因命令包含 `dry-run` 就认定无写入。

## 历史发布与验收记录

### 2026-09-23 本地阶段

2026-09-23 本地记录：48 节和 96 个 SB3 通过只读导入校验，96 个项目通过 VM 运行检查；48 个参考项目均在带渲染器的 Scratch 浏览器中加载并可点击绿旗，未出现页面脚本错误。另验证了停车线颜色碰撞、星光收集达 5 分、雨水收集达 8 滴及数据画画出四根柱条。TypeScript、21 项定向测试、lint 和 `next build --webpack` 通过。新课程尚未导入远端，课程详情、保存续学与手机布局的端到端检查须在未上架草稿环境继续完成。

### 2026-09-23 生产上线

2026-09-23 已部署课程资源并导入课程 #8「Scratch 创探编程：从动画到作品」，按用户授权以系统管理员主体经审核 RPC 记录 7–10 岁、`guided`、难度 2 的复核结论，审核说明注明代理执行与安全关键词误报。48 节课时及 145 个线上课程资源均已核对。首次上架后的浏览器回归发现 Scratch iframe 首屏指向 `localhost`，随即撤回新课列表入口并恢复旧课；提交 `a8c18e6a` 改为同源相对地址，部署后在线验证首课编辑器、起始作品和参考作品均收到 `PROJECT_LOADED: ok`，无页面脚本错误，之后重新上架。

最终状态：新课程 #8 为 `approved`、`is_listed=true`，旧课程 #1 保持 `approved`、`is_listed=false`，历史链接仍返回 200。公开 API 返回新课 48 节；桌面首课编辑器、参考预览与手机课程列表/详情/课时页已做浏览器回归。登录后的保存和续学仍需用真实学员账号验收，不能由匿名浏览器检查代替。

## 当前旧课访问与替代入口（2026-10-04 起）

- `lib/courses/successors.ts` 的 `COURSE_SUCCESSORS`（`{ 1: 8 }`）声明替代关系，不改数据库。旧课显式目录 `/courses?course=1` 与课时页通过 `getCourseSuccessor()` 读取新课标题（与课程目录相同的 `approved` + `is_listed=true` 过滤），在页面顶部显示「本课程已更新，前往新版课程：<新课标题>」；新课不存在或未上架时不显示。
- 未上架课程及其课时页输出 `noindex, follow`（`buildPageMetadata({ noIndex, noIndexFollow })`），既不进入搜索结果，也让爬虫沿入口发现新课；课程不存在等情况仍为 `noindex, nofollow`。sitemap 与普通 `/courses` 列表继续只收录已上架课程。旧课显式目录与课时保持可访问，不做 301，学习记录不变；课程中间页 `/courses/1` 与其他 `/courses/[courseId]` 一并退役并返回 404，不再作为旧课入口。

