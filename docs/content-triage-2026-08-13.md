# 2026-08-13 内容分诊：硬删除项目清单

站长（zhl1232）审过线上目录后，决定把一批不适合「孩子 + 家长、以后再做直播课」定位的 STEAMx 项目**永久删除**（不是下架 / 不是改 `status`）。相关行和项目自己的 OSS 图一并清掉。代码留痕见：

- 权威 ID 列表：`scripts/lib/content-triage-2026-08-13.mjs`
- 库表硬删除：`supabase/migrations/20260813090000_hard_delete_triaged_projects.sql`（`pnpm db:push`，不要 `supabase db push`）
- OSS 对象清理：`node scripts/purge-triaged-project-assets.mjs`（默认 dry-run；`--execute` 才删）

## 保留（不要再删、不要当重复项清掉）

合并胜出 / 仍待处理、仍然上线：

`52, 73, 119, 120, 177, 352`

以及**删除名单以外**的所有已审核项目。

## 删除（105 个，禁止重新 seed）

`30, 34, 35, 37, 49, 80, 100, 103, 123, 130, 131, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 161, 162, 163, 164, 165, 167, 168, 181, 182, 185, 186, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 206, 207, 221, 230, 234, 236, 238, 239, 241, 242, 244, 248, 252, 265, 275, 282, 287, 304, 305, 306, 324, 325, 327, 329, 330, 344, 347, 367, 368, 370, 371, 372, 377, 382, 384, 391, 393, 394, 396, 397, 398, 399, 403, 404, 405, 406, 408, 409, 410, 424, 457, 461`

后续迁移、课件导入、PBL seed、自动生成封面脚本都不要再插入这些 `projects.id`。若必须引用同类主题，新建项目并拿新 ID。

线上操作顺序：先部署应用（数学分类兜底封面已从已删的 `project-0393` 改到保留项目 `352`），再跑 OSS 脚本（库行还在才能收集 key），最后 `pnpm db:push`。编排脚本：`node scripts/apply-content-triage-2026-08-13.mjs`（默认 dry-run；`--execute` 才真正删除）。生产由 `.github/workflows/apply-content-triage-2026-08-13.yml` 在服务器上用 `.env.production` 执行。

## OSS 范围

只删该项目自己的目录上传（`projects/generated/`、`projects/steps/`）。不要删：

- `/projects/default-cover.webp` 以及分类共用封面（如 `science_physics.webp`）
- 课件 / Scratch / 物种图（`courses/`、`scratch/`、`birds/`、`insects/`、`trees/`、`fruits/`）
- Supabase Storage 用户上传（脚本只走 Aliyun OSS）
