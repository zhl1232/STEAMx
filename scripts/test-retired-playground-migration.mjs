// Offline, in-memory PostgreSQL execution; never reads credentials or connects remotely.
// PGLITE_MODULE_PATH=/tmp/playground-removal-validation/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-retired-playground-migration.mjs
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const modulePath = process.env.PGLITE_MODULE_PATH
if (!modulePath) throw new Error('Set PGLITE_MODULE_PATH to an installed PGlite module; no remote database is used.')
const { PGlite } = await import(pathToFileURL(modulePath).href)
const read = name => fs.readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
const migration = await read('20261025170000_remove_retired_playground_games.sql')
const statsSchema = await read('20260319200000_playground_stats_cloud_sync.sql')
const raceSchema = await read('20260714190300_playground_race_matches.sql')
const raceKeys = await read('20260715113000_playground_race_game_keys.sql')
const authoritySource = await read('20260716103000_function_wars_authority_lifecycle.sql')
const authority = authoritySource.slice(
  authoritySource.indexOf('CREATE OR REPLACE FUNCTION public.enforce_function_wars_online_stats()'),
  authoritySource.indexOf('CREATE OR REPLACE FUNCTION public.sync_function_wars_online_stats('),
)
assert(authority.startsWith('CREATE OR REPLACE FUNCTION') && authority.includes('CREATE TRIGGER trg_enforce_function_wars_online_stats'), 'Load the actual authority function and trigger')
const retiredStats = ['game_2048_stats', 'fifteen_puzzle_stats', 'quick_math_stats']
const retiredBadges = ['game2048_first_win', 'game2048_4096', 'game2048_8192', 'game2048_high_scorer', 'fifteen_first', 'fifteen_master', 'quick_math_first', 'quick_math_combo']
const keptBadges = ['game24_speed', 'playground_explorer_platinum', 'playground_explorer_gold', 'milestone_platinum']
const keptGames = ['game24', 'hanoi', 'nqueens', 'nonogram', 'ballsort', 'balance', 'symmetry', 'tangram']
const states = ['waiting', 'playing', 'finished', 'cancelled']
const users = [1, 2, 3].map(n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`)
const richStats = {
  game_2048_stats: { bestScore: 8192 }, fifteen_puzzle_stats: { wins: 8 }, quick_math_stats: { bestScore: 120 },
  game24_stats: { wins: 3 }, hanoi_stats: { gamesPlayed: 7 }, future_unknown_stats: { nested: [1, null, 'keep'] },
  function_wars_stats: { onlineGames: 2, onlineWins: 1, gamesPlayed: 12, bestStars: { first: 3 }, bestSolutions: { first: { stars: 3, shots: [{ expression: 'x', weapon: 'standard' }] } } },
}
const cleaned = value => Object.fromEntries(Object.entries(value).filter(([key]) => !retiredStats.includes(key)))

async function fixture() {
  const db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
    CREATE TABLE public.profiles (id uuid PRIMARY KEY, role text DEFAULT 'user', xp integer NOT NULL DEFAULT 12345);
    CREATE TABLE public.function_wars_match_results (match_id uuid DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.profiles(id), result text NOT NULL);
    CREATE TABLE public.badges (id text PRIMARY KEY, description text NOT NULL, xp_reward integer NOT NULL DEFAULT 100);
    CREATE TABLE public.user_badges (user_id uuid REFERENCES public.profiles(id), badge_id text REFERENCES public.badges(id), awarded_at timestamptz DEFAULT '2026-01-01Z', PRIMARY KEY (user_id, badge_id));
    CREATE TABLE public.xp_ledger (user_id uuid REFERENCES public.profiles(id), amount integer, reason text);
  `)
  await db.exec(statsSchema)
  await db.exec(raceSchema)
  await db.exec(raceKeys)
  await db.exec(authority)
  for (const id of users) await db.query('INSERT INTO public.profiles(id) VALUES ($1)', [id])
  await db.query("INSERT INTO public.function_wars_match_results(user_id, result) VALUES ($1, 'win'), ($1, 'loss')", [users[0]])
  await db.query('INSERT INTO public.playground_stats(user_id, stats) VALUES ($1, $2), ($3, $4)', [users[0], richStats, users[1], { game24_stats: { wins: 1 }, custom: false }])
  let room = 0
  for (const game of [...keptGames, 'quickmath', 'fifteen']) {
    for (const status of states) {
      await db.query('INSERT INTO public.playground_race_matches(code, game_key, host_user_id, status, settings, host_result) VALUES ($1,$2,$3,$4,$5,$6)', [String(++room).padStart(6, '0'), game, users[0], status, { preserve: game }, { score: 123 }])
    }
  }
  for (const badge of [...retiredBadges, ...keptBadges]) {
    await db.query('INSERT INTO public.badges(id, description) VALUES ($1,$2)', [badge, badge === 'playground_explorer_platinum' ? '玩过 18 个不同游乐场游戏' : `preserve ${badge}`])
    for (const user of users.slice(0, 2)) await db.query('INSERT INTO public.user_badges(user_id, badge_id) VALUES ($1,$2)', [user, badge])
  }
  await db.query("INSERT INTO public.xp_ledger VALUES ($1, 100, 'game2048_first_win'), ($1, 500, 'cross-game honor')", [users[0]])
  return db
}

const rows = async (db, table, order) => (await db.query(`SELECT * FROM public.${table} ORDER BY ${order}`)).rows
async function snapshot(db) {
  return {
    stats: await rows(db, 'playground_stats', 'user_id'),
    rooms: await rows(db, 'playground_race_matches', 'code'),
    badges: await rows(db, 'badges', 'id'),
    awards: await rows(db, 'user_badges', 'user_id, badge_id'),
    profiles: await rows(db, 'profiles', 'id'),
    xp: await rows(db, 'xp_ledger', 'reason'),
    results: await rows(db, 'function_wars_match_results', 'match_id'),
    triggers: (await db.query("SELECT tgname, pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname")).rows,
    constraints: (await db.query("SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'public.playground_race_matches'::regclass ORDER BY conname")).rows,
    functions: (await db.query("SELECT proname, pg_get_functiondef(oid) AS definition FROM pg_proc WHERE pronamespace = 'public'::regnamespace ORDER BY proname")).rows,
  }
}
// Match scripts/db-push.mjs scopedBatchSql: one DO statement EXECUTEs the SQL
// body atomically. Tracking-table locking/history validation belong to runner tests.
assert(!migration.includes('$retired_validation_body$') && !migration.includes('$retired_validation_batch$'))
const apply = db => db.exec(`DO $retired_validation_batch$ BEGIN
  EXECUTE $retired_validation_body$${migration}$retired_validation_body$;
END; $retired_validation_batch$;`)
let cases = 0
const db = await fixture()
try {
  const before = await snapshot(db)
  await apply(db)
  const after = await snapshot(db)
  assert.deepEqual(after.stats, before.stats.map(row => ({ ...row, stats: cleaned(row.stats) })), 'Delete exactly three stats keys and preserve every remaining field/timestamp')
  assert.deepEqual(after.rooms, before.rooms.filter(row => keptGames.includes(row.game_key)), 'Delete only both retired room kinds across all four states')
  assert.deepEqual(after.badges, before.badges.filter(row => !retiredBadges.includes(row.id)).map(row => row.id === 'playground_explorer_platinum' ? { ...row, description: '玩过 15 个不同游乐场游戏' } : row))
  assert.deepEqual(after.awards, before.awards.filter(row => !retiredBadges.includes(row.badge_id)), 'Keep all unrelated awarded honors')
  for (const key of ['profiles', 'xp', 'results']) assert.deepEqual(after[key], before[key], `Preserve ${key}`)
  assert.deepEqual(after.triggers.filter(row => row.tgname !== 'trg_remove_retired_playground_stats'), before.triggers, 'Keep existing authority and room triggers')
  cases++
  await apply(db)
  assert.deepEqual(await snapshot(db), after, 'Second application is fully idempotent')
  cases++

  const attempted = { ...richStats, function_wars_stats: { ...richStats.function_wars_stats, onlineGames: 999, onlineWins: 999 } }
  await db.query('UPDATE public.playground_stats SET stats = $2 WHERE user_id = $1', [users[0], attempted])
  assert.deepEqual((await rows(db, 'playground_stats', 'user_id'))[0].stats, cleaned(richStats), 'UPDATE strips retired keys, preserves bestSolutions and restores trusted online counters')
  await db.query('INSERT INTO public.playground_stats(user_id, stats) VALUES ($1,$2)', [users[2], attempted])
  const inserted = (await rows(db, 'playground_stats', 'user_id'))[2].stats
  assert.deepEqual(inserted, { ...cleaned(richStats), function_wars_stats: { ...richStats.function_wars_stats, onlineGames: 0, onlineWins: 0 } }, 'INSERT strips old keys and uses authoritative per-user totals')
  await db.query("INSERT INTO public.function_wars_match_results(user_id,result) VALUES ($1,'win')", [users[0]])
  await db.query('UPDATE public.playground_stats SET stats = stats WHERE user_id = $1', [users[0]])
  const refreshed = (await rows(db, 'playground_stats', 'user_id'))[0].stats.function_wars_stats
  assert.equal(refreshed.onlineGames, 3)
  assert.equal(refreshed.onlineWins, 2)
  assert.deepEqual(refreshed.bestSolutions, richStats.function_wars_stats.bestSolutions)
  cases++

  for (const [index, game] of keptGames.entries()) await db.query('INSERT INTO public.playground_race_matches(code,game_key,host_user_id) VALUES ($1,$2,$3)', [`N${String(index).padStart(5, '0')}`, game, users[0]])
  for (const game of ['quickmath', 'fifteen', 'game2048', 'unexpected']) {
    await assert.rejects(db.query('INSERT INTO public.playground_race_matches(code,game_key,host_user_id) VALUES ($1,$2,$3)', ['OLDKEY', game, users[0]]), error => error.code === '23514', `Reject room key ${game}`)
  }
  await assert.rejects(db.query("UPDATE public.playground_race_matches SET game_key='quickmath' WHERE code='N00000'"), error => error.code === '23514')
  cases++
} finally {
  await db.close()
}

const unexpected = await fixture()
try {
  // Simulate an unanticipated deployment schema/catalog extension.
  await unexpected.exec('ALTER TABLE public.playground_race_matches DROP CONSTRAINT playground_race_matches_game_key_check')
  await unexpected.query("INSERT INTO public.playground_race_matches(code,game_key,host_user_id) VALUES ('FUTURE','unexpected',$1)", [users[0]])
  const before = await snapshot(unexpected)
  await assert.rejects(apply(unexpected), error => error.code === '23514', 'Unknown preexisting room must fail validation')
  assert.deepEqual(await snapshot(unexpected), before, 'Failure rolls back stats, rooms, badges, trigger/function DDL and constraints together')
  cases++
} finally {
  await unexpected.close()
}
console.log(`PASS: ${cases} offline SQL scenarios: exact cleanup and preserved data/XP, idempotency, INSERT/UPDATE authority coexistence, eight allowed room kinds and rejected retired keys, unknown-key transaction rollback.`)
