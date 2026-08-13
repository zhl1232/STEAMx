#!/usr/bin/env node
/**
 * 2026-08-13 内容分诊线上一次性应用。
 *
 * 必须先清 OSS、再跑迁移：scripts/purge-triaged-project-assets.mjs 要从
 * projects / project_steps / comments 收集图片 URL，硬删除之后这些行就没了。
 *
 * 用法：
 *   node scripts/apply-content-triage-2026-08-13.mjs
 *   node scripts/apply-content-triage-2026-08-13.mjs --execute
 *
 * 默认只预览。加 --execute 才会删除 OSS 对象并执行 pnpm db:push。
 */

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const execute = process.argv.includes('--execute')

function run(script, args) {
  const result = spawnSync(process.execPath, [join(ROOT, script), ...args], {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

console.info(`内容分诊线上应用（${execute ? 'EXECUTE' : 'dry-run'}）`)
console.info('顺序：先 OSS（库行还在），再 db:push。')

run('scripts/purge-triaged-project-assets.mjs', [])
if (execute) {
  run('scripts/purge-triaged-project-assets.mjs', ['--execute'])
  run('scripts/db-push.mjs', ['push'])
} else {
  run('scripts/db-push.mjs', ['push', '--dry-run'])
  console.info('dry-run 结束。确认后加 --execute 才会删除 OSS 并执行迁移。')
}
