# 3D 物理课本接入说明

## 站内入口
- `/textbook`：课本目录（按册、章列出）。玩乐场侧栏和手机顶部导航都有「3D 物理课本」入口，sitemap 已收录。
- `/textbook/<课号>`：单节页面，用同源 iframe 嵌入 `/textbook3d/v1/<课号>/index.html?embed=1`，底部有上一节/下一节。

## 文件放哪里
- 静态包：`public/textbook3d/v1/<课号>/index.html`，每课一个单文件（Three.js、模板、字体子集都内联，约 1.4MB，gzip 后传输更小）。
- 登记表：`lib/textbook3d/registry.ts`，页面、sitemap、测试都只读这里，不接受外部 URL。
- 缓存：`next.config.mjs` 给 `/textbook3d/:path*` 设一天缓存 + 一周后台再验证，允许原地修正内容。

为什么先放 `public/` 而不放 OSS：同源 iframe 才能直接用 postMessage 校验 origin，不用配 CORS、防盗链和签名；也不新增 OSS 费用和发布步骤。代价是仓库和镜像各多约 21MB。课数到几十节、或单课超过 2.5MB 时，按课本源码 embed-plan 的第二阶段拆出共享运行时（`runtime.[hash].js` + 字体），每课只剩几十 KB；运行时和字体再考虑挪到 OSS/CDN。

## 加一节新课（增量）
1. 在课本源码目录构建：`python3 tools/build.py <课号>`，产物在 `dist/<课号>/index.html`。
2. 在 `lib/textbook3d/registry.ts` 对应章节追加 `{ id: "<课号>", title: "<节标题>" }`；新章节就追加一个章对象。
3. 复制静态包：`node scripts/textbook3d/sync.mjs <dist 目录> <课号>`（不带课号则同步登记表全部课）。脚本会检查：课号已登记、文件存在、含嵌入协议、不超过 2.5MB。
4. `pnpm vitest run lib/textbook3d` 确认每个登记课都有静态包。

修正已上线的课：重新构建后再跑第 3 步覆盖即可（缓存最多一天后更新）。嵌入协议不兼容时才升到 `v2` 目录，旧版本不覆盖。

## 嵌入协议（version: 1）
子页 → 父页（`targetOrigin = location.origin`）：
- `steamx-textbook-ready` `{lesson}`
- `steamx-textbook-height` `{lesson, height}`：父页限制在 420–1400px
- `steamx-textbook-progress` `{lesson, page, pages, predicted, flapOpen, challengeDone}`
- `steamx-textbook-complete` `{lesson}`

父页 → 子页：`steamx-textbook-height-request`、`steamx-textbook-goto {page}`。双方都校验 origin 和 source；父页还校验 `lesson` 与当前课一致。组件：`components/features/textbook3d/textbook-frame.tsx`（`onComplete` 回调已留好）。

## 暂未做（需要再拍板）
- 项目页 `project.interactive_url`、课程课时类型 `textbook_3d` + 完成记录：都需要数据库迁移和正式数据，本次没做。接入时直接复用 `TextbookFrame` 的 `onComplete`。
- 同一页面只放一个 3D 课本（iOS Safari 的 WebGL 内存有限）。
