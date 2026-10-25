# 自然观察物种图鉴维护 runbook

> 状态：代码已包含图鉴 V2 的 RPC、页面/API、共享点亮口径和缩略图 manifest。本地代码核对：2026-09-09；远端部署状态需另行确认。576/564 的数据基线沿用 2026-07-31 记录，发布前应重新核对。

## 当前实现

- `/nature/species` 使用全量轻量 atlas DTO，按 birds、insects、plants 分组和中文名稳定排序；搜索、专题、观察状态筛选在客户端完成并支持深链。
- `/api/species/atlas` 返回同一 `SpeciesAtlasResponse`。公共 catalog 使用共享缓存；登录用户的点亮合并为请求级数据并返回 `private, no-store`；匿名或点亮查询故障不会伪造未观察状态。
- `get_my_observed_species_ids()` 只读取本人 approved 观察：社群共识优先，无共识时采用 active AI 且 confidence ≥ 0.8。详情页仍对未观察物种公开。
- tile 已观察显示彩色缩略图和完成状态；未观察/匿名灰度；缺图或加载失败显示问号。所有 tile 都可进入 `/nature/species/[slug]`。
- 当前 active 可见专题基线为 576 个物种（鸟 135、昆虫 267、植物 174），manifest 有 564 个 atlas WebP；其余条目保留 `thumbnailUrl=null`。

## 事实来源与权限

关键实现位于 `lib/api/nature-observation-atlas.ts`、`lib/api/nature-observation-observed-species.ts`、`lib/nature-species-atlas.ts`、`app/api/species/atlas/route.ts` 和 `app/nature/species/`。点亮 RPC 迁移为 `supabase/migrations/20260731113000_observed_species_atlas_rpc.sql`。

DTO 只包含名称、分类、别名、专题、缩略图 URL 和本人点亮状态，不返回观察记录、详情说明、音频、统计或原图 URL。RPC 不接受 user ID，使用 `auth.uid()`；不要在公共缓存中写入个人计数。

## 缩略图维护

manifest：`public/manifests/species-atlas-thumbnails.json`。生成脚本默认只读：

```bash
node scripts/build-species-atlas-thumbnails.mjs --check
node scripts/build-species-atlas-thumbnails.mjs --write --concurrency=4
node scripts/build-species-atlas-thumbnails.mjs --check
```

图片为 160×160 WebP，按 slug 使用固定内容哈希命名；缺源图不生成占位原图。生成后先抽检主体裁切、尺寸、格式和预算，再用独立上传组同步：

```bash
node scripts/migrate-public-to-oss.mjs --only=birds-atlas,insects-atlas,trees-atlas,fruits-atlas --dry-run
node scripts/migrate-public-to-oss.mjs --only=birds-atlas,insects-atlas,trees-atlas,fruits-atlas
```

上传后抽样 HEAD 检查 URL、Content-Type、缓存头和 Referer 行为；代码发布前确认线上不请求物种原图。

## 数据库与发布维护

数据库连接、迁移命令、各模式副作用和执行授权统一遵循 [数据库连接与迁移](database-psql.md)，不在本页维护另一套命令规则。RPC 或索引变更后按该文档核对目标与批准范围，再进行对应模式的预检、执行和状态验证，并在授权范围内按真实数据抽样 `EXPLAIN (ANALYZE, BUFFERS)`。

内容审核、AI 阈值或专题可见性变化后，复核“共识覆盖 AI、0.80/0.79 边界、被拒观察熄灭、本人私密 approved 观察可亮”的语义。真菌仍为预告，没有 active 条目时不要开放专题点亮。

## 测试与监控

纯函数和 DTO 测试在 `lib/nature-species-atlas.test.ts` 及相邻 API 测试；发布验收覆盖匿名/登录状态、搜索和深链、详情返回、响应缓存头、缩略图 404、无原图请求、移动端布局和浏览器前进/后退恢复。重点监控 atlas API p95、响应字节、progress unavailable、缩略图缺失/404 和公共缓存串用户。

发现点亮 RPC 失败时，保留 catalog 并显示 unavailable；不要把错误降级为 false。发现 manifest 与 active 物种不一致时，先 `--check`，确认源图和 OSS 上传组，再发布 manifest。回滚应回退到上一个已验证的应用版本；当前代码未发现专用于图鉴的 feature flag。RPC、manifest 和缩略图均为 additive，不删除历史观察数据。

## 详情首屏布局

详情页不再按是否有观察统计切换全宽大图：平板及桌面将图集与名称、分类、识别特征并列，统计与其余详情放在下方。主图等比完整展示并限制高度，提供「查看完整图片」原图入口；缩略图切换、来源观察链接和缺图回退保留。

观察记录详情将名称、学名及物种百科链接放在照片之前，保持唯一主标题；照片尺寸、轮播和大图预览不变，状态和时间仍在正文头部。

## 网站首页观察卡片

网站首页通过 `getRecentNatureObservations` 按发布时间读取最近三条公开且审核通过的观察，不要求公开坐标；隐藏位置或未填写坐标的记录仍可展示，地点继续遵守隐私分级。地图独立使用 `getRecentNatureObservationsForMap` 筛选可定位记录。首页启用严格错误处理，查询失败交给页面错误边界，不能当作空列表显示“还没有自然观察记录”。
