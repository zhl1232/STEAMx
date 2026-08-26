#!/usr/bin/env node
/**
 * Restore enforcement after an emergency TTL expires.
 * Default is read-only; pass --apply to perform the guarded transaction.
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
    // Environment variables may already be supplied by the scheduler.
  }
}

await loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const apply = process.argv.includes("--apply");

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
  if (!response.ok) throw new Error(`pg-meta HTTP ${response.status}: ${await response.text()}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(`Unexpected pg-meta response: ${JSON.stringify(data)}`);
  const error = data.find((item) => item?.error);
  if (error) throw new Error(error.error);
  return data;
}

const rows = await query(`
  SELECT id, enforcement_enabled, enforcement_expires_at, emergency_reason
    FROM public.content_classification_settings
   WHERE id = true;
`);
const settings = rows[0];
if (!settings) throw new Error("content_classification_settings row is missing");

const expired = settings.enforcement_expires_at && Date.parse(settings.enforcement_expires_at) <= Date.now();
const shouldRestore = expired && (settings.enforcement_enabled === false || settings.emergency_reason !== null);

if (!shouldRestore) {
  console.log(JSON.stringify({ healthy: true, apply, expired: Boolean(expired), restored: false, enforcementEnabled: settings.enforcement_enabled }));
  process.exit(0);
}

if (!apply) {
  console.log(JSON.stringify({ healthy: false, apply: false, expired: true, restored: false, action: "would_restore_enforcement" }));
  process.exit(2);
}

await query(`
  BEGIN;
  SELECT pg_advisory_xact_lock(hashtext('content-classification-rollout'));
  UPDATE public.content_classification_settings
     SET enforcement_enabled = true,
         emergency_reason = NULL,
         emergency_actor_id = NULL,
         enforcement_expires_at = NULL,
         updated_at = now(),
         updated_by = NULL
   WHERE id = true
     AND enforcement_expires_at IS NOT NULL
     AND enforcement_expires_at <= now();
  INSERT INTO public.content_classification_rollout_events (
    event_type, actor_type, reason
  ) VALUES (
    'auto_restored', 'system', 'content-classification-watchdog'
  );
  COMMIT;
`);

console.log(JSON.stringify({ healthy: true, apply: true, expired: true, restored: true }));
