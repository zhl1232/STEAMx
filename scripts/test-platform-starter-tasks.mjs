import fs from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const modulePath = process.env.PGLITE_MODULE_PATH || '/tmp/rls-validation/node_modules/@electric-sql/pglite/dist/index.js'
const { PGlite } = await import(pathToFileURL(modulePath).href)
const db = new PGlite('memory://platform-starter-tasks')

await db.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'service_role'::text $$;
  CREATE TABLE profiles (id uuid primary key, xp integer default 0, bio text);
  CREATE TABLE xp_logs (id bigserial primary key, user_id uuid, action_type text, resource_id text, xp_amount integer, created_at timestamptz default now());
  CREATE TABLE user_lesson_progress (user_id uuid, lesson_id bigint, completed_at timestamptz);
  CREATE TABLE completed_projects (user_id uuid, status text, moderation_state text, record_kind text);
  CREATE TABLE project_journeys (id bigint, user_id uuid, status text);
  CREATE TABLE project_journey_records (journey_id bigint, record_kind text, visibility text, status text, moderation_state text);
  CREATE TABLE observation_events (user_id uuid, status text);
  CREATE TABLE playground_stats (user_id uuid primary key, stats jsonb);
  CREATE TABLE function_wars_match_results (match_id uuid, user_id uuid, result text);
  CREATE UNIQUE INDEX xp_logs_unique_action ON xp_logs(user_id, action_type, resource_id);
`)

const migration = await fs.readFile(new URL('../supabase/migrations/20260922121000_platform_starter_tasks.sql', import.meta.url), 'utf8')
await db.exec(migration)

const user = '00000000-0000-0000-0000-000000000001'
await db.exec(`INSERT INTO profiles(id) VALUES ('${user}');`)
const emptyUser = '00000000-0000-0000-0000-000000000002'
await db.exec(`INSERT INTO profiles(id) VALUES ('${emptyUser}');`)
let progress = (await db.query(`SELECT public.get_platform_growth_progress('${user}') AS value`)).rows[0].value
if (progress.lessonsStarted !== 0 || progress.playgroundGamesPlayed !== 0) throw new Error('empty progress mismatch')
await db.exec(`INSERT INTO playground_stats VALUES ('${emptyUser}', '{"scalar":null,"zero":{"totalGames":0,"wins":0}}');`)
let emptyProgress = (await db.query(`SELECT public.get_platform_growth_progress('${emptyUser}') AS value`)).rows[0].value
if (emptyProgress.lessonsStarted !== 0 || emptyProgress.playgroundGamesPlayed !== 0) throw new Error('scalar/all-zero game progress mismatch')
await db.exec(`UPDATE playground_stats SET stats = 'null'::jsonb WHERE user_id = '${emptyUser}';`)
emptyProgress = (await db.query(`SELECT public.get_platform_growth_progress('${emptyUser}') AS value`)).rows[0].value
if (emptyProgress.lessonsStarted !== 0 || emptyProgress.playgroundGamesPlayed !== 0) throw new Error('top-level null game progress mismatch')
await db.exec(`UPDATE playground_stats SET stats = '[]'::jsonb WHERE user_id = '${emptyUser}';`)
emptyProgress = (await db.query(`SELECT public.get_platform_growth_progress('${emptyUser}') AS value`)).rows[0].value
if (emptyProgress.lessonsStarted !== 0 || emptyProgress.playgroundGamesPlayed !== 0) throw new Error('top-level array game progress mismatch')

const forgedUser = '00000000-0000-0000-0000-000000000003'
await db.exec(`INSERT INTO profiles(id) VALUES ('${forgedUser}');`)
await db.exec(`INSERT INTO playground_stats VALUES ('${forgedUser}', '{"fake_game":{"totalGames":1,"wins":1,"onlineGames":1,"onlineWins":1}}');`)
for (const taskId of ['start_first_lesson', 'complete_first_lesson', 'publish_first_work']) {
  try {
    await db.exec(`SELECT * FROM public.claim_platform_growth_task('${forgedUser}', '${taskId}')`)
    throw new Error(`forged playground stats incorrectly claimed ${taskId}`)
  } catch (error) {
    if (!String(error).includes('growth task is not complete')) throw error
  }
}
try {
  await db.exec(`SELECT * FROM public.claim_platform_growth_task('${user}', 'write_bio')`)
  throw new Error('NULL bio incorrectly claimed optional task')
} catch (error) {
  if (!String(error).includes('growth task is not complete')) throw error
}

await db.exec(`INSERT INTO playground_stats VALUES ('${user}', '{"memory_match_stats":{"totalGames":1,"wins":0}}');`)
progress = (await db.query(`SELECT public.get_platform_growth_progress('${user}') AS value`)).rows[0].value
if (progress.playgroundGamesPlayed !== 0 || progress.playgroundWinsTotal !== 0) throw new Error('untrusted cloud game progress mismatch')

await db.exec(`UPDATE playground_stats SET stats = '{"memory_match_stats":{"wins":"bad","solvedLevels":1}}';`)
progress = (await db.query(`SELECT public.get_platform_growth_progress('${user}') AS value`)).rows[0].value
if (progress.lessonsCompleted !== 0) throw new Error('malformed metrics qualified')

await db.exec(`INSERT INTO function_wars_match_results VALUES ('00000000-0000-0000-0000-000000000101', '${user}', 'loss');`)
progress = (await db.query(`SELECT public.get_platform_growth_progress('${user}') AS value`)).rows[0].value
if (progress.lessonsStarted !== 1 || progress.lessonsCompleted !== 0 || progress.playgroundGamesPlayed !== 1 || progress.playgroundWinsTotal !== 0) throw new Error('trusted game progress mismatch')

await db.exec(`INSERT INTO observation_events VALUES ('${user}', 'pending');`)
await db.exec(`SELECT * FROM public.claim_platform_growth_task('${user}', 'start_first_lesson')`)
try {
  await db.exec(`SELECT * FROM public.claim_platform_growth_task('${user}', 'complete_first_lesson')`)
  throw new Error('pending observation incorrectly completed task')
} catch (error) {
  if (!String(error).includes('growth task is not complete')) throw error
}

await db.exec(`UPDATE observation_events SET status = 'approved';`)
await db.exec(`INSERT INTO function_wars_match_results VALUES ('00000000-0000-0000-0000-000000000102', '${user}', 'win');`)
progress = (await db.query(`SELECT public.get_platform_growth_progress('${user}') AS value`)).rows[0].value
if (progress.lessonsCompleted !== 1 || progress.worksPublished !== 2 || progress.playgroundGamesPlayed !== 2 || progress.playgroundWinsTotal !== 1) throw new Error('approved observation progress mismatch')
const claim = (await db.query(`SELECT * FROM public.claim_platform_growth_task('${user}', 'complete_first_lesson')`)).rows[0]
if (claim.xp_granted !== 20 || claim.already_claimed) throw new Error('approved observation claim mismatch')
const publishedClaim = (await db.query(`SELECT * FROM public.claim_platform_growth_task('${user}', 'publish_first_work')`)).rows[0]
if (publishedClaim.xp_granted !== 30 || publishedClaim.already_claimed) throw new Error('approved observation publish mismatch')
await db.exec(`DELETE FROM observation_events;`)
const repeated = (await db.query(`SELECT * FROM public.claim_platform_growth_task('${user}', 'complete_first_lesson')`)).rows[0]
if (!repeated.already_claimed || repeated.xp_granted !== 0) throw new Error('idempotent claim mismatch')

console.info('Platform starter task SQL verification passed (PGlite).')
await db.close()
