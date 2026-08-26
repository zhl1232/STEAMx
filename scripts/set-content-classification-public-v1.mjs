#!/usr/bin/env node
/**
 * Enable or disable the public three-axis DTO without changing the publish gate.
 *
 * Usage:
 *   node scripts/set-content-classification-public-v1.mjs --enable --reason="公开已复核内容的三轴标签"
 *   node scripts/set-content-classification-public-v1.mjs --disable --reason="回滚公开三轴展示"
 *   --actor-id can be supplied to avoid selecting the first admin account.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function loadEnv() {
  try {
    const content = await readFile(join(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 0) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^"|"$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Environment variables may already be supplied by CI/deployment.
  }
}

await loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const enable = args.includes("--enable");
const disable = args.includes("--disable");
const reason = args.find((arg) => arg.startsWith("--reason="))?.slice("--reason=".length).trim();
const explicitActorId = args.find((arg) => arg.startsWith("--actor-id="))?.slice("--actor-id=".length).trim();

if (enable === disable || !reason) {
  console.error("Usage: --enable|--disable --reason=\"...\" [--actor-id=UUID]");
  process.exit(1);
}

async function query(sql) {
  const response = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`Supabase HTTP ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  if (Array.isArray(data)) {
    const error = data.find((item) => item?.error);
    if (error) throw new Error(error.error);
  }
  return data;
}

function escapeSqlLiteral(value) {
  return value.replaceAll("'", "''");
}

const actorRows = explicitActorId
  ? [{ id: explicitActorId }]
  : await query("SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
const actorId = actorRows[0]?.id;

if (!actorId) {
  console.error("No admin actor found; pass --actor-id=UUID explicitly.");
  process.exit(1);
}

const result = await query(`
  BEGIN;
  SET LOCAL request.jwt.claim.role = 'service_role';
  SELECT public.set_content_classification_public_v1(
    ${enable},
    '${escapeSqlLiteral(actorId)}'::uuid,
    '${escapeSqlLiteral(reason)}'
  );
  COMMIT;
`);

console.log(JSON.stringify(result?.find?.((row) => row?.set_content_classification_public_v1) ?? result, null, 2));
