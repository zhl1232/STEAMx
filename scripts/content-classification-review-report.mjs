#!/usr/bin/env node
/**
 * Export the review queue without exposing user/birthday data.
 *
 * Usage:
 *   node scripts/content-classification-review-report.mjs --status=unreviewed --format=csv
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildCandidate, rowToCandidateSource } from "./lib/content-classification-candidates.mjs";

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
const statusFilter = args.find((arg) => arg.startsWith("--status="))?.slice("--status=".length) || "unreviewed";
const format = args.find((arg) => arg.startsWith("--format="))?.slice("--format=".length) || "json";
const typeArg = args.find((arg) => arg.startsWith("--type="))?.slice("--type=".length) || "all";
const types = typeArg === "all" ? ["course", "project", "challenge"] : [typeArg];
if (!["all", "unreviewed", "reviewed"].includes(statusFilter) || !["json", "csv"].includes(format) || !types.every((type) => ["course", "project", "challenge"].includes(type))) {
  console.error("Usage: --status=unreviewed|reviewed|all --format=json|csv --type=course|project|challenge|all");
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
  if (!response.ok) throw new Error(`pg-meta HTTP ${response.status}: ${await response.text()}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(`Unexpected pg-meta response: ${JSON.stringify(data)}`);
  const error = data.find((item) => item?.error);
  if (error) throw new Error(error.error);
  return data;
}

const queries = {
  course: "SELECT id,title,description,tags,difficulty_stars,recommended_min_age,recommended_max_age,support_level,classification_status,classification_source,classification_revision,status FROM public.courses ORDER BY id",
  project: "SELECT id,title,description,tags,difficulty,difficulty_stars,recommended_min_age,recommended_max_age,support_level,classification_status,classification_source,classification_revision,status,moderation_state FROM public.projects ORDER BY id",
  challenge: "SELECT id,title,description,tags,scenario,driving_question,expected_outcome,constraints,difficulty_stars,recommended_min_age,recommended_max_age,support_level,classification_status,classification_source,classification_revision,status FROM public.challenges ORDER BY id",
};

const records = [];
for (const type of types) {
  const rows = await query(queries[type]);
  for (const row of rows) {
    if (statusFilter !== "all" && row.classification_status !== statusFilter) continue;
    const candidate = buildCandidate(rowToCandidateSource(row));
    records.push({
      contentType: type,
      id: row.id,
      title: row.title,
      status: row.classification_status,
      contentStatus: row.status,
      moderationState: row.moderation_state || "",
      recommendedMinAge: row.recommended_min_age,
      recommendedMaxAge: row.recommended_max_age,
      supportLevel: row.support_level,
      difficultyStars: row.difficulty_stars,
      source: row.classification_source,
      revision: row.classification_revision,
      confidence: candidate.confidence,
      safetyFlag: candidate.safetyKeywords.length > 0,
      safetyKeywordCount: candidate.safetyKeywords.length,
      matchedRules: candidate.matchedRules.join("|"),
    });
  }
}

if (format === "json") {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2));
} else {
  const columns = [
    "contentType", "id", "title", "status", "contentStatus", "moderationState",
    "recommendedMinAge", "recommendedMaxAge", "supportLevel", "difficultyStars",
    "source", "revision", "confidence", "safetyFlag", "safetyKeywordCount", "matchedRules",
  ];
  const csvEscape = (value) => {
    const raw = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
  };
  console.log(columns.join(","));
  for (const record of records) console.log(columns.map((column) => csvEscape(record[column])).join(","));
}
