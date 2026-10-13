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
 * OSS 凭证缺失时记录失败，仍继续执行迁移。
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
  return result.status ?? 1
}

console.info(`内容分诊线上应用（${execute ? 'EXECUTE' : 'dry-run'}）`)
console.info('顺序：先 OSS（库行还在），再 db:push。')

let ossStatus = run('scripts/purge-triaged-project-assets.mjs', [])
if (execute) {
  const executeStatus = run('scripts/purge-triaged-project-assets.mjs', ['--execute'])
  if (executeStatus !== 0) {
    console.error('OSS --execute 失败（常见原因：.env.production 没有 ALIYUN_OSS_*）。继续 db:push。')
    ossStatus = executeStatus
  } else if (ossStatus === 0) {
    ossStatus = 0
  }
} else {
  run('scripts/db-push.mjs', ['push', '--dry-run'])
  console.info('dry-run 结束。确认后加 --execute 才会删除 OSS 并执行迁移。')
  process.exit(ossStatus)
}

const dbStatus = run('scripts/db-push.mjs', ['push'])
if (dbStatus !== 0) process.exit(dbStatus)
if (ossStatus !== 0) {
  console.error('迁移已执行。OSS 未删干净，需要补齐 ALIYUN_OSS_* 后再跑 purge --execute。')
}
