# 维护入口退役与第二轮资源清理

检查基线：`a1ce88ad5f3776c6d1192587431a671d611472cc`，2026-10-13。
PR 基于 `daa33cb6471745906f394adf7bb39c151bd998d5`，保留随后合入的语音升级。
本批独立于第一轮 PR #76；未合入默认分支前，下述退役与文件删除仅存在于本批分支，不是生产状态。
本批没有触发任何生产工作流、读取生产凭证、执行迁移或删除 OSS 对象。

## 当前维护入口

| 原入口 | 当前行为 |
|---|---|
| `apply-content-triage-2026-08-13.yml` | 从 `.github/workflows/` 移出，保存为历史 `.yml.txt`，不保留 push 或手动执行入口 |
| `scripts/apply-content-triage-2026-08-13.mjs` | 仅输出 `[RETIRED]` 指引并以状态 1 结束；不加载环境、不启动子进程、不调用 purge 或迁移 |
| `scripts/generate-math-worksheet-assets.mjs` | 仅输出归档指引并以状态 1 结束；包括 `--check` 在内的参数都不生成素材 |
| `scripts/purge-triaged-project-assets.mjs` | 原样保留供审查，不是当前可直接复用的通用清理命令；本批未执行、未修复其编号及共享引用判断 |

[完整源码快照及 blob 校验值](../archive/maintenance/2026-10-13-phase2/README.md)。
`PROJECT_INDEX.md` 在检查后又被语音升级更新，本 PR 保留它的最新内容。
[索引最小修订](repository-cleanup-phase2-index-review.json) 作为待审阅项附上，尚未应用到根索引；
它只增加退役提示并修改数学脚本条目，不整体改写大索引或历史 SQL。合并前需完成此项。
旧命令路径保留为拒绝执行的指引，当前用途以本页为准，不应根据历史索引再次执行批次操作。
正常发布、SEO 运维、`db-push.mjs` 和历史迁移文件均保留；没有更改生产 Release 工作流。

## 为什么退役旧链路

旧工作流会在 main 的特定路径变化时进入 production，执行一次性编排的 `--execute`。
原编排允许 OSS 操作失败后继续迁移，所谓预览也会调用并非无副作用的迁移预检。
旧 purge 脚本把 manifest 的 `entry.index` 与数据库项目 ID 比较；较新维护脚本明确这两种编号不能等同。
移出自动入口并阻止旧编排被直接误执行，不等于证明历史清理已完成，也没有修复 purge 的全部风险。
任何后续数据清理须重新核对真实引用、备份、对象哈希及授权，不能把这次资源删除授权沿用到生产数据。

## 本批删除的界面资源

只删除以下 9 个受版本管理文件，不删除其他同目录素材。恢复时从上述基线按原路径取回，勿整目录覆盖。
仓库名称/目录搜索没有找到本批资源引用；当前个人中心代码明确使用 `profile-icons/action-*`。
CI 额外对完整检出中的源码、SQL、配置、清单和当前文档进行引用检查；这不包含线上数据库字段或外部链接。

| 原路径（均在 `public/assets/` 下） | 字节 |
|---|---:|
| `bird-topic-campus-lake-hero.png` | 2053664 |
| `observation-list-reeds-sky-bg.png` | 1550399 |
| `species-archive-blue-tech-bg.png` | 1459505 |
| `profile-hero-explorer-v4.webp` | 97514 |
| `profile-actions/content.webp` | 3528 |
| `profile-actions/invite.webp` | 3304 |
| `profile-actions/messages.webp` | 4362 |
| `profile-actions/shop.webp` | 5012 |
| `profile-actions/wallet.webp` | 4478 |

合计 **5,181,766 字节（约 5.18 MB）**，是 public 原始文件减少量，不是首屏流量、压缩镜像差值或 Git 历史缩小量。
保留现用个人中心图标、自然专题图片、动态物种详情插图、小迪 sprite、课程/模型、PWA/站点验证文件、
媒体 manifest、发布白名单、全部数据库迁移以及未合入分支的内容。

## 验证与发布边界

- `node --test scripts/repository-cleanup-phase2.test.mjs`：删除范围、活动引用、自动删除入口退役、3 份原始源码
  blob、两个旧命令各 5 种调用方式的拒绝执行、现用资源和迁移边界。测试不执行归档脚本，不读取生产环境。
- `e2e/repository-cleanup-phase2.spec.ts`：11 个现用插图地址返回有效图片，9 个已删除地址返回 404。
  通过 CI 的独立 Playwright 步骤运行，既有 smoke 检查保持不变。
- 本地只验证新入口的语法与拒绝执行行为，不把不完整工作副本当成全仓库引用扫描或网站验收。
  完整引用扫描、构建、类型和浏览器结果以本批提交的 CI 为准；最终生产状态须在获准合入后再核实。

下一阶段的线上孤儿资源检查仍需完整数据库引用与 OSS 清单，不能凭前端无引用批量删除。
