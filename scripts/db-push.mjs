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
 *   pnpm db:push -- --only=<完整.sql文件名,完整.sql文件名>
 *     限定发布：完整目录中不得有其他待执行迁移；整批 SQL 与记录原子提交。
 *     限定模式的 --dry-run 真正只读，追踪表缺失时拒绝，不自动初始化。
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

async function execSQL(sql, { timeoutMs } = {}) {
  const resp = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
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

// ── Explicitly scoped release migrations ─────────────

function parseOnlySelection() {
  const flags = args.filter((arg) => arg.startsWith("--only"));
  if (!flags.length) return null;
  if (flags.length !== 1 || !flags[0].startsWith("--only=")) {
    throw new Error("限定迁移必须且只能提供一次 --only=<完整.sql文件名逗号列表>");
  }
  if (command !== "push") throw new Error("--only 只支持 push，不允许 status 或 baseline");
  const supported = new Set(["push", "--", "--dry-run", "--verbose", "-v", flags[0]]);
  const unsupported = args.filter((arg) => !supported.has(arg));
  if (unsupported.length) throw new Error(`限定模式不支持参数: ${unsupported.join(", ")}`);
  const files = flags[0].slice("--only=".length).split(",");
  if (files.some((file) => !/^\d{14}_[A-Za-z0-9_-]+\.sql$/.test(file))) {
    throw new Error("--only 不得为空，且必须使用无路径的完整迁移文件名，不能包含空项");
  }
  if (new Set(files).size !== files.length) throw new Error("--only 不允许重复的迁移文件名");
  return new Set(files);
}

async function readScopedHistory() {
  const relation = await execSQL(
    `SELECT to_regclass('public.${TRACKING_TABLE}')::text AS tracking_table`,
    { timeoutMs: 30_000 },
  );
  if (!Array.isArray(relation) || !relation[0]?.tracking_table) {
    throw new Error("限定迁移要求现有 public._schema_migrations；拒绝创建追踪表或自动 baseline");
  }
  const rows = await execSQL(
    `SELECT version FROM public.${TRACKING_TABLE} ORDER BY version`,
    { timeoutMs: 30_000 },
  );
  if (!Array.isArray(rows) || rows.some((row) => typeof row?.version !== "string" || !row.version)) {
    throw new Error("迁移追踪表返回了无效版本，限定迁移已停止");
  }
  return new Set(rows.map((row) => row.version));
}

// Inspect only outer SQL, not strings, identifiers, comments or function bodies.
// Explicit transaction control would defeat the release batch's single commit.
function assertTransactionSafe(sql, file) {
  let outer = "";
  for (let i = 0; i < sql.length;) {
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i + 2);
      i = end < 0 ? sql.length : end + 1;
      outer += " ";
    } else if (sql.startsWith("/*", i)) {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith("/*", i)) { depth++; i += 2; }
        else if (sql.startsWith("*/", i)) { depth--; i += 2; }
        else i++;
      }
      if (depth) throw new Error(`迁移注释未闭合: ${file}`);
      outer += " ";
    } else if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i];
      const escaped = quote === "'" && /(?:^|[^A-Za-z0-9_$])[eE]$/.test(sql.slice(Math.max(0, i - 2), i));
      i++;
      let closed = false;
      while (i < sql.length) {
        if (escaped && sql[i] === "\\") { i += 2; continue; }
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) { i += 2; continue; }
          i++; closed = true; break;
        }
        i++;
      }
      if (!closed) throw new Error(`迁移引号未闭合: ${file}`);
      outer += " __quoted__ ";
    } else if (sql[i] === "$" && /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.test(sql.slice(i))) {
      const delimiter = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)[0];
      const end = sql.indexOf(delimiter, i + delimiter.length);
      if (end < 0) throw new Error(`迁移函数体未闭合: ${file}`);
      i = end + delimiter.length;
      outer += " __body__ ";
    } else {
      outer += sql[i++];
    }
  }
  const statements = outer.split(";").map((statement) => statement.trim()).filter(Boolean);
  if (!statements.length) throw new Error(`限定迁移不能为空: ${file}`);
  const control = /^(?:BEGIN\b|START\s+TRANSACTION\b|COMMIT\b|END\b|ROLLBACK\b|ABORT\b|SAVEPOINT\b|RELEASE\b|PREPARE\s+TRANSACTION\b|VACUUM\b|ALTER\s+SYSTEM\b|(?:CREATE|DROP)\s+(?:DATABASE|TABLESPACE)\b|DISCARD\b)/i;
  if (statements.some((statement) => control.test(statement) || /\bCONCURRENTLY\b/i.test(statement))) {
    throw new Error(`限定迁移包含事务控制或事务外操作，拒绝执行: ${file}`);
  }
}

function scopedBatchSql(migrations, applied) {
  function quoteBody(value, name) {
    let tag = `$${name}$`;
    while (value.includes(tag)) tag = tag.replace(/\$$/, "x$");
    return `${tag}\n${value}\n${tag}`;
  }
  const versions = [...applied].sort().map((version) => `'${escapeSqlLiteral(version)}'`).join(", ");
  const expected = `ARRAY[${versions}]::text[]`;
  const body = [
    "BEGIN",
    "  PERFORM pg_catalog.set_config('lock_timeout', '10s', true);",
    `  LOCK TABLE public.${TRACKING_TABLE} IN SHARE ROW EXCLUSIVE MODE;`,
    `  IF EXISTS (SELECT version FROM public.${TRACKING_TABLE} EXCEPT SELECT unnest(${expected}))`,
    `     OR EXISTS (SELECT unnest(${expected}) EXCEPT SELECT version FROM public.${TRACKING_TABLE}) THEN`,
    "    RAISE EXCEPTION 'Migration history changed after read-only preflight';",
    "  END IF;",
    ...migrations.map((migration, index) => `  -- Scoped migration: ${migration.file}\n` +
      `  EXECUTE ${quoteBody(migration.sql, `steamx_migration_${index}`)};\n` +
      `  INSERT INTO public.${TRACKING_TABLE} (version, name) VALUES ` +
      `('${escapeSqlLiteral(migration.version)}', '${escapeSqlLiteral(migration.file)}');`),
    "END;",
  ].join("\n");
  // A single top-level statement supplies its own atomic transaction. Do not
  // send BEGIN/COMMIT: an unknown pg-meta pool may leave that connection in an
  // aborted explicit transaction when a migration throws before COMMIT.
  return `DO ${quoteBody(body, "steamx_scoped_batch")};`;
}

async function pushOnly(selection) {
  // Read the complete directory, not a whitelist-only staging directory: this
  // is what lets a release reject unrelated pending migrations and old gaps.
  const local = await getLocalMigrations();
  const unknown = [...selection].filter((file) => !local.some((migration) => migration.file === file));
  if (unknown.length) throw new Error(`--only 包含未知迁移: ${unknown.join(", ")}`);
  const applied = await readScopedHistory();
  const pending = local.filter((migration) => !applied.has(migration.version));
  const unauthorized = pending.filter((migration) => !selection.has(migration.file));
  if (unauthorized.length) {
    throw new Error(`发现 --only 范围外的待执行迁移，未执行任何迁移:\n${unauthorized.map((migration) => migration.file).join("\n")}`);
  }
  if (!pending.length) {
    ok("限定迁移均已执行，无待处理；未写入数据库。");
    return;
  }
  let missingSelected = false;
  for (const migration of local.filter((entry) => selection.has(entry.file))) {
    if (!applied.has(migration.version)) missingSelected = true;
    else if (missingSelected) throw new Error("限定迁移记录顺序不完整：较晚版本已执行而前置版本缺失，未执行任何迁移");
  }
  const migrations = [];
  for (const migration of pending) {
    const sql = (await readFile(join(MIGRATIONS_DIR, migration.file), "utf8")).trim();
    assertTransactionSafe(sql, migration.file);
    migrations.push({ ...migration, sql });
  }
  info(`限定待执行迁移（按文件名顺序，${migrations.length} 项）:`);
  for (const migration of migrations) info(`○ ${migration.file}`);
  if (dryRun) {
    ok("限定 dry-run 完成：仅查询追踪表，未执行迁移 SQL 或创建追踪表。");
    return;
  }
  try {
    await execSQL(scopedBatchSql(migrations, applied), { timeoutMs: 180_000 });
    const confirmed = await readScopedHistory();
    if (migrations.some((migration) => !confirmed.has(migration.version))) {
      throw new Error("执行响应后未查到全部限定迁移记录");
    }
  } catch (error) {
    throw new Error(`限定迁移未确认成功，必须停止应用切换。SQL 执行与记录写入共用一个事务；连接中断或超时可能发生在提交之后，需先只读核验，不能断言数据库未变化。\n${error.message}`);
  }
  ok(`已确认 ${migrations.length} 个限定迁移及追踪记录在单语句事务中提交。`);
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
  const selection = parseOnlySelection();
  if (selection) {
    await pushOnly(selection);
    process.exit(0);
  }
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

