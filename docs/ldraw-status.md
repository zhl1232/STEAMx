# LDraw 当前状态索引

> 文档整理：2026-10-12，基线 `main@f4eb9e8caee04d79997d9ed4f9401f3f8dcf2510`。本页区分已有发布记录、后续候选与待核对状态；本次未重新检查生产数据库、资产或实物装配。完整历史限制保存在 [历史状态快照](archive/ldraw/ldraw-status-history-2026-09-15.md)。

## 3+ 已有发布基线（2026-09-15）

- **历史发布记录为 100/100**：course_id=5 的 100 个既有课时均已更新模型地址、配色地址和 `steps3d`；公开课时清单全部 `has_model=true`。
- **固定交付来源**：源模型在 [`scripts/ldraw-models/`](../scripts/ldraw-models/)，递归零件依赖与元数据在 [`scripts/ldraw-models/parts/`](../scripts/ldraw-models/parts/) 和 [`part-metadata.json`](../.agents/skills/image-to-ldraw/references/part-metadata.json)，人工确认记录在 [`scripts/ldraw-reviews/`](../scripts/ldraw-reviews/)，正式 MPD 在 [`public/courses/ldraw/`](../public/courses/ldraw/)。
- **发布证据**：[2026-09-15 发布记录](archive/ldraw/releases/2026-09-15/release-notes.md)；证据已归档于 [`archive/ldraw/releases/2026-09-15/`](archive/ldraw/releases/2026-09-15/)，包括 manifest、生产校验、OSS、数据库回读和完成记录。完整数据库快照与操作脚本另存于 `/home/arron/archives/steamx/ldraw-3plus-2026-09-15/publish-3-20260915/`。
- 发布保留用户接受的几何例外和源图缺项说明；这批记录表达模型/资产交付完成，不把历史限制改写为实物装配验证通过。

## 4+ / 5+ 与后续变更

2026-09-15 的历史快照记载：4+ 有 100 个、5+ 有 26 个无同名公共 MPD 的本地源草稿。该数字是当时范围，不再作为今天的剩余数量。后续记录如下：

| 范围 | 仓库中的后续证据 | 当前应如何理解 |
|---|---|---|
| 3+ / 4+ / 5+ 后续模型 | [2026-10-09 发布包](releases/2026-10-09/README.md) 记录 65 个确认版本：小班更新 5 个、中班 55 个、大班 5 个 | 该文档仍标发布候选；入仓库与确认记录不能代替资产、课时数据库和生产页面的核验 |
| 材料覆盖 | [小班粗算](courses/lesson-kit-coverage-small-class.md)、[中班/大班粗算](courses/lesson-kit-coverage-middle-senior.md) | 数量以各自扫描模型和默认库存为范围，不是线上可用率或实搭通过率 |
| 剩余草稿、已发布版本与限制 | 原模型、确认记录、批次 manifest 和后续实际核验 | 需要按模型身份与版本对齐后更新，不用旧快照相减推算今天剩余量 |

状态核对任务及关闭条件见 [下一步](next-step.md)；发布技术流程继续见 [LDraw 课程资源发布](ldraw-publishing.md)。

- 4+ 的批次清单、未完成原因、源图缺项和已接受限制见 [历史状态快照](archive/ldraw/ldraw-status-history-2026-09-15.md) 的 4+ 续修章节；索引原始 LDraw 过程另存于 [PROJECT_INDEX LDraw 历史](archive/ldraw/project-index-ldraw-history-2026-09-15.md)。
- 5+ 的三模型部分草稿（扁担、病床、对抗球桌）及其余未完成范围见 [历史状态快照](archive/ldraw/ldraw-status-history-2026-09-15.md#2026-09-12-5-三模型部分草稿)；旧的并行认领文字只作为历史，不代表当前认领状态。

## 状态边界

历史文件中的 `INCOMPLETE`、省略件、推断位置、临时手持和保守碰撞报警均保留原意；自动碰撞、逐步渲染、Studio 或生产接口检查不单独证明用户确认或实物稳定性。新的变更使用独立版本和日期保存证据，并更新本页摘要；旧快照保持原意。内容完成、人工确认、资源发布、数据库更新、生产验收和实物验证分别记录，口径见 [内容质量与验收](content-quality.md)。
