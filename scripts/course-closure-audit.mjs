#!/usr/bin/env node
/**
 * Read-only integrity audit for course progress, completion rewards and STEAM
 * milestones.
 *
 * Usage:
 *   pnpm course:audit
 *   pnpm course:audit -- --json
 *   pnpm course:audit -- --strict
 *
 * The audit intentionally uses the project pg-meta endpoint instead of a
 * direct database connection. It never inserts, updates or deletes data.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { summarizeCourseClosureAudit } from './lib/course-closure-audit.mjs'

const COURSE_MIGRATION_VERSION = '20260731100000_course_progress_rewards_and_steam'
const args = new Set(process.argv.slice(2))
const jsonOutput = args.has('--json')
const strict = args.has('--strict')

async function loadEnv() {
  try {
    const content = await readFile(join(process.cwd(), '.env.local'), 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separator = trimmed.indexOf('=')
      if (separator < 0) continue
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim().replace(/^"|"$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // CI can provide the environment directly.
  }
}

await loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

async function query(sql) {
  const response = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!response.ok) {
    throw new Error(`Supabase pg-meta HTTP ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  if (!Array.isArray(data)) {
    throw new Error(`Unexpected pg-meta response: ${JSON.stringify(data)}`)
  }

  const error = data.find((item) => item?.error)
  if (error) throw new Error(error.error)
  return data
}

function numberValue(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function countValue(row, key) {
  return numberValue(row?.[key])
}

function countRows(rows) {
  return Array.isArray(rows) ? rows.length : 0
}

function ageHours(iso) {
  if (!iso) return null
  const timestamp = Date.parse(iso)
  if (!Number.isFinite(timestamp)) return null
  return Math.max(0, Math.round(((Date.now() - timestamp) / 3_600_000) * 10) / 10)
}

function addFinding(findings, code, severity, rows, summary) {
  if (rows.length === 0) return
  findings.push({ code, severity, count: rows.length, summary, rows })
}

function redactFindingRow(row) {
  const allowedKeys = [
    'course_id',
    'course_title',
    'total_lesson_count',
    'completed_lesson_count',
    'trusted_lesson_count',
    'last_completed_at',
    'completion_id',
    'project_id',
    'course_lesson_id',
    'expected_action_type',
    'expected_resource_id',
    'id',
    'action_type',
    'resource_id',
    'xp_amount',
    'reward_count',
    'count',
    'conname',
    'convalidated',
    'index_name',
    'migration',
    'deadlocks',
    'total_rows',
    'post_cutover_rows',
    'cutover_at',
  ]
  return Object.fromEntries(
    allowedKeys
      .filter((key) => row && Object.prototype.hasOwnProperty.call(row, key))
      .map((key) => [key, row[key]]),
  )
}

const migrationRows = await query(`
  SELECT version, applied_at
  FROM public._schema_migrations
  WHERE version = '${COURSE_MIGRATION_VERSION}'
  LIMIT 1;
`)
const migration = migrationRows[0] ?? null

const [
  invalidCourseConfigs,
  emptyApprovedCourses,
  constraintRows,
  progressSummaryRows,
  databaseRows,
  indexRows,
] =
  await Promise.all([
    query(`
      SELECT id AS course_id, title, difficulty_stars, steam_weights
      FROM public.courses
      WHERE status = 'approved'
        AND NOT public.is_valid_course_steam_config(steam_weights, difficulty_stars)
      ORDER BY id;
    `),
    query(`
      SELECT c.id AS course_id, c.title
      FROM public.courses c
      LEFT JOIN public.course_lessons lesson ON lesson.course_id = c.id
      WHERE c.status = 'approved'
      GROUP BY c.id, c.title
      HAVING count(lesson.id) = 0
      ORDER BY c.id;
    `),
    query(`
      SELECT conname, convalidated
      FROM pg_constraint
      WHERE conrelid IN (
        'public.courses'::regclass,
        'public.user_course_completions'::regclass
      )
        AND conname IN (
          'courses_steam_weights_valid',
          'user_course_completions_steam_config_valid'
        )
      ORDER BY conname;
    `),
    query(`
      SELECT
        count(*) FILTER (WHERE completed_at IS NOT NULL)::integer AS completed_rows,
        count(*) FILTER (
          WHERE completed_at IS NOT NULL AND completion_source = 'legacy_client'
        )::integer AS legacy_completed_rows,
        count(*) FILTER (
          WHERE completed_at IS NOT NULL
            AND completion_source IN ('server_v1', 'staff_verified')
        )::integer AS trusted_completed_rows,
        count(*) FILTER (
          WHERE completed_at IS NOT NULL AND completion_source IS NULL
        )::integer AS unclassified_completed_rows,
        count(*) FILTER (
          WHERE completed_at IS NULL AND completion_source IS NOT NULL
        )::integer AS source_without_completion_rows
      FROM public.user_lesson_progress;
    `),
    query(`
      SELECT current_database() AS database_name, datname, deadlocks, stats_reset
      FROM pg_stat_database
      WHERE datname = current_database();
    `),
    query(`
      WITH expected(index_name) AS (
        VALUES
          ('course_lessons_course_sort_idx'),
          ('user_lesson_progress_trusted_completion_idx'),
          ('user_course_completions_user_idx'),
          ('user_course_completions_course_idx'),
          ('completed_projects_radar_source_idx'),
          ('challenge_completions_radar_source_idx'),
          ('completed_projects_one_final_per_user_lesson')
      )
      SELECT expected.index_name
      FROM expected
      LEFT JOIN pg_class index_relation
        ON index_relation.relname = expected.index_name
       AND index_relation.relkind = 'i'
      LEFT JOIN pg_namespace index_schema
        ON index_schema.oid = index_relation.relnamespace
       AND index_schema.nspname = 'public'
      WHERE index_relation.oid IS NULL OR index_schema.oid IS NULL
      UNION ALL
      SELECT 'xp_logs_unique_action_key' AS index_name
      WHERE NOT EXISTS (
        SELECT 1
        FROM pg_index xp_index
        WHERE xp_index.indrelid = 'public.xp_logs'::regclass
          AND xp_index.indisunique
          AND pg_get_indexdef(xp_index.indexrelid) LIKE '%(user_id, action_type, resource_id)%'
      )
      ORDER BY index_name;
    `),
  ])

const [trustedMissingMilestones, untrustedCompleteCourses, invalidMilestones, duplicateMilestones] =
  await Promise.all([
    query(`
      WITH course_totals AS (
        SELECT c.id AS course_id, c.title, count(lesson.id)::integer AS total_lesson_count
        FROM public.courses c
        JOIN public.course_lessons lesson ON lesson.course_id = c.id
        WHERE c.status = 'approved'
        GROUP BY c.id, c.title
      ), trusted_progress AS (
        SELECT
          lesson.course_id,
          progress.user_id,
          count(DISTINCT progress.lesson_id)::integer AS completed_lesson_count,
          max(progress.completed_at) AS last_completed_at
        FROM public.user_lesson_progress progress
        JOIN public.course_lessons lesson ON lesson.id = progress.lesson_id
        WHERE progress.completed_at IS NOT NULL
          AND progress.completion_source IN ('server_v1', 'staff_verified')
        GROUP BY lesson.course_id, progress.user_id
      )
      SELECT
        totals.course_id,
        totals.title AS course_title,
        totals.total_lesson_count,
        progress.user_id,
        progress.completed_lesson_count,
        progress.last_completed_at
      FROM course_totals totals
      JOIN trusted_progress progress ON progress.course_id = totals.course_id
      LEFT JOIN public.user_course_completions milestone
        ON milestone.course_id = totals.course_id
       AND milestone.user_id = progress.user_id
      WHERE progress.completed_lesson_count = totals.total_lesson_count
        AND milestone.user_id IS NULL
      ORDER BY progress.last_completed_at ASC, totals.course_id, progress.user_id;
    `),
    query(`
      WITH course_totals AS (
        SELECT c.id AS course_id, c.title, count(lesson.id)::integer AS total_lesson_count
        FROM public.courses c
        JOIN public.course_lessons lesson ON lesson.course_id = c.id
        WHERE c.status = 'approved'
        GROUP BY c.id, c.title
      ), progress_summary AS (
        SELECT
          lesson.course_id,
          progress.user_id,
          count(DISTINCT progress.lesson_id)::integer AS completed_lesson_count,
          count(DISTINCT progress.lesson_id) FILTER (
            WHERE progress.completion_source IN ('server_v1', 'staff_verified')
          )::integer AS trusted_lesson_count
        FROM public.user_lesson_progress progress
        JOIN public.course_lessons lesson ON lesson.id = progress.lesson_id
        WHERE progress.completed_at IS NOT NULL
        GROUP BY lesson.course_id, progress.user_id
      )
      SELECT
        totals.course_id,
        totals.title AS course_title,
        totals.total_lesson_count,
        progress.user_id,
        progress.completed_lesson_count,
        progress.trusted_lesson_count
      FROM course_totals totals
      JOIN progress_summary progress ON progress.course_id = totals.course_id
      LEFT JOIN public.user_course_completions milestone
        ON milestone.course_id = totals.course_id
       AND milestone.user_id = progress.user_id
      WHERE progress.completed_lesson_count = totals.total_lesson_count
        AND progress.trusted_lesson_count < totals.total_lesson_count
        AND milestone.user_id IS NULL
      ORDER BY totals.course_id, progress.user_id;
    `),
    query(`
      SELECT
        milestone.user_id,
        milestone.course_id,
        course.title AS course_title,
        milestone.lesson_count_snapshot,
        milestone.steam_weights_snapshot,
        milestone.difficulty_stars_snapshot,
        milestone.trigger_lesson_id,
        trigger_lesson.course_id AS trigger_lesson_course_id
      FROM public.user_course_completions milestone
      JOIN public.courses course ON course.id = milestone.course_id
      LEFT JOIN public.course_lessons trigger_lesson
        ON trigger_lesson.id = milestone.trigger_lesson_id
      WHERE NOT public.is_valid_course_steam_config(
          milestone.steam_weights_snapshot,
          milestone.difficulty_stars_snapshot
        )
        OR (
          trigger_lesson.id IS NOT NULL
          AND trigger_lesson.course_id <> milestone.course_id
        )
      ORDER BY milestone.course_id, milestone.user_id;
    `),
    query(`
      SELECT user_id, course_id, count(*)::integer AS milestone_count
      FROM public.user_course_completions
      GROUP BY user_id, course_id
      HAVING count(*) > 1
      ORDER BY course_id, user_id;
    `),
  ])

const [malformedFinalSources, missingRewardLogs, orphanRewardLogs, wrongAmountRewardLogs, duplicateRewardLogs] =
  await Promise.all([
    query(`
      SELECT id AS completion_id, user_id, project_id, course_lesson_id, status, record_kind
      FROM public.completed_projects
      WHERE status = 'approved'
        AND coalesce(record_kind, 'final') = 'final'
        AND num_nonnulls(project_id, course_lesson_id) <> 1
      ORDER BY id;
    `),
    query(`
      SELECT
        completion.id AS completion_id,
        completion.user_id,
        completion.project_id,
        completion.course_lesson_id,
        CASE
          WHEN completion.course_lesson_id IS NOT NULL THEN 'publish_course_work'
          WHEN completion.project_id IS NOT NULL THEN 'complete_project'
          ELSE NULL
        END AS expected_action_type,
        CASE
          WHEN completion.course_lesson_id IS NOT NULL THEN completion.course_lesson_id::text
          WHEN completion.project_id IS NOT NULL THEN completion.project_id::text
          ELSE NULL
        END AS expected_resource_id
      FROM public.completed_projects completion
      WHERE completion.status = 'approved'
        AND coalesce(completion.record_kind, 'final') = 'final'
        AND (
          (
            completion.course_lesson_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1
              FROM public.xp_logs log
              WHERE log.user_id = completion.user_id
                AND log.action_type = 'publish_course_work'
                AND log.resource_id = completion.course_lesson_id::text
            )
          )
          OR (
            completion.course_lesson_id IS NULL
            AND completion.project_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1
              FROM public.xp_logs log
              WHERE log.user_id = completion.user_id
                AND log.action_type = 'complete_project'
                AND log.resource_id = completion.project_id::text
            )
          )
          OR num_nonnulls(completion.project_id, completion.course_lesson_id) <> 1
        )
      ORDER BY completion.id;
    `),
    query(`
      SELECT log.id, log.user_id, log.action_type, log.resource_id, log.xp_amount
      FROM public.xp_logs log
      WHERE log.action_type IN ('publish_course_work', 'complete_project')
        AND NOT EXISTS (
          SELECT 1
          FROM public.completed_projects completion
          WHERE completion.user_id = log.user_id
            AND completion.status = 'approved'
            AND coalesce(completion.record_kind, 'final') = 'final'
            AND (
              (
                log.action_type = 'publish_course_work'
                AND completion.course_lesson_id::text = log.resource_id
              )
              OR (
                log.action_type = 'complete_project'
                AND completion.course_lesson_id IS NULL
                AND completion.project_id::text = log.resource_id
              )
            )
        )
      ORDER BY log.id;
    `),
    query(`
      SELECT id, user_id, action_type, resource_id, xp_amount
      FROM public.xp_logs
      WHERE action_type IN ('publish_course_work', 'complete_project')
        AND xp_amount <> 20
      ORDER BY id;
    `),
    query(`
      SELECT user_id, action_type, resource_id, count(*)::integer AS reward_count
      FROM public.xp_logs
      WHERE action_type IN ('publish_course_work', 'complete_project')
      GROUP BY user_id, action_type, resource_id
      HAVING count(*) > 1
      ORDER BY action_type, resource_id, user_id;
    `),
  ])

const completionRewardCutover = migration?.applied_at ?? null
const completionLessonXpRows = completionRewardCutover
  ? await query(`
      SELECT
        count(*)::integer AS total_rows,
        count(*) FILTER (WHERE log.created_at >= cutover.applied_at)::integer AS post_cutover_rows,
        max(cutover.applied_at) AS cutover_at
      FROM public.xp_logs log
      CROSS JOIN (
        SELECT applied_at
        FROM public._schema_migrations
        WHERE version = '${COURSE_MIGRATION_VERSION}'
        LIMIT 1
      ) cutover
      WHERE log.action_type = 'complete_lesson';
    `)
  : []

const progressSummary = progressSummaryRows[0] ?? {}
const completionLessonXp = completionLessonXpRows[0] ?? {
  total_rows: 0,
  post_cutover_rows: 0,
  cutover_at: completionRewardCutover,
}
const requiredConstraintNames = [
  'courses_steam_weights_valid',
  'user_course_completions_steam_config_valid',
]
const constraintNames = new Set(constraintRows.map((row) => row.conname))
const constraintProblems = [
  ...constraintRows.filter((row) => row.convalidated !== true),
  ...requiredConstraintNames
    .filter((name) => !constraintNames.has(name))
    .map((conname) => ({ conname, convalidated: false })),
]
const findings = []

addFinding(
  findings,
  'course_migration_missing',
  'P1',
  migration ? [] : [{ migration: COURSE_MIGRATION_VERSION }],
  '课程闭环迁移没有在数据库迁移记录中找到',
)

addFinding(
  findings,
  'course_config_invalid',
  'P1',
  invalidCourseConfigs,
  'approved 课程存在无效 STEAM 配置',
)
addFinding(
  findings,
  'approved_course_empty',
  'P1',
  emptyApprovedCourses,
  'approved 课程没有课时',
)
addFinding(
  findings,
  'course_config_constraint_unvalidated',
  'P1',
  constraintProblems,
  '课程 STEAM 约束缺失或尚未 VALIDATE',
)
addFinding(
  findings,
  'course_integrity_index_missing',
  'P1',
  indexRows,
  '课程闭环完整性查询所需索引缺失',
)
addFinding(
  findings,
  'unclassified_completed_progress',
  'P1',
  countValue(progressSummary, 'unclassified_completed_rows') > 0
    ? [{ count: countValue(progressSummary, 'unclassified_completed_rows') }]
    : [],
  '存在没有 completion_source 的已完成课时',
)
addFinding(
  findings,
  'trusted_milestone_missing',
  'P1',
  trustedMissingMilestones,
  '用户已可信完成整门课但没有课程能力里程碑',
)
addFinding(
  findings,
  'milestone_invalid',
  'P1',
  invalidMilestones,
  '课程能力里程碑快照或触发课时不一致',
)
addFinding(
  findings,
  'milestone_duplicate',
  'P1',
  duplicateMilestones,
  '同一用户同一课程存在多条能力里程碑',
)
addFinding(
  findings,
  'final_source_malformed',
  'P1',
  malformedFinalSources,
  'approved final 作品没有恰好一个来源',
)
addFinding(
  findings,
  'reward_missing',
  'P1',
  missingRewardLogs,
  'approved final 作品缺少对应 XP 流水',
)
addFinding(
  findings,
  'reward_orphan',
  'P2',
  orphanRewardLogs,
  '课程/项目作品 XP 流水找不到当前 approved final 来源（可能是历史删除或状态变更）',
)
addFinding(
  findings,
  'reward_amount_invalid',
  'P1',
  wrongAmountRewardLogs,
  '课程/项目作品 XP 流水不是 +20',
)
addFinding(
  findings,
  'reward_duplicate',
  'P1',
  duplicateRewardLogs,
  '同一业务来源存在重复 XP 流水',
)
addFinding(
  findings,
  'legacy_lesson_xp_after_cutover',
  'P1',
  countValue(completionLessonXp, 'post_cutover_rows') > 0
    ? [{ ...completionLessonXp }]
    : [],
  '课程闭环迁移后仍产生 complete_lesson XP 流水',
)

const database = databaseRows[0] ?? null
addFinding(
  findings,
  'database_deadlocks',
  'P2',
  database && numberValue(database.deadlocks) > 0 ? [{ deadlocks: numberValue(database.deadlocks) }] : [],
  '数据库自统计重置以来出现过死锁',
)

const blockingFindings = findings.filter((finding) => finding.severity === 'P1')
const reportedFindings = findings.map((finding) => ({
  ...finding,
  rows: finding.rows.map(redactFindingRow),
}))
const auditSummary = summarizeCourseClosureAudit(reportedFindings)

const legacyExcludedCount = untrustedCompleteCourses.length
const safeRows = (rows) => rows.map(redactFindingRow)
const report = {
  generatedAt: new Date().toISOString(),
  healthy: auditSummary.healthy,
  blockingCount: auditSummary.blockingCount,
  advisoryCount: auditSummary.advisoryCount,
  strict,
  migration: {
    version: COURSE_MIGRATION_VERSION,
    appliedAt: completionRewardCutover,
    found: Boolean(migration),
  },
  configuration: {
    invalidApprovedCourses: invalidCourseConfigs,
    emptyApprovedCourses,
    constraints: constraintRows,
    missingIndexes: indexRows,
  },
  progress: {
    ...progressSummary,
    trustedCompleteWithoutMilestone: safeRows(trustedMissingMilestones),
    fullyCompleteWithUntrustedRows: safeRows(untrustedCompleteCourses),
    legacyExcludedCount,
  },
  milestones: {
    invalid: safeRows(invalidMilestones),
    duplicates: safeRows(duplicateMilestones),
  },
  rewards: {
    malformedFinalSources: safeRows(malformedFinalSources),
    missing: safeRows(missingRewardLogs),
    orphan: safeRows(orphanRewardLogs),
    invalidAmount: safeRows(wrongAmountRewardLogs),
    duplicates: safeRows(duplicateRewardLogs),
    completeLessonXp: completionLessonXp,
  },
  database,
  findings: reportedFindings,
}

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const status = report.healthy
    ? findings.length > 0
      ? `passed with ${findings.length} advisory finding(s)`
      : 'passed'
    : `found ${blockingFindings.length} blocking finding(s)`
  console.log(`Course closure audit ${status}.`)
  console.log(
    `Progress: ${countValue(progressSummary, 'trusted_completed_rows')} trusted completed row(s), ` +
      `${countValue(progressSummary, 'legacy_completed_rows')} legacy row(s), ` +
      `${legacyExcludedCount} fully-complete course/user pair(s) intentionally excluded from reconcile.`,
  )
  console.log(
    `Milestones: ${countRows(trustedMissingMilestones)} trusted completion gap(s), ` +
      `${countRows(invalidMilestones)} invalid snapshot(s), ` +
      `${countRows(duplicateMilestones)} duplicate pair(s).`,
  )
  console.log(
    `Rewards: ${countRows(missingRewardLogs)} missing, ${countRows(orphanRewardLogs)} orphan, ` +
      `${countRows(wrongAmountRewardLogs)} wrong amount, ${countRows(duplicateRewardLogs)} duplicate source(s).`,
  )
  console.log(
    `Legacy complete_lesson XP: ${countValue(completionLessonXp, 'total_rows')} total, ` +
      `${countValue(completionLessonXp, 'post_cutover_rows')} after migration cutover.`,
  )
  if (report.database) {
    console.log(`Database deadlocks since stats reset: ${numberValue(report.database.deadlocks)}.`)
  }
  for (const finding of findings) {
    console.log(`- [${finding.severity}] ${finding.code}: ${finding.summary} (${finding.count})`)
    for (const row of finding.rows.slice(0, 5).map(redactFindingRow)) {
      const displayRow = { ...row }
      if (row.last_completed_at) displayRow.age_hours = ageHours(row.last_completed_at)
      console.log(`  ${JSON.stringify(displayRow)}`)
    }
    if (finding.count > 5) console.log(`  ... and ${finding.count - 5} more; use --json for the full report.`)
  }
}

if ((strict ? findings.length : blockingFindings.length) > 0) process.exitCode = 2
