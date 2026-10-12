# Agent Instructions

- Before changing code, read the relevant section of `PROJECT_INDEX.md`.
- When adding a feature, route, shared module, script, database structure, or important behavior change, update `PROJECT_INDEX.md` in the same change.
- `docs/archive/` 是历史记录，默认不读、不作为现行实现依据；只有任务明确要求查阅历史时才读。
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
