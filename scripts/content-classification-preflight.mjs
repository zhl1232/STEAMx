#!/usr/bin/env node
/**
 * Content classification phase 0 preflight. Read-only by design.
 *
 * Usage:
 *   node scripts/content-classification-preflight.mjs --type=all
 *   node scripts/content-classification-preflight.mjs --type=project --json
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
const typeArg = args.find((arg) => arg.startsWith("--type="))?.slice("--type=".length) || "all";
const jsonOutput = args.includes("--json");
const allowedTypes = new Set(["course", "project", "challenge"]);
const types = typeArg === "all" ? ["course", "project", "challenge"] : [typeArg];
if (!types.every((type) => allowedTypes.has(type))) {
  console.error("--type must be course, project, challenge or all");
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

const schemaRows = await query(`
  SELECT count(*) = 8 AS classification_fields_ready
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'courses'
     AND column_name IN (
       'recommended_min_age', 'recommended_max_age', 'support_level',
       'classification_status', 'classification_source',
       'classification_reviewed_at', 'classification_reviewed_by',
       'classification_revision'
     );
`);
const schemaReadyValue = schemaRows[0]?.classification_fields_ready;
const schemaReady = schemaReadyValue === true || schemaReadyValue === 1 || schemaReadyValue === "t" || schemaReadyValue === "true";

function classificationProjection(alias) {
  if (schemaReady) {
    return `
      ${alias}.recommended_min_age, ${alias}.recommended_max_age, ${alias}.support_level,
      ${alias}.classification_status, ${alias}.classification_source,
      ${alias}.classification_reviewed_at, ${alias}.classification_reviewed_by,
      ${alias}.classification_revision,
    `;
  }

  return `
      NULL::smallint AS recommended_min_age, NULL::smallint AS recommended_max_age,
      NULL::text AS support_level, 'unreviewed'::text AS classification_status,
      NULL::text AS classification_source, NULL::timestamptz AS classification_reviewed_at,
      NULL::uuid AS classification_reviewed_by, 0::bigint AS classification_revision,
  `;
}

const queries = {
  course: `
    SELECT
      c.id, c.title, c.description, c.tags, c.difficulty_stars,
      ${classificationProjection("c")}
      c.status,
      COALESCE((SELECT count(*)::int FROM public.course_lessons cl WHERE cl.course_id = c.id), 0) AS lesson_count,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'title', cl.title, 'content', cl.content, 'steps', cl.steps, 'resources', cl.resources
      ) ORDER BY cl.sort_order, cl.id) FROM public.course_lessons cl WHERE cl.course_id = c.id), '[]'::jsonb) AS course_lessons
    FROM public.courses c
    ORDER BY c.id;
  `,
  project: `
    SELECT
      p.id, p.title, p.description, p.tags, p.difficulty, p.difficulty_stars,
      ${classificationProjection("p")}
      p.status, p.moderation_state,
      COALESCE((SELECT jsonb_agg(pm.material ORDER BY pm.sort_order) FROM public.project_materials pm WHERE pm.project_id = p.id), '[]'::jsonb) AS materials,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('title', ps.title, 'description', ps.description) ORDER BY ps.sort_order) FROM public.project_steps ps WHERE ps.project_id = p.id), '[]'::jsonb) AS steps
    FROM public.projects p
    ORDER BY p.id;
  `,
  challenge: `
    SELECT
      c.id, c.title, c.description, c.tags, c.scenario, c.driving_question,
      c.expected_outcome, c.constraints, c.resources, c.stages, c.difficulty_stars,
      ${classificationProjection("c")}
      c.status
    FROM public.challenges c
    ORDER BY c.id;
  `,
};

function isPublished(type, row) {
  if (type === "course") return row.status === "approved";
  if (type === "project") return row.status === "approved" && row.moderation_state === "approved";
  return row.status === "active" || row.status === "ended";
}

function isDifficultyValid(row) {
  return Number.isInteger(row.difficulty_stars) && row.difficulty_stars >= 1 && row.difficulty_stars <= 6;
}

function isClassificationComplete(row) {
  return row.classification_status === "reviewed"
    && Number.isInteger(row.recommended_min_age)
    && row.recommended_min_age >= 3
    && row.recommended_min_age <= 16
    && (row.recommended_max_age === null || (Number.isInteger(row.recommended_max_age) && row.recommended_max_age >= row.recommended_min_age && row.recommended_max_age <= 16))
    && ["independent", "guided", "adult_required"].includes(row.support_level)
    && isDifficultyValid(row)
    && row.classification_source === "manual"
    && Boolean(row.classification_reviewed_at)
    && Boolean(row.classification_reviewed_by);
}

function hasUnreadableProjectContent(row) {
  return row.description == null && (!Array.isArray(row.materials) || row.materials.length === 0) && (!Array.isArray(row.steps) || row.steps.length === 0);
}

const report = {
  generatedAt: new Date().toISOString(),
  readOnly: true,
  classificationSchemaReady: schemaReady,
  types: {},
  totals: {
    total: 0,
    published: 0,
    publishedUnreviewed: 0,
    publishedIncomplete: 0,
    invalidDifficulty: 0,
    invalidAge: 0,
    safetyFlagged: 0,
    lowConfidenceCandidates: 0,
    unreadableContent: 0,
    courseInheritanceConflicts: 0,
  },
};

for (const type of types) {
  const rows = await query(queries[type]);
  const summary = {
    total: rows.length,
    published: 0,
    publishedUnreviewed: 0,
    publishedIncomplete: 0,
    invalidDifficulty: 0,
    invalidAge: 0,
    safetyFlagged: 0,
    lowConfidenceCandidates: 0,
    unreadableContent: 0,
    candidateExamples: [],
  };

  for (const row of rows) {
    const published = isPublished(type, row);
    const candidate = buildCandidate(rowToCandidateSource(row));
    const classificationComplete = isClassificationComplete(row);
    const invalidAge = row.recommended_min_age !== null && (
      !Number.isInteger(row.recommended_min_age) || row.recommended_min_age < 3 || row.recommended_min_age > 16
      || (row.recommended_max_age !== null && (!Number.isInteger(row.recommended_max_age) || row.recommended_max_age < row.recommended_min_age || row.recommended_max_age > 16))
    );
    const unreadable = type === "project" && hasUnreadableProjectContent(row);

    if (published) summary.published += 1;
    if (published && row.classification_status !== "reviewed") summary.publishedUnreviewed += 1;
    if (published && !classificationComplete) summary.publishedIncomplete += 1;
    if (!isDifficultyValid(row)) summary.invalidDifficulty += 1;
    if (invalidAge) summary.invalidAge += 1;
    if (candidate.safetyKeywords.length > 0) summary.safetyFlagged += 1;
    if (candidate.confidence === "low") summary.lowConfidenceCandidates += 1;
    if (unreadable) summary.unreadableContent += 1;
    if (summary.candidateExamples.length < 5 && (candidate.confidence === "low" || candidate.safetyKeywords.length > 0)) {
      summary.candidateExamples.push({
        id: row.id,
        title: row.title,
        confidence: candidate.confidence,
        matchedRules: candidate.matchedRules,
        safetyKeywords: candidate.safetyKeywords,
      });
    }

    report.totals.published += Number(published);
    report.totals.publishedUnreviewed += Number(published && row.classification_status !== "reviewed");
    report.totals.publishedIncomplete += Number(published && !classificationComplete);
    report.totals.invalidDifficulty += Number(!isDifficultyValid(row));
    report.totals.invalidAge += Number(Boolean(invalidAge));
    report.totals.safetyFlagged += Number(candidate.safetyKeywords.length > 0);
    report.totals.lowConfidenceCandidates += Number(candidate.confidence === "low");
    report.totals.unreadableContent += Number(unreadable);
  }

  report.totals.total += rows.length;
  report.types[type] = summary;
}

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Content classification preflight (${report.generatedAt})`);
  console.log(`- classification_schema_ready=${report.classificationSchemaReady}`);
  for (const [type, summary] of Object.entries(report.types)) {
    console.log(`- ${type}: total=${summary.total}, published=${summary.published}, published_unreviewed=${summary.publishedUnreviewed}, published_incomplete=${summary.publishedIncomplete}, invalid_difficulty=${summary.invalidDifficulty}, safety_flags=${summary.safetyFlagged}, low_confidence=${summary.lowConfidenceCandidates}`);
  }
  console.log(`Totals: total=${report.totals.total}, published=${report.totals.published}, published_unreviewed=${report.totals.publishedUnreviewed}, published_incomplete=${report.totals.publishedIncomplete}, invalid_difficulty=${report.totals.invalidDifficulty}, invalid_age=${report.totals.invalidAge}, safety_flags=${report.totals.safetyFlagged}, unreadable=${report.totals.unreadableContent}`);
  console.log("No database writes were performed.");
}

process.exitCode = report.totals.invalidDifficulty > 0 ? 2 : 0;
