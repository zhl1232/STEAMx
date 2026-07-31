# 自然观察物种图鉴开发设计

> 状态：代码实现完成，待执行数据库迁移与 OSS 缩略图发布。最后复核：2026-07-31。
>
> 本文承接 [`next-step.md`](./next-step.md) 的“自然观察：物种图鉴式展示重构”。页面/API/RPC migration/缩略图生成代码已落地；真实数据库迁移和 atlas 文件上传仍按第 14 节发布步骤执行。

## 1. 范围与不变量

- 主改 `/nature/species`；`/nature` 只增加图鉴入口和专题个人点亮进度。
- `/nature` 的发布观察、地图、动态和社区统计继续保留。
- 已观察显示彩色缩略图和完成标记；未观察或匿名显示灰度真实缩略图；只有确实无图或图片加载失败才显示问号。
- 所有物种 tile 都能进入现有 `/nature/species/[slug]` 详情页，未观察物种详情继续公开。
- 点亮只认本人 approved 观察，以及社群共识或无共识时的高置信度 AI 鉴定。
- 图鉴一次取得全部轻量摘要，不把详情说明、图集、音频、统计或观察记录塞进响应。
- 物种位置按专题和名称稳定排序，点亮状态变化不能导致 tile 换位。

## 2. 当前实现与缺口

| 入口 | 当前行为 | 目标改造 |
|---|---|---|
| `app/nature/species/page.tsx` | 约 300px Hero、搜索/专题/状态筛选、首屏 12 条 | 紧凑工具栏 + 三个专题图鉴分组，首屏露出物种矩阵 |
| `species-list-load-more.tsx` | 3/4 列大卡片、自动分页、复杂分页返回恢复 | 高密度固定尺寸 tile，一次加载摘要，简化锚点恢复 |
| `GET /api/species` | 分页返回完整 `Species` DTO | 新增 atlas API；旧接口只在过渡期保留 |
| `nature-observation-species.ts` | 列表查询说明、栖息地、季节、音频等大字段，混合排序先未观察后已观察 | 独立轻量 atlas 读模型，服务端稳定名称排序 |
| `nature-observation-observed-species.ts` | 已有 approved + 共识/AI fallback 点亮口径 | 下沉为无 userId 参数的本人 RPC，供所有入口统一复用 |
| `nature-observation-homepage.ts` | 部分精选物种仍只读共识关联，口径漂移 | 统一调用同一 observed species service |
| 物种图片 | 清单可能经 `/api/assets` 透传原图 | 离线生成 160x160 哈希 WebP；图鉴禁止回退原图 |

已复核的 active 物种基线为 576 个：鸟类 135、昆虫 267、植物 174。当前缩略图生成结果为 564 个可用 atlas WebP，12 个没有可用源图；缺图条目保留 `thumbnailUrl=null`，该数字不是数据库约束。

## 3. 目标文件边界

建议新增：

```text
lib/api/nature-observation-atlas.ts
app/api/species/atlas/route.ts
app/nature/species/species-atlas.tsx
app/nature/species/species-atlas-tile.tsx
scripts/build-species-atlas-thumbnails.mjs
public/manifests/species-atlas-thumbnails.json
```

建议修改：

```text
app/nature/species/page.tsx
app/nature/page.tsx
lib/api/nature-observation-observed-species.ts
lib/api/nature-observation-progress.ts
lib/api/nature-observation-homepage.ts
lib/nature-species-scroll-restore.ts
scripts/migrate-public-to-oss.mjs
app/globals.css
lib/supabase/types.ts
```

稳定一个版本后可删除：

- `app/nature/species/species-list-load-more.tsx` 及对应分页测试。
- `lib/nature-species-queries.ts` 中只为旧清单分页服务的部分。
- scroll restore v1 的 `nextPage` 补齐逻辑。

## 4. Atlas 响应契约

新增独立 DTO，不复用大型 `Species`：

```ts
export type SpeciesAtlasTopicKey = 'birds' | 'insects' | 'plants'

export type SpeciesAtlasProgressState =
  | 'ready'
  | 'anonymous'
  | 'unavailable'

export interface SpeciesAtlasItem {
  id: number
  slug: string
  commonName: string
  scientificName: string | null
  taxonGroup: string | null
  aliases: string[]
  topicKey: SpeciesAtlasTopicKey
  thumbnailUrl: string | null
  observedByCurrentUser: boolean | null
}

export interface SpeciesAtlasGroup {
  key: SpeciesAtlasTopicKey
  label: string
  total: number
  observedCount: number | null
  items: SpeciesAtlasItem[]
}

export interface SpeciesAtlasResponse {
  schemaVersion: 1
  viewer: {
    authenticated: boolean
    progressState: SpeciesAtlasProgressState
  }
  total: number
  observedCount: number | null
  groups: SpeciesAtlasGroup[]
}
```

`observedByCurrentUser=null` 不等于“未观察”：

- 匿名用户返回 null，UI 全部灰度并提示登录。
- 点亮查询失败返回 null 和 `progressState='unavailable'`，UI 显示“观察状态暂时不可用”，不能误报为 0 个。
- 登录且查询成功才返回完整 boolean。

DTO 不返回 `identification_notes`、`habitat_notes`、`seasonality_notes`、`audio_url`、完整 `imageUrls`、热点、统计和观察记录。

## 5. 服务端读模型

### 5.1 公共 catalog

`getSpeciesAtlasCatalog()` 使用 `createPublicClient()`，只读取 active 且属于 `visibleSpeciesTopicKeys` 的物种：

```text
id, slug, common_name, scientific_name, aliases,
taxon_group, nature_topic
```

- 缩略图 URL 从 `species-atlas-thumbnails.json` 按 slug 映射，不在请求期检查原图。
- 公共 catalog 可用 Next `unstable_cache` 缓存 300 秒，tag 使用 `nature-species`。
- 专题固定顺序为 birds、insects、plants。
- 组内服务端使用 `Intl.Collator('zh-CN-u-co-pinyin')` 比较 `commonName`，同名再按 `id` 升序。
- 客户端搜索和筛选只过滤，不重新排序。

### 5.2 个性化合并

`getSpeciesAtlas()`：

1. 读取可共享的公共 catalog。
2. 通过请求级 Supabase client 取得当前用户。
3. 登录用户调用 `get_my_observed_species_ids()`；匿名不调用。
4. 合并 boolean/null 状态并计算专题与总进度。

公共部分可以共享缓存；合并后的个性化结果不可进入跨用户缓存。

`getNaturalObservationProgressSummary`、主页专题进度、主页精选物种和图鉴都改用同一 observed species service。删除主页只看 `observation_event_species` 的旧逻辑，防止 AI fallback、审核状态和隐私口径漂移。

## 6. 点亮 RPC

新增 `<timestamp>_observed_species_atlas_rpc.sql`：

```sql
CREATE OR REPLACE FUNCTION public.get_my_observed_species_ids()
RETURNS TABLE (species_id bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH approved_user_events AS MATERIALIZED (
    SELECT oe.id
    FROM public.observation_events oe
    WHERE oe.user_id = (SELECT auth.uid())
      AND oe.status = 'approved'
  ),
  consensus_species AS (
    SELECT oes.observation_event_id, oes.species_id
    FROM public.observation_event_species oes
    JOIN approved_user_events aue
      ON aue.id = oes.observation_event_id
  ),
  ai_fallback_species AS (
    SELECT oi.observation_event_id, oi.species_id
    FROM public.observation_identifications oi
    JOIN approved_user_events aue
      ON aue.id = oi.observation_event_id
    WHERE oi.is_active = true
      AND oi.source = 'ai'
      AND oi.confidence >= 0.8
      AND NOT EXISTS (
        SELECT 1
        FROM public.observation_event_species oes
        WHERE oes.observation_event_id = oi.observation_event_id
      )
  )
  SELECT species_id FROM consensus_species
  UNION
  SELECT species_id FROM ai_fallback_species;
$$;

REVOKE ALL ON FUNCTION public.get_my_observed_species_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_observed_species_ids() TO authenticated;
```

安全与业务规则：

- 函数不接受 user ID，身份只取 `auth.uid()`。
- approved 的本人私密记录也计入，和当前个人进度语义一致；不要求 `is_public=true`。
- 同一观察已经有社群共识时，共识覆盖该观察的 AI 候选。
- pending、rejected、inactive AI、非 AI 来源和 `confidence=0.79` 都不点亮。
- 观察后来被拒、共识撤销或 AI 鉴定失效时，下次请求应熄灭，不保存永久 boolean。
- SQL 阈值 0.8 必须与 `AI_IDENTIFICATION_CONFIDENCE_THRESHOLD` 的单测保持一致；以后调整要同一个变更更新。

上线前在真实数据执行 `EXPLAIN (ANALYZE, BUFFERS)`。若 approved user events 不能稳定走索引，再增加 `(user_id, id) WHERE status='approved'` 部分索引；不要先凭感觉增加重复索引。

迁移按 `.cursor/rules/db-migrations.mdc` 执行 `pnpm db:push -- --dry-run`、`pnpm db:push` 和 `pnpm db:status`，禁止使用 `supabase db push`。迁移后同步 `lib/supabase/types.ts`。

## 7. API 与缓存

新增 `GET /api/species/atlas`：

- 不接受分页、user ID、topic、status 或 q 参数；一次返回完整 `SpeciesAtlasResponse`。
- `/nature/species` Server Component 直接调用同一 service 并传 initial data，不能从服务端再 HTTP 请求自己。
- API 只用于客户端重试或以后刷新，不维护第二份 DTO 映射。
- 合并响应设置 `Cache-Control: private, no-store` 和 `Vary: Cookie`。
- 公共 catalog 查询失败返回 500。
- 点亮 RPC 失败仍返回 catalog，`progressState='unavailable'`，并记录不含用户观察 ID 的结构化错误。

现有 `/api/species` 在 feature flag 过渡期保留；图鉴稳定一个版本后删除清单分页调用。`/api/species/[slug]` 保留不变，详情继续公开。

## 8. 缩略图管线

### 8.1 生成规则

`scripts/build-species-atlas-thumbnails.mjs` 从现有物种 manifest 的第一张有效图片生成：

- 160x160 WebP。
- `fit: cover`，默认 quality 68；抽样检查主体裁切后再统一调整。
- 内容哈希文件名，例如 `/birds/atlas/magpie-a1b2c3d4.webp`。
- 植物按来源落到 `/trees/atlas` 或 `/fruits/atlas`；继续复用现有资源白名单和 OSS 上传流程。
- 生成 `public/manifests/species-atlas-thumbnails.json`；提交 manifest，不提交可再生成的本地 atlas 图片目录。
- `public/*/atlas/` 加入 `.gitignore`。

manifest 无条目时 `thumbnailUrl=null`。运行时不能回退到原始大图；只有 null 或加载失败才显示问号。

manifest 使用可重复生成、无时间戳的固定结构：

```json
{
  "schemaVersion": 1,
  "items": {
    "pica-pica": {
      "topicKey": "birds",
      "thumbnailUrl": "/birds/atlas/pica-pica-a1b2c3d4.webp",
      "bytes": 10842,
      "sha256": "a1b2c3d4..."
    }
  }
}
```

`items` 按 slug 排序，JSON key 和缩进固定；相同输入重复执行必须得到逐字节一致的 manifest。运行时只把 `thumbnailUrl` 合并进 atlas DTO，不能把 `bytes` 或 hash 发给客户端。

### 8.2 脚本能力

- 默认或 `--check` 只检查，不改文件；写入必须显式使用 `--write`。
- `--only=birds,insects,plants` 限定专题，`--slug=pica-pica,...` 限定物种，`--concurrency=4` 控制 `sharp` 并发；不使用含义混合的单个 `--only=<topic|slug>` 参数。
- 脚本复用项目已有 `sharp` 依赖，并用公开 Supabase URL/anon key 只读 active 物种目录；不读取 service-role key，也不持有 OSS 凭据。
- 校验 active 物种覆盖数、160x160、WebP 格式、重复 slug、失效源图和文件大小。
- 输出成功数、缺源图、生成失败、超预算和 manifest diff。

标准命令：

```bash
node scripts/build-species-atlas-thumbnails.mjs --check
node scripts/build-species-atlas-thumbnails.mjs --write --concurrency=4
node scripts/build-species-atlas-thumbnails.mjs --check
```

图片预算：平均不超过 12 KB，P95 不超过 20 KB，单张不超过 24 KB，全量滚动传输目标不超过 8 MB。

上传顺序先于代码发布。修改 `scripts/migrate-public-to-oss.mjs`，增加独立的 `birds-atlas`、`insects-atlas`、`trees-atlas`、`fruits-atlas` flat group，分别把 `public/<group>/atlas` 上传到同名 OSS 前缀；不要复用现有 `fruits` group，因为它的根目录是 `public/fruits/images`，无法覆盖 `public/fruits/atlas`。先执行：

```bash
node scripts/migrate-public-to-oss.mjs --only=birds-atlas,insects-atlas,trees-atlas,fruits-atlas --dry-run
node scripts/migrate-public-to-oss.mjs --only=birds-atlas,insects-atlas,trees-atlas,fruits-atlas
```

随后抽样 HEAD 验证 URL、`Content-Type`、缓存头和 Referer 行为。上传组不生成或改写现有物种原图 manifest；atlas manifest 只由缩略图生成脚本维护。

## 9. 页面结构与交互

### 9.1 页面

`app/nature/species/page.tsx` 移除当前大 Hero，改为：

1. 移动页头/紧凑标题。
2. 登录/不可用状态提示。
3. 搜索、专题和观察状态筛选工具栏。
4. 鸟类、昆虫、植物三个无外框分组。
5. 每组标题显示“已观察 x / y”；匿名只显示总数和登录入口，不伪造 `0 / y`。

首个 viewport 必须露出第一组物种。不要把矩阵包进大装饰卡，也不要在 tile 外再套卡片。

### 9.2 筛选和 URL

- 保留 `q/topic/status` 深链。
- 数据全量到达后在客户端筛选，并用 `router.replace` 同步 URL。
- 搜索匹配中文名、学名、科属和别名；使用预先归一化的小写文本，不引入客户端拼音库。
- 匿名访问 `status=observed|unobserved` 时归一化为 all，并给登录提示。
- 筛选后仍保持服务端稳定顺序；不做“已观察优先”。

### 9.3 Tile

- 整个 tile 是指向 `/nature/species/[slug]` 的 `Link`。
- 已观察：彩色图片，右上角完成图标，并有可读状态文本。
- 未观察和匿名：真实图片统一灰度、降低饱和度，但名称保持正常对比度。
- 缺图/加载失败：使用 Lucide 问号图标，不显示浏览器破图。
- 不使用锁图标，避免误导为详情不可访问。
- 图片固定 `aspect-ratio: 1`；名称区域固定两行高度，最长名称不能撑大 tile。

### 9.4 返回恢复

scroll restore v2 只保存：

```ts
{
  filtersKey: string
  anchorSlug?: string
  anchorTop?: number
  scrollY: number
}
```

删除 `nextPage` 和分页预取循环，继续复用 `appendNatureFrom` 把来源 URL 带到详情。返回时优先按 anchor slug 和相对 top 恢复，找不到再使用 scrollY。

## 10. `/nature` 首页衔接

- 专题区标题或操作增加明确的“物种图鉴”入口。
- 鸟类、昆虫、植物卡显示当前用户“已观察 / 总数”。
- 匿名卡只显示“共 x 个物种”并提示登录点亮，不显示 0/x。
- 真菌暂无 active 物种时继续保持预告状态。
- 地图、发布按钮、最近动态和社区贡献统计布局不变。

首页当前有可共享公共数据。个人点亮数必须在请求级合并或独立客户端请求，不能写入跨用户公共缓存。

## 11. 响应式与可访问性

- 手机固定 4 列，gap 8px；平板 tile 约 80-92px；桌面 tile 限制约 96-112px，不能随宽屏拉成大卡。
- 网格使用稳定 track 和 tile 尺寸，加载、问号、完成标记不能引发布局位移。
- 每个 tile 最小点击区域 44px，并有清晰 `focus-visible`。
- 图片 `alt=""`；Link 的 accessible name 包含物种名、专题和“已观察/待观察”。
- 问号和完成装饰图标按需 `aria-hidden`，状态必须有非颜色表达。
- 分组使用 `section + h2 + ul`，筛选结果数放入 `aria-live='polite'`。
- `prefers-reduced-motion` 下不做入场和 hover 位移。
- 576 个 tile 首版不虚拟化，保留浏览器查找、分组导航、读屏顺序和锚点恢复；离屏分组使用 `content-visibility:auto`。active 物种超过约 1000 后再依据 profile 评估虚拟化。

## 12. 性能预算

- atlas JSON 原始体积 `<180 KB`，Brotli/Gzip 后 `<45 KB`。
- 新增客户端 JS `<25 KB gzip`，不把 `pinyin-pro` 等库加入 atlas bundle。
- 初始视口图片请求不超过约两屏范围，全部图片使用 lazy loading。
- 网络中不得出现图鉴原始物种大图 URL，只允许 atlas WebP 路径。
- CLS `<0.05`，移动端 LCP `<2.5s`，atlas API p95 `<250ms`，点亮 RPC p95 `<120ms`。
- 日志分段记录 catalog、progress、mapping 耗时、响应字节和缩略图缺失数，不记录 event ID 或用户观察明细。

若预算未达标，先检查缩略图、DTO 字段和图片加载范围；不要先引入虚拟列表增加导航复杂度。

## 13. 测试与验收

### 13.1 纯函数

- 专题固定顺序。
- 中文名稳定排序，同名按 ID。
- 中文名/学名/科属/别名搜索。
- topic/status 过滤。
- 点亮状态变化不改变顺序。

### 13.2 RPC 集成

- pending/rejected 不亮，approved private 本人记录可亮。
- AI 0.80 亮、0.79 不亮，inactive AI 不亮。
- 有社群共识时覆盖冲突 AI。
- 别人的观察不亮。
- 共识/AI 撤销或观察被拒后熄灭。

### 13.3 API

- 匿名所有 observed 为 null；登录成功为完整 boolean。
- progress 查询失败返回 unavailable，不误报 false。
- DTO 无详情大字段，缓存头为 private/no-store，响应体积达标。

### 13.4 组件

- 彩色 + 完成标记、灰度但非问号、缺图问号、图片错误 fallback。
- 三种状态都能进入详情。
- 名称两行、图片加载和筛选切换不导致网格跳动。

### 13.5 Playwright 与网络

- 匿名可以进入未观察物种详情。
- 登录用户专题计数与 tile 状态一致。
- 搜索、专题、状态深链和浏览器前进/后退。
- 详情返回恢复到原 tile。
- 320、375、768、1440 viewport 无重叠、溢出或不可点区域。
- 截图检查彩色/灰度/问号状态清楚，非颜色标记可见。
- 首屏不下载全部图片，无原图请求，缩略图 404 为 0。

数据验收：总数等于 active 且处于可见专题的物种数；登录用户每个专题与全局都满足 `observed + unobserved = total`。

## 14. 发布与回滚

1. 记录当前物种/专题/缺图基线和若干测试账号点亮样本。
2. 上线 additive RPC migration，检查执行计划和真实样本结果。
3. 生成并校验全部缩略图，通过独立 `*-atlas` 上传组完成 dry-run、正式上传和 HEAD 抽检，再发布读路径代码。
4. 用服务端 feature flag `NATURE_SPECIES_ATLAS_V2` 在测试环境启用，旧页面和 `/api/species` 暂留。
5. 上线 `/nature/species`，观察 API p95、JSON 字节、图片 404、详情点击率和新旧点亮差异。
6. 图鉴稳定后再给 `/nature` 增加个人专题进度，确认公共缓存没有串用户。
7. 稳定一个版本后删除分页组件、分页 query helper 和 scroll restore v1。

回滚只关闭 feature flag，恢复旧页面。RPC、索引、manifest 和哈希缩略图都是 additive，不需要紧急数据库回滚。

## 15. 完成定义

- `/nature/species` 首屏是全量图鉴矩阵，不再是 12 条大卡片流。
- 所有物种位置稳定，已观察彩色、未观察/匿名灰度、仅缺图问号，全部可点详情。
- 图鉴、个人进度和首页使用同一审核/共识/AI 点亮口径。
- 页面与 API 达到体积、图片、LCP、CLS 和可访问性预算。
- `/nature` 只补个人专题进度和图鉴入口，原发布/地图/动态流程无回归。
- 实际新增的路由、共享模块、脚本、RPC 和行为已经同步到 `PROJECT_INDEX.md`。
