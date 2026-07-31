#!/usr/bin/env node
/**
 * Read-only preflight for course STEAM configuration.
 * Run after the course configuration migration and before enabling milestones.
 * Pass --validate only after the report is clean to validate the NOT VALID
 * database constraints explicitly.
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
      const value = trimmed.slice(separator + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Existing process environment is sufficient in CI.
  }
}

await loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const invalidConfigQuery = `
      SELECT id, title, difficulty_stars, steam_weights
      FROM public.courses
      WHERE status = 'approved'
        AND NOT public.is_valid_course_steam_config(steam_weights, difficulty_stars)
      ORDER BY id;
    `;

const response = await fetch(`${url}/pg/query`, {
  method: "POST",
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: invalidConfigQuery }),
});

if (!response.ok) {
  throw new Error(`pg-meta returned HTTP ${response.status}: ${await response.text()}`);
}

const rows = await response.json();
if (!Array.isArray(rows)) {
  throw new Error(`Unexpected pg-meta response: ${JSON.stringify(rows)}`);
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 2));
} else if (rows.length === 0) {
  console.log("Course STEAM preflight passed: no invalid approved course configuration.");
} else {
  console.log(`Found ${rows.length} approved course configuration problem(s):`);
  for (const row of rows) {
    console.log(`- #${row.id} ${row.title}: difficulty=${row.difficulty_stars}, weights=${JSON.stringify(row.steam_weights)}`);
  }
}

if (rows.length > 0) {
  process.exitCode = 2;
} else if (process.argv.includes("--validate")) {
  const validateResponse = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        ALTER TABLE public.courses
          VALIDATE CONSTRAINT courses_steam_weights_valid;
        ALTER TABLE public.user_course_completions
          VALIDATE CONSTRAINT user_course_completions_steam_config_valid;
      `,
    }),
  });

  if (!validateResponse.ok) {
    throw new Error(`Constraint validation failed (HTTP ${validateResponse.status}): ${await validateResponse.text()}`);
  }
  console.log("Course STEAM constraints validated.");
  process.exitCode = 0;
} else {
  process.exitCode = 0;
}
