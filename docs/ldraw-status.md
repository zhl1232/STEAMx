# LDraw 当前状态索引

> 截至 2026-09-15：3+ 的 100 个模型已完成用户确认、生产 MPD 发布、OSS 回读和课程数据库更新。本页只记录当前入口；完整过程、缺件、源图缺项、用户接受的几何例外和历史 `INCOMPLETE` 结论保存在 [历史状态快照](archive/ldraw/ldraw-status-history-2026-09-15.md)。

## 3+ 当前已完成

- **100/100 已确认并生产发布**：course_id=5 的 100 个既有课时均已更新模型地址、配色地址和 `steps3d`；公开课时清单全部 `has_model=true`。
- **固定交付来源**：源模型在 [`scripts/ldraw-models/`](../scripts/ldraw-models/)，递归零件依赖与元数据在 [`scripts/ldraw-models/parts/`](../scripts/ldraw-models/parts/) 和 [`part-metadata.json`](../.agents/skills/image-to-ldraw/references/part-metadata.json)，人工确认记录在 [`scripts/ldraw-reviews/`](../scripts/ldraw-reviews/)，正式 MPD 在 [`public/courses/ldraw/`](../public/courses/ldraw/)。
- **发布证据**：[2026-09-15 发布记录](ldraw-published-2026-09-15.md)；证据已归档于 [`archive/ldraw/releases/2026-09-15/`](archive/ldraw/releases/2026-09-15/)，包括 manifest、生产校验、OSS、数据库回读和完成记录。完整数据库快照与操作脚本另存于 `/home/arron/archives/steamx/ldraw-3plus-2026-09-15/publish-3-20260915/`。
- 发布保留用户接受的几何例外和源图缺项说明；这批记录表达模型/资产交付完成，不把历史限制改写为实物装配验证通过。

## 4+ 与 5+ 后续范围

4+ 尚有 100 个无同名公共 MPD 的本地源草稿，5+ 尚有 26 个；两组都未因 3+ 发布而升级，也不属于本次用户确认范围。它们继续按各自源图、零件、连接和预览证据推进，仍可能是 `INCOMPLETE` 或仅供人工查看的候选。

- 4+ 的批次清单、未完成原因、源图缺项和已接受限制见 [历史状态快照](archive/ldraw/ldraw-status-history-2026-09-15.md) 的 4+ 续修章节；索引原始 LDraw 过程另存于 [PROJECT_INDEX LDraw 历史](archive/ldraw/project-index-ldraw-history-2026-09-15.md)。
- 5+ 的三模型部分草稿（扁担、病床、对抗球桌）及其余未完成范围见 [历史状态快照](archive/ldraw/ldraw-status-history-2026-09-15.md#2026-09-12-5-三模型部分草稿)；旧的并行认领文字只作为历史，不代表当前认领状态。

## 状态边界

历史文件中的 `INCOMPLETE`、省略件、推断位置、临时手持和保守碰撞报警均保留原意；自动碰撞、逐步渲染、Studio 或生产接口检查不单独证明用户确认或实物稳定性。新的 4+/5+ 变更应补充对应历史证据，并同步维护本页摘要。
