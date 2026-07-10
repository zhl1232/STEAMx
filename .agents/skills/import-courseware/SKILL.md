---
name: import-courseware
description: >-
  Turn a local courseware folder (PPT + animation video + build-instruction PDF +
  finished photo) into an online building_3d lesson. Use when importing/converting
  课件, batch-onboarding LEGO/积木 lessons, generating slide images from PPTX, uploading
  course assets to OSS, or building LDraw models for a lesson.
---

# Import Courseware → Online Lesson

把 `C:\Users\Administrator\Documents` 这类课件文件夹批量转成线上 `building_3d` 课时。

核心分工：**确定性资源管线（脚本全自动）+ 教学内容创作（LLM 起草，人审）+ LDraw 建模（最重，半自动）**。不要指望一条命令端到端。

## 前置依赖（一次性）

```bash
sudo apt install -y libreoffice poppler-utils fonts-noto-cjk fonts-wqy-zenhei
```

中文字体必装，否则 LibreOffice 把 PPT 中文渲染成「□」。OSS 上传需 `.env.local` 里的 `ALIYUN_OSS_*` 与 `NEXT_PUBLIC_ASSETS_BASE_URL`。

## 工作流（逐课）

复制此清单跟踪进度：

```
- [ ] 1. 资源管线：import-courseware.mjs 转换+压缩+(可选)上传，产出 content 草稿
- [ ] 2. 教学文案：读 PDF/PPT 起草 steps + steps3d，人审
- [ ] 3. LDraw 模型：按搭建说明建模 + 几何自检 + 打包
- [ ] 4. 入库：幂等 upsert 写 content（迁移只管 schema）
- [ ] 5. 作品墙：为有明确产出的课时启用 `content.workSubmission.enabled`（孩子可直接晒作品）
```

### 步骤 1 — 资源管线（确定性，跑脚本）

```bash
node scripts/import-courseware.mjs "<课件文件夹>" --slug=<slug> \
  --course="<课程标题>" --lesson="<课时标题>" --upload
```

它会：按扩展名+关键词识别 PPT/视频/PDF/成品图 → PPT 转逐页图（或 `--slides-dir` 用现成图；加 `--build-slides-from-source` 会先输出到临时目录，成功后再替换旧 `slide-*`，失败不动旧文件；默认导入时自动切图失败但 `slides/` 已有多张图会沿用现有图继续产出草稿）→ 幻灯片转 WebP（省 ~80%）→ 视频/PDF/成品图归一化到 `public/courses/<slug>/` →（`--upload` 时）推到 `oss:courses/<slug>/` → 产出 `scripts/courseware/<slug>.json` 草稿（含 `slideImageUrls`/`videoUrl`/`videoSlideIndex`/`slidesPdfUrl`/`finishedImageUrl`，其中 `videoSlideIndex` 可直接从 PPTX 关系文件探测）。

常用参数：`--no-webp`、`--quality=82`、`--dpi=150`、`--absolute`、`--build-slides-from-source`、`--dry-run`。
省空间：默认转 WebP、限 150DPI；**不要把 `.pptx` 上线**（脚本本就不传它）；视频只一份。

只补现成图、不转 PPT：`node scripts/normalize-slides.mjs <源目录> <输出目录>`。

### 步骤 2 — 教学文案（LLM 起草，人审）

读 `public/courses/<slug>/instructions.pdf`（或 PPT 图）理解每一步，填进 `scripts/courseware/<slug>.json`：
- `steps[]`：`title` / `description` / `hint` / `checklist`（给孩子/家长看）。
- `content.building3d.steps3d[]`：`title` / `description` / `partIds`(本步显隐零件) / `cameraHint`(front|side|top|isometric)。
- `content.building3d.parts[]`：零件清单 `id`/`name`/`color`/`quantity`。
- 核对 `videoSlideIndex`（动画所在课件页）。
- `content.workSubmission.enabled`：是否允许学员直接向本课发布作品；Scratch / building_3d 等有明确产出的课时默认设为 `true`。

类型定义见 `lib/courses/types.ts` 的 `Building3DLessonContent`。

### 步骤 3 — LDraw 3D 模型（最重，半自动）

把图片转 LDraw 无可靠自动工具，需按搭建说明建模。参考样板 `scripts/ldraw-models/gen-eiffel.mjs`（4 重对称 + 逐层 `topY` 跟踪 + 悬空/穿模几何自检）。

```bash
node scripts/ldraw-models/gen-<slug>.mjs          # 生成 <slug>.ldr（含几何自检）
node scripts/pack-ldraw-model.mjs scripts/ldraw-models/<slug>.ldr <slug>
# → public/courses/ldraw/<slug>.mpd（模型内 0 STEP 驱动分步显隐）
```

模型未就绪时可先留 `steps3d` 为图文步骤、`ldrawModelUrl` 暂缺，工作区会回退占位。

### 步骤 4 — 入库（幂等，别每课一条迁移）

**迁移只管 schema**。内容走 `scripts/courseware/<slug>.json` 的幂等 upsert（按 `slug`/课程标题+课时标题匹配）。改课件、补模型可随时重跑，不受迁移历史束缚。

> 教训：已 `pnpm db:push` 过的迁移不要再改内容——改了不会重跑。要补字段就新建一条 `jsonb_set` 迁移，或走 upsert。

### 步骤 5 — 作品墙（搭完晒作品）

课程作品直接归属课时，不再为每节课创建「背书项目」。有明确产出的课时在 content 根级写入：

```json
{
  "workSubmission": { "enabled": true }
}
```

启用后，学员在工作区点「上传我的作品」，由 `POST /api/courses/[courseId]/lessons/[lessonId]/works` 提交实物照片或 Scratch 成果；公开作品通过课时「作品」Tab、个人主页和探索页作品墙展示，详情统一跳转 `/works/[id]`。

`import-courseware.mjs` 产出的 building_3d 草稿已默认启用 `workSubmission`，不生成项目或数据库迁移。若某课只有阅读、观看或测验而没有可发布产出，人工将 `enabled` 改为 `false`。

> 链接一律站内同标签页跳转，不要 `target=_blank`；组件已做移动端兼容。

## 渲染怎么接 OSS

工作区（`components/features/courses/building-3d-workspace.tsx`）用**裸 URL**消费 `slideImageUrls/videoUrl/ldrawModelUrl`。两条路：
- **A（推荐）**：content 里存绝对 `https://assets.../courses/<slug>/...`（`--upload`/`--absolute` 自动生成）。
- **B**：把 `/courses/` 加进 `lib/utils/asset-url.ts` 白名单并在工作区包 `resolveAssetDisplayUrl`。

批量重传所有课程素材：`node scripts/migrate-public-to-oss.mjs --only=courses`。
LDraw `.mpd` 上 OSS 时记得开 CORS（LDrawLoader 跨域取）。

## 相关脚本

| 脚本 | 作用 |
|---|---|
| `scripts/import-courseware.mjs` | 主管线：分类→切图→WebP→归一化→可选上传→产出 content 草稿 |
| `scripts/export-courseware-slides.mjs` | 批量扫描 `/mnt/c/Users/Administrator/Documents` 的 3+/4+/5+ PPTX，按年级+课题拼音 slug 导出到 `public/courses/<slug>/slides/`；先统计真实页数、成功渲染到临时目录后再替换，支持 `--dry-run`、`--force`、`--only=`、`--upload` |
| `scripts/pptx-to-slides.mjs` | PPT→逐页 PNG（LibreOffice + poppler；探测视频页） |
| `scripts/normalize-slides.mjs` | 现成幻灯片图规范成 `slide-01.png …` |
| `scripts/pack-ldraw-model.mjs` | `.ldr` 抓依赖打包成自托管 `.mpd` |
| `scripts/migrate-public-to-oss.mjs` | 把 `public/courses/` 等批量推 OSS |
