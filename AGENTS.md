# Agent Instructions

- Before changing code, read the relevant section of `PROJECT_INDEX.md` and its linked source document. The documentation ownership map is maintained in `docs/README.md`.
- When adding a feature, route, shared module, script, database structure, or important behavior change, update its authoritative topic document in the same change. Update `PROJECT_INDEX.md` for entry-point changes; do not duplicate rules, numeric quotas, rollout state, or delivery logs in the index.
- 默认只读短索引、与本任务相关的现行专题和实现。先限定目录检索，再按需扩大；不把整个 `docs/`、技能目录、生成数据或历史迁移批量加载为背景。
- `docs/archive/` 是历史证据，不参与默认检索；只有任务明确要求追溯，或核验当前版本确实需要时，才定点读取。旧记录不得覆盖现行规则。大型 JSON/模型元数据按实际 ID 或键查询，不整文件阅读。
- 旧全文、执行日志和检查截图优先由 Git 历史或原 PR 留存，不在当前代码树另存副本或新建清理报告。删除前迁出仍有效的约束和未完成项；脚本依赖的清单、迁移、模型确认与有效证据不得按“历史文件”批量删除。
- 局部代码修复遵守既有设计规范，不自动扩展成整体设计或多技能流程；专项技能仅在任务确实需要时读取。
- This project uses Next.js 16. Use root-level `proxy.ts` with an exported `proxy` function for request interception. Do not create or restore the deprecated `middleware.ts` convention.
- For database migrations, follow `.cursor/rules/db-migrations.mdc` and use `pnpm db:push`, not `supabase db push`.

## Git 与生产发布

- 推送 `main` 会触发生产环境自动部署。默认完成修改、测试和 dev 验收，保留本地改动。
- 只有用户明确要求将本次变更推送到 `main` 时，才可推送，或通过合并等方式更新远端 `main`。
- 修改、修复、测试、写文档或本地提交的要求，不代表授权推送 `main` 或发布生产。
- 推送授权仅适用于用户指定的变更范围；过去一次的授权不能沿用到后续任务。
- 完成任务时说明改动与验证结果，以及是否已推送；未获推送授权时保持未推送状态。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
