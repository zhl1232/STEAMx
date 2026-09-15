# LDraw 课程资源发布

课程模型与应用代码分开发布。模型使用已确认的完整 MPD，经 OSS 上传与回读校验后更新课时引用；应用代码变化仍通过 GitHub Actions 发布 Docker 镜像。

## 首次启用

需要先部署包含 `lib/courses/ldraw-model-source.ts` 的应用版本。该版本使分步接口、零件清单和 sitemap 支持 OSS 模型；只合入工作流筛选、尚未部署读取层时，不能把课程切到容器中不存在的新模型。

服务器需配置 `NEXT_PUBLIC_ASSETS_BASE_URL`。读取层只从该地址的 `courses/ldraw/` 请求合法模型文件名，带固定站点 Referer；默认值为 `https://www.steamx.cc/`，可通过服务端 `LDRAW_ASSETS_REFERER` 配置。远端不可用时可回退同名本地 MPD。保留本地模型用于兼容和回退，不必先删除 Docker 中的旧资源。

## 后续模型更新

1. 在本地预览完成验收，正式 MPD 的完整 SHA-256 必须与 `scripts/ldraw-reviews/<slug>.ldr.json` 的确认版本一致。发布命令不会重建模型或替代人工确认。
2. 先预检选择的模型，默认不会上传：

   ```bash
   node scripts/publish-ldraw-assets.mjs --only=3-bao-jian
   # 已确认整批的预检：
   node scripts/publish-ldraw-assets.mjs --prefix=3-
   ```

3. 在已获发布授权的范围内上传并保存清单：

   ```bash
   node scripts/publish-ldraw-assets.mjs --only=3-bao-jian \
     --upload --manifest=.tmp/ldraw-release/manifest.json
   ```

   命令读取 `.env.local` / `.env` 的现有 OSS 配置；整批预检完成后才进行上传。对象使用 `courses/ldraw/<slug>-<完整SHA256>.mpd`，配色文件也采用内容哈希命名。已存在对象先核对内容，新上传对象回读核对哈希；任何不一致都会停止，成功项会保存在清单中。命令不会修改数据库、确认记录或同名旧版 OSS 模型。

4. 用清单中各课时的 `modelURL` 和 `colorURL` 更新对应 `content.building3d.ldrawModelUrl`、`ldrawColorUrl`。模型步数变化时一并更新 `steps3d`；课程解析器会去掉末尾纯空白 STEP，预览接口的依赖文件数量不是积木块数。按课时 ID 和原 content 校验，在事务内更新这几个字段并回读，保留课件、视频、作品墙和其他内容。历史 `upsert-courseware.mjs` 会整体覆盖 content，不适合仅补模型字段。
5. 用新的文件名验证生产 `/api/courses/ldraw-step` 的首末步与 `/api/courses/ldraw-bom`，再核验课时映射。只有这些检查通过才记录为课程发布完成。

内容哈希放在文件名中，不能只追加 `?v=...`：课程播放器按文件名请求分步/BOM API，文件名变化才能区分浏览器缓存中的旧模型。读取层同时校验哈希命名的 MPD，防止对象内容与版本不一致。

## GitHub Actions 的应用发布范围

`release.yml` 使用 `scripts/release-scope.mjs` 比较 push 前后文件：

- 仅 `public/courses/ldraw/`、`scripts/ldraw-models/`、`scripts/ldraw-reviews/`、`scripts/courseware/`、`docs/`、根 README 或 PROJECT_INDEX 变化，跳过 Docker 构建和 SCP。Git push 本身不会替代上面的 OSS 上传与课时更新。
- 应用代码、部署配置、共享运行时元数据或混合变化继续走完整应用发布。
- `v*` 标签和手动触发 Release Deploy 始终发布应用；无法可靠比较变更时也保守执行完整发布。

## 已完成的 3+ 批次与归档

3+ 的 100 个课时已于 2026-09-15 发布完成，见 [当前状态](ldraw-status.md) 与 [发布记录](ldraw-published-2026-09-15.md)。这次发布使用了当时的完整镜像流程；未来资源发布使用上述独立流程。

源 LDR、共享零件、人工确认记录和正式 MPD 继续保留在原目录。公开版本清单与校验证据在 [发布归档](archive/ldraw/releases/2026-09-15/)；完整数据库快照、执行脚本、资产包和旧检查环境在本机 `/home/arron/archives/steamx/ldraw-3plus-2026-09-15/`。旧修复过程仅作为历史证据，不代表 3+ 当前仍待确认。
