# 2026-10-13 第二轮维护入口归档

基线：`a1ce88ad5f3776c6d1192587431a671d611472cc`。原文件内容按 Git blob 原样保留。
这些 `.txt` 是历史证据，不是当前工作流或可运行维护入口；旧相对路径也没有改写。

| 原文件 | 快照 | 原 Git blob SHA |
|---|---|---|
| `.github/workflows/apply-content-triage-2026-08-13.yml` | [工作流快照](apply-content-triage-2026-08-13.yml.txt) | `7d671925be1277b8626565925c0bf22b89c25318` |
| `scripts/apply-content-triage-2026-08-13.mjs` | [编排源码](apply-content-triage-2026-08-13.mjs.txt) | `630e765acd8ca1a2868675709400db4276572d09` |
| `scripts/generate-math-worksheet-assets.mjs` | [精确题面生成源码](generate-math-worksheet-assets.mjs.txt) | `1f816df2b4c93753bce9ccde565f0eabb32c233e` |

工作流从活动目录移除；两个旧脚本路径只保留拒绝执行并输出指引的入口，任何参数都不会恢复原功能。
不运行此处的命令，不把快照改回可执行后直接运行。需要使用其中的算法或数据时，先核对目标、输入、
授权和引用，再另建经审核工具。旧 purge 工具并未因本次归档变成安全的通用删除工具。

当前说明、候选资源和验证边界见 [维护入口退役与第二轮资源清理](../../../maintenance/repository-cleanup-phase2.md)。
归档不证明历史批次在生产成功执行过，也不代表生产数据库或 OSS 已清理。
