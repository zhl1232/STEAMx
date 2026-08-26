#!/usr/bin/env node
/**
 * Generate rules_v1 candidates. Dry-run is the default.
 *
 * Usage:
 *   node scripts/content-classification-candidates.mjs --dry-run
 *   node scripts/content-classification-candidates.mjs --apply-candidates
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildCandidate,
  rowToCandidateSource,
} from "./lib/content-classification-candidates.mjs";

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
const apply = args.includes("--apply-candidates");
const typeArg = args.find((arg) => arg.startsWith("--type="))?.slice("--type=".length) || "all";
const outputPath = args.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
const types = typeArg === "all" ? ["course", "project", "challenge"] : [typeArg];
if (!types.every((type) => ["course", "project", "challenge"].includes(type))) {
  console.error("--type must be course, project, challenge or all");
  process.exit(1);
}

async function request(path, options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

const tableByType = {
  course: "courses",
  project: "projects",
  challenge: "challenges",
};

async function fetchContentRows(type) {
  const rows = await request(`/rest/v1/${tableByType[type]}?select=*&order=id.asc`);
  return Array.isArray(rows) ? rows : [];
}

function buildInFilter(ids) {
  return `in.(${ids.join(",")})`;
}

async function enrichCandidateRows(type, rows) {
  const ids = rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return rows;

  if (type === "project") {
    const filter = encodeURIComponent(buildInFilter(ids));
    const [materials, steps] = await Promise.all([
      request(`/rest/v1/project_materials?select=project_id,material,sort_order&project_id=${filter}&order=sort_order.asc`),
      request(`/rest/v1/project_steps?select=project_id,title,description,image_url,sort_order&project_id=${filter}&order=sort_order.asc`),
    ]);
    const materialsByProject = new Map();
    const stepsByProject = new Map();
    for (const material of materials || []) {
      const bucket = materialsByProject.get(material.project_id) || [];
      bucket.push(material);
      materialsByProject.set(material.project_id, bucket);
    }
    for (const step of steps || []) {
      const bucket = stepsByProject.get(step.project_id) || [];
      bucket.push(step);
      stepsByProject.set(step.project_id, bucket);
    }
    return rows.map((row) => ({
      ...row,
      project_materials: materialsByProject.get(row.id) || [],
      project_steps: stepsByProject.get(row.id) || [],
      materials: (materialsByProject.get(row.id) || []).map((item) => item.material),
      steps: stepsByProject.get(row.id) || [],
    }));
  }

  if (type === "course") {
    const filter = encodeURIComponent(buildInFilter(ids));
    const lessons = await request(
      `/rest/v1/course_lessons?select=course_id,id,title,content,steps,resources,duration_minutes&course_id=${filter}&order=sort_order.asc,id.asc`,
    );
    const lessonsByCourse = new Map();
    for (const lesson of lessons || []) {
      const bucket = lessonsByCourse.get(lesson.course_id) || [];
      bucket.push(lesson);
      lessonsByCourse.set(lesson.course_id, bucket);
    }
    return rows.map((row) => ({
      ...row,
      course_lessons: lessonsByCourse.get(row.id) || [],
    }));
  }

  return rows;
}

let classificationSchemaReady = true;
try {
  await request("/rest/v1/content_classification_settings?select=id&limit=1");
} catch {
  classificationSchemaReady = false;
}

if (apply && !classificationSchemaReady) {
  console.error("Content classification migration is not applied; --apply-candidates cannot write candidates.");
  process.exit(1);
}

const results = [];
for (const type of types) {
  const rows = await enrichCandidateRows(type, await fetchContentRows(type));
  for (const row of rows || []) {
    if (row.classification_source === "manual") {
      results.push({ contentType: type, id: row.id, title: row.title, action: "skip_manual", candidate: null });
      continue;
    }

    const candidate = buildCandidate(rowToCandidateSource(row));
    const same = row.classification_source === "rules_v1"
      && row.recommended_min_age === candidate.recommendedMinAge
      && row.recommended_max_age === candidate.recommendedMaxAge
      && row.support_level === candidate.supportLevel;
    if (same) {
      results.push({ contentType: type, id: row.id, title: row.title, action: "skip_unchanged", candidate });
      continue;
    }

    const result = {
      contentType: type,
      id: row.id,
      title: row.title,
      action: apply ? "candidate_applied" : "dry_run",
      old: {
        recommendedMinAge: row.recommended_min_age,
        recommendedMaxAge: row.recommended_max_age,
        supportLevel: row.support_level,
        source: row.classification_source,
        status: row.classification_status,
      },
      candidate,
    };

    if (apply) {
      const rpcResult = await request(`/rest/v1/rpc/set_content_classification_candidate`, {
        method: "POST",
        body: JSON.stringify({
          p_content_type: type,
          p_content_id: row.id,
          p_min_age: candidate.recommendedMinAge,
          p_max_age: candidate.recommendedMaxAge,
          p_support_level: candidate.supportLevel,
        }),
      });
      result.rpcResult = rpcResult;
    }
    results.push(result);
  }
}

if (outputPath) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({
  dryRun: !apply,
  applied: apply,
  classificationSchemaReady,
  total: results.length,
  changed: results.filter((result) => ["dry_run", "candidate_applied"].includes(result.action)).length,
  skippedManual: results.filter((result) => result.action === "skip_manual").length,
  skippedUnchanged: results.filter((result) => result.action === "skip_unchanged").length,
  results,
}, null, 2));
