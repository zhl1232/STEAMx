#!/usr/bin/env node
/**
 * 审计 public schema 所有函数的 search_path 现状与"空 search_path 安全性"。
 *
 * 只读：不修改任何数据库对象。通过 Supabase pg-meta API（/pg/query）查询。
 *
 * 产出：
 *   1. 每个函数当前的 search_path 配置（来自 proconfig）
 *   2. 函数体内是否存在对 public 表/视图的"未全限定"引用
 *      （即写成 `profiles` 而非 `public.profiles` —— 改成 search_path='' 后会运行时报错）
 *   3. 汇总：哪些函数可安全改 ''、哪些需先重写
 *
 * 用法: node scripts/audit-function-search-path.mjs
 * 环境变量（从 .env.local 自动读取，同 db-push.mjs）:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

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
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* rely on existing env */
  }
}
await loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function die(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}
if (!SUPABASE_URL) die("NEXT_PUBLIC_SUPABASE_URL 未设置");
if (!SERVICE_KEY) die("SUPABASE_SERVICE_ROLE_KEY 未设置");

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
  if (data && !Array.isArray(data) && data.error) throw new Error(data.error);
  if (Array.isArray(data)) {
    for (const item of data) if (item?.error) throw new Error(item.error);
    return data;
  }
  return data ?? [];
}

// ── 1. 拉 public schema 所有表/视图名（用于检测 unqualified 引用） ──
const relationsRows = await execSQL(`
  SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public'
  UNION ALL
  SELECT viewname AS name FROM pg_views WHERE schemaname = 'public'
`);
const publicRelations = new Set(
  relationsRows.map((r) => r.name).filter(Boolean)
);
console.log(`\npublic 表/视图共 ${publicRelations.size} 个，用于 unqualified 引用检测。\n`);

// ── 2. 拉 public schema 所有 routine 定义 ──
const fnRows = await execSQL(`
  SELECT
    p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS args,
    pg_get_functiondef(p.oid) AS definition,
    COALESCE(p.proconfig, ARRAY[]::text[]) AS config,
    p.prokind AS kind,
    p.prosecdef AS security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind IN ('f','p')
  ORDER BY p.proname;
`);

// ── 3. 分析每个函数 ──
// 检测函数体里对 public 表/视图的 unqualified 引用。
// 思路：对每个 public 关系名 name，在定义文本里查找该名字作为"关系引用"出现
//       但前面没有 "." 的位置（即不是 schema.name 形式）。
//       进一步用关系引用关键字上下文收紧，降低误报。
const RELATION_KEYWORDS =
  /\b(?:FROM|UPDATE|INSERT\s+INTO|DELETE\s+FROM|JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN)\b/gi;

function findUnqualifiedReferences(definition, relNames) {
  const text = definition;
  const findings = new Map(); // relName -> [{line, snippet}]

  for (const rel of relNames) {
    // 跳过太短或易误命中关键字的名字
    if (rel.length < 3) continue;
    // 匹配作为标识符的 rel：前后需为标识符边界
    // 标识符边界：非 [A-Za-z0-9_."]
    const idBoundary = (ch) => !/[A-Za-z0-9_."]/.test(ch);
    // 用全局正则找所有出现位置
    const re = new RegExp(
      `(?<![A-Za-z0-9_."])${rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_])`,
      "g"
    );
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + rel.length;
      // 前一个非空白字符若是 '.'，说明是 schema.name，跳过
      let i = start - 1;
      while (i >= 0 && /\s/.test(text[i])) i--;
      if (i >= 0 && text[i] === ".") continue;
      // 必须出现在关系引用关键字上下文里，否则可能是变量/列名，跳过
      // 取当前行
      const lineStart = text.lastIndexOf("\n", start) + 1;
      const lineEnd = text.indexOf("\n", end);
      const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      if (!RELATION_KEYWORDS.test(line)) continue;
      RELATION_KEYWORDS.lastIndex = 0; // reset
      // 排除明显是函数调用 / 子查询别名开头：rel 后紧跟 "(" 视为函数
      const after = text.slice(end, end + 1);
      if (after === "(") continue;
      const key = rel;
      if (!findings.has(key)) findings.set(key, []);
      findings.get(key).push({
        line: text.slice(0, start).split("\n").length,
        snippet: line.trim(),
      });
    }
  }
  return findings;
}

function currentSearchPath(config) {
  if (!Array.isArray(config)) return null;
  for (const cfg of config) {
    if (cfg.startsWith("search_path=")) {
      // Postgres 在 proconfig 里存储空字符串值时会带引号，
      // 例如 `search_path=""`（ALTER ROUTINE ... SET search_path = '' 后的实际存储形式）。
      // 去掉包裹引号，让空串被正确识别为 ''。
      let v = cfg.slice("search_path=".length);
      if (v.length >= 2 && v[0] === v[v.length - 1] && (v[0] === '"' || v[0] === "'")) {
        v = v.slice(1, -1);
      }
      return v;
    }
  }
  return null; // 未设置
}

const report = [];
for (const row of fnRows) {
  const sp = currentSearchPath(row.config);
  const findings = findUnqualifiedReferences(row.definition, publicRelations);
  report.push({
    name: row.name,
    args: row.args,
    kind: row.kind,
    security_definer: row.security_definer,
    current_search_path: sp,
    unqualified: [...findings.entries()].map(([rel, hits]) => ({
      relation: rel,
      hits,
    })),
  });
}

// ── 4. 输出 ──
const total = report.length;
const emptySp = report.filter((r) => r.current_search_path === "").length;
const publicSp = report.filter((r) => r.current_search_path === "public").length;
const noSp = report.filter((r) => r.current_search_path === null).length;
const otherSp = report.filter(
  (r) =>
    r.current_search_path !== null &&
    r.current_search_path !== "" &&
    r.current_search_path !== "public"
).length;
const withUnqualified = report.filter((r) => r.unqualified.length > 0);

console.log("══════════════════════════════════════════════════");
console.log(" search_path 现状汇总");
console.log("══════════════════════════════════════════════════");
console.log(`  public schema routine 总数 : ${total}`);
console.log(`  search_path = ''           : ${emptySp}`);
console.log(`  search_path = public       : ${publicSp}`);
console.log(`  search_path = 其他         : ${otherSp}`);
console.log(`  search_path 未设置         : ${noSp}`);
console.log("");

console.log("══════════════════════════════════════════════════");
console.log(` unqualified 引用检测（会阻碍改成 search_path=''）`);
console.log("══════════════════════════════════════════════════");
if (withUnqualified.length === 0) {
  console.log("  ✓ 未发现任何函数体内存在对 public 表/视图的未全限定引用。");
  console.log("    全部 routine 可安全 ALTER SET search_path = ''。");
} else {
  console.log(`  ⚠ ${withUnqualified.length} 个函数存在 unqualified 引用，改 '' 前需先重写：\n`);
  for (const r of withUnqualified) {
    console.log(
      `  • ${r.name}(${r.args})  [当前 search_path=${r.current_search_path ?? "未设置"}${r.security_definer ? ", SECURITY DEFINER" : ""}]`
    );
    for (const u of r.unqualified) {
      for (const hit of u.hits) {
        console.log(`      L${hit.line}: ${hit.snippet}`);
      }
    }
    console.log("");
  }
}
console.log("");

// 列出所有 routine 概览（name + 当前 search_path + 是否安全）
console.log("══════════════════════════════════════════════════");
console.log(" 全部 routine 概览");
console.log("══════════════════════════════════════════════════");
const pad = (s, n) => String(s).padEnd(n);
console.log(`  ${pad("name", 46)} ${pad("search_path", 14)} safe-for-empty`);
for (const r of report) {
  const safe = r.unqualified.length === 0 ? "✓ yes" : "✗ no";
  const sp = r.current_search_path ?? "(unset)";
  console.log(`  ${pad(r.name, 46)} ${pad(sp, 14)} ${safe}`);
}
console.log("");

// JSON 落盘可选
const outPath = join(process.cwd(), "scripts", "_audit-function-search-path.json");
import { writeFile } from "node:fs/promises";
await writeFile(outPath, JSON.stringify(report, null, 2));
console.log(`详细 JSON 报告已写入: ${outPath}\n`);
