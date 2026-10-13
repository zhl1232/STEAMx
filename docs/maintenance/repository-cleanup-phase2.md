# 旧维护入口的保护边界

代码核对：2026-10-13，`0a3cdd8c9d5e537ae6026eeb78f28b9b3a7634cb` 已包含旧入口退役。本页只维护仍有效的保护和风险；历次删除清单、原始源码与检查结果在 Git 历史及原 PR 追溯，不在当前树保存全文副本。

## 当前入口

| 入口 | 行为与边界 |
|---|---|
| 旧内容分诊工作流 | 已从 `.github/workflows/` 移除，不保留该工作流的自动或手动执行入口 |
| `scripts/apply-content-triage-2026-08-13.mjs` | 所有参数均仅提示 `[RETIRED]` 并以状态 1 结束；不加载环境、不启动子进程、不调用 purge 或迁移 |
| `scripts/generate-math-worksheet-assets.mjs` | 包括 `--check` 在内的参数均拒绝执行，不生成或覆盖素材 |
| `scripts/purge-triaged-project-assets.mjs` | 保留供审查，不是可直接复用的通用清理命令；其编号归属和共享引用风险尚未修复 |

旧编排允许 OSS 操作失败后继续迁移，旧 purge 把 manifest 的 `entry.index` 与数据库项目 ID 比较；这两种编号不能直接等同。入口退役不证明历史生产清理已完成，也没有修复 purge 的全部风险。后续数据清理须独立核对真实引用、备份、对象哈希、目标环境和授权，不能沿用删除仓库文档的许可。

正常 Release、`db-push.mjs`、完整迁移目录、发布白名单、课程模型及现用资源保留。数据库操作遵循 [迁移规则](../database-psql.md)，应用发布遵循 [部署说明](../deployment.md)。

## 回归

`node --test scripts/repository-cleanup-phase2.test.mjs` 保留既有界面资源范围、活动引用、自动删除入口不存在、两个旧命令的拒绝执行及现用资源/迁移保护检查；同时检查冗余上下文未重新入库、现行文件没有失效引用。不再要求旧源码副本永久存在，也不执行历史操作或读取生产环境。

`e2e/repository-cleanup-phase2.spec.ts` 继续检查现用与已删除资源地址。CI、构建、浏览器检查和生产业务验收分别记录，不能以一项通过替代其他项。
