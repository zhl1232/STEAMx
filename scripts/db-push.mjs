#!/usr/bin/env node
/**
 * 数据库迁移工具 —— 替代 `supabase db push`
 * 通过 Supabase pg-meta API（/pg/query）执行 SQL，与 Dashboard SQL 编辑器同源。
 *
 * 用法:
 *   pnpm db:push              应用所有待执行的迁移
 *   pnpm db:status            查看迁移状态（哪些已执行、哪些待执行）
 *   pnpm db:baseline          将所有现有迁移标记为"已执行"（首次接入时使用）
 *   pnpm db:push -- --dry-run 仅预览，不实际执行
 *
 * 环境变量（从 .env.local 自动读取）:
 *   NEXT_PUBLIC_SUPABASE_URL   Supabase 项目 URL
 *   SUPABASE_SERVICE_ROLE_KEY  Service Role Key（在 Dashboard → API 中查找）
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "node:process";

// ── Load .env.local ──────────────────────────────────

async function loadEnv() {
  try {
    const content = await readFile(join(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env.local 不存在也无妨，靠已有环境变量
  }
}

await loadEnv();

// ── Config ───────────────────────────────────────────

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const TRACKING_TABLE = "_schema_migrations";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith("-")) || "push";
const dryRun = args.includes("--dry-run");
const verbose = args.includes("--verbose") || args.includes("-v");

// ── Helpers ──────────────────────────────────────────

function die(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}
function ok(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}
function info(msg) {
  console.log(`  ${msg}`);
}
function warn(msg) {
  console.log(`\x1b[33m⚠ ${msg}\x1b[0m`);
}
function dim(msg) {
  console.log(`\x1b[90m  ${msg}\x1b[0m`);
}

if (!SUPABASE_URL) die("NEXT_PUBLIC_SUPABASE_URL 未设置");
if (!SERVICE_KEY) die("SUPABASE_SERVICE_ROLE_KEY 未设置");

function escapeSqlLiteral(str) {
  return str.replace(/'/g, "''");
}

// ── SQL execution via pg-meta API ────────────────────

async function execSQL(sql) {
  const resp = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }

  const data = await resp.json();

  // pg-meta 错误处理
  if (data && !Array.isArray(data) && data.error) {
    throw new Error(data.error);
  }

  // pg-meta 返回扁平数组: [{row}, ...] 或 [] (DDL / empty result)
  // 检查数组内是否有 error 对象
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item?.error) {
        throw new Error(item.error);
      }
    }
    return data;
  }

  return data ?? [];
}

// ── Ensure tracking table ────────────────────────────

async function ensureTrackingTable() {
  await execSQL(`
    CREATE TABLE IF NOT EXISTS public.${TRACKING_TABLE} (
      version    text PRIMARY KEY,
      name       text,
      applied_at timestamptz DEFAULT now()
    );
  `);
}

// ── Read local migration files ───────────────────────

async function getLocalMigrations() {
  let entries;
  try {
    entries = await readdir(MIGRATIONS_DIR);
  } catch {
    die(`迁移目录不存在: ${MIGRATIONS_DIR}`);
  }
  return entries
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({
      file: f,
      version: f.replace(/\.sql$/, ""),
    }));
}

// ── Read applied migrations ──────────────────────────

async function getAppliedVersions() {
  const rows = await execSQL(
    `SELECT version FROM public.${TRACKING_TABLE} ORDER BY version`
  );
  return new Set((rows || []).map((r) => r.version));
}

// ── Commands ─────────────────────────────────────────

async function status() {
  await ensureTrackingTable();
  const local = await getLocalMigrations();
  const applied = await getAppliedVersions();
  const pending = local.filter((m) => !applied.has(m.version));

  console.log(`\n迁移状态 (共 ${local.length} 个文件)\n`);
  for (const m of local) {
    const done = applied.has(m.version);
    console.log(
      `  ${done ? "\x1b[32m✓\x1b[0m" : "\x1b[33m○\x1b[0m"} ${m.file}`
    );
  }
  console.log(`\n  已执行: ${applied.size}  |  待执行: ${pending.length}\n`);
  return pending;
}

async function push() {
  await ensureTrackingTable();
  const local = await getLocalMigrations();
  const applied = await getAppliedVersions();
  const pending = local.filter((m) => !applied.has(m.version));

  if (pending.length === 0) {
    ok("所有迁移均已执行，无待处理。");
    return;
  }

  console.log(
    `\n待执行 ${pending.length} 个迁移${dryRun ? " (dry-run 模式)" : ""}:\n`
  );
  for (const m of pending) {
    info(`○ ${m.file}`);
  }
  console.log();

  if (dryRun) {
    warn("dry-run 模式，不会实际执行。");
    return;
  }

  let appliedCount = 0;
  for (const m of pending) {
    const content = await readFile(join(MIGRATIONS_DIR, m.file), "utf8");
    const trimmed = content.trim();
    if (!trimmed) {
      warn(`跳过空文件: ${m.file}`);
      await execSQL(
        `INSERT INTO public.${TRACKING_TABLE} (version, name)
         VALUES ('${escapeSqlLiteral(m.version)}', '${escapeSqlLiteral(m.file)}')
         ON CONFLICT (version) DO NOTHING;`
      );
      continue;
    }

    process.stdout.write(`  执行 ${m.file} ...`);
    const start = performance.now();

    try {
      // pg-meta 默认包裹事务，直接发送整个 SQL 文件内容
      await execSQL(trimmed);
      // 记录已执行
      await execSQL(
        `INSERT INTO public.${TRACKING_TABLE} (version, name)
         VALUES ('${escapeSqlLiteral(m.version)}', '${escapeSqlLiteral(m.file)}')
         ON CONFLICT (version) DO NOTHING;`
      );
    } catch (err) {
      console.log();
      die(`执行失败: ${m.file}\n  ${err.message}`);
    }

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    console.log(` \x1b[32m✓\x1b[0m (${elapsed}s)`);
    appliedCount++;
  }

  console.log();
  ok(`成功执行 ${appliedCount} 个迁移。`);
}

async function baseline() {
  await ensureTrackingTable();
  const local = await getLocalMigrations();
  const applied = await getAppliedVersions();
  const toMark = local.filter((m) => !applied.has(m.version));

  if (toMark.length === 0) {
    ok("所有迁移已标记，无需操作。");
    return;
  }

  console.log(
    `\n将 ${toMark.length} 个迁移标记为已执行（不实际运行 SQL）:\n`
  );

  const values = toMark
    .map((m) => `('${escapeSqlLiteral(m.version)}', '${escapeSqlLiteral(m.file)}')`)
    .join(",\n    ");
  await execSQL(
    `INSERT INTO public.${TRACKING_TABLE} (version, name)
     VALUES ${values}
     ON CONFLICT (version) DO NOTHING;`
  );

  for (const m of toMark) {
    ok(m.file);
  }

  console.log();
  ok(`已标记 ${toMark.length} 个迁移为 baseline。`);
}

// ── Main ─────────────────────────────────────────────

try {
  const rows = await execSQL("SELECT version() as v");
  const ver = rows?.[0]?.v || rows?.[0]?.version || "PostgreSQL";
  dim(`连接成功: ${ver.split(",")[0]}`);

  switch (command) {
    case "push":
      await push();
      break;
    case "status":
      await status();
      break;
    case "baseline":
      await baseline();
      break;
    default:
      die(`未知命令: ${command}\n  可用: push | status | baseline`);
  }
} catch (err) {
  die(err.message);
}
