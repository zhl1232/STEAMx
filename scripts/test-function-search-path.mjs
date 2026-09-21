#!/usr/bin/env node
// Isolated PostgreSQL regression; never connects to the configured Supabase.
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const modulePath = process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite'
const { PGlite } = await import(modulePath.startsWith('/') ? pathToFileURL(modulePath).href : modulePath)
const db = new PGlite()
const migration = await readFile('supabase/migrations/20260921121000_harden_reported_function_search_paths.sql', 'utf8')

const sqlFiles = async directory => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => {
    const path = `${directory}/${entry.name}`
    return entry.isDirectory() ? sqlFiles(path) : entry.name.endsWith('.sql') ? [path] : []
  }))
  return nested.flat()
}

const extractFunction = (source, name) => {
  const marker = new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${name.replaceAll('_', '\\_')}\\s*\\(`, 'i')
  const match = marker.exec(source)
  if (!match) return null
  const start = match.index
  const bodyStart = source.indexOf('AS ', start)
  if (bodyStart < 0) return null
  const delimiterMatch = source.slice(bodyStart).match(/AS\s+(\$[A-Za-z_]*\$)/i)
  if (!delimiterMatch) return null
  const delimiter = delimiterMatch[1]
  const delimiterStart = bodyStart + delimiterMatch.index
  const endBody = source.indexOf(delimiter, delimiterStart + delimiterMatch[0].length)
  if (endBody < 0) return null
  const end = source.indexOf(';', endBody + delimiter.length)
  return source.slice(start, end < 0 ? endBody + delimiter.length : end + 1)
}

const allSqlFiles = await sqlFiles('supabase/migrations')
const functionDefinitions = new Map()
for (const file of allSqlFiles.sort()) {
  const source = await readFile(file, 'utf8')
  for (const target of migration.matchAll(/ALTER FUNCTION\s+public\.([a-z_][a-z0-9_]*)\(/gi)) {
    const name = target[1]
    const definition = extractFunction(source, name)
    if (definition) functionDefinitions.set(name, definition)
  }
}

const alterPattern = /ALTER FUNCTION\s+public\.([a-z_][a-z0-9_]*)\(([^)]*)\)\s+SET\s+search_path\s*=\s*''/gi
const targets = [...migration.matchAll(alterPattern)].map(match => ({
  name: match[1],
  args: match[2].trim(),
}))
assert.equal(targets.length, 19, 'migration must cover the reported 19 functions')
assert.equal(new Set(targets.map(target => `${target.name}(${target.args})`)).size, 19, 'target signatures must be unique')

const metadataQuery = `
  SELECT p.oid::regprocedure AS signature,
         p.prosrc, p.proargtypes::text, p.prorettype::text, p.provolatile,
         p.prosecdef, p.proowner, p.proacl, p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  ORDER BY p.oid::regprocedure::text
`

try {
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text $$;
    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY, coins integer DEFAULT 0, level integer DEFAULT 0, role text,
      equipped_avatar_frame_id text, equipped_name_color_id text, xp integer,
      last_check_in date, login_streak integer, total_login_days integer,
      age_confirmed_at timestamptz, interaction_restricted boolean,
      membership_tier text, membership_period text, membership_started_at timestamptz,
      membership_expires_at timestamptz
    );
    CREATE TABLE public.user_inventory (user_id uuid, item_id text, unlocked_at timestamptz);
    CREATE TABLE public.coin_logs (user_id uuid, amount integer, action_type text, resource_id text);
    -- Only shop/profile runtime fixtures are installed here. Other functions
    -- retain their REAL bodies for metadata validation; their runtime suites
    -- independently supply complete billing, journey and store schemas.
    SET check_function_bodies = off;
  `)

  for (const target of targets) {
    const definition = functionDefinitions.get(target.name)
    assert.ok(definition, `real definition found: ${target.name}`)
    await db.exec(definition)
  }
  await db.exec(`
    SET check_function_bodies = on;
    REVOKE ALL ON FUNCTION public.purchase_item(text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.purchase_item(text) TO authenticated;
    GRANT SELECT, UPDATE ON public.profiles TO authenticated;
    CREATE TRIGGER protect_fields BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.protect_profiles_sensitive_fields();
  `)

  const before = (await db.query(metadataQuery)).rows
  const beforeBySignature = new Map(before.map(row => [row.signature, row]))
  assert.equal(beforeBySignature.size, 19)

  await db.exec(migration)
  const after = (await db.query(metadataQuery)).rows
  const afterBySignature = new Map(after.map(row => [row.signature, row]))

  for (const target of targets) {
    const signature = `${target.name}(${target.args})`
    const normalizeSignature = value => value.replaceAll(/\s+/g, '')
    const normalizedSignature = normalizeSignature(signature)
    const beforeRow = [...beforeBySignature.values()].find(row => normalizeSignature(row.signature) === normalizedSignature)
    const afterRow = [...afterBySignature.values()].find(row => normalizeSignature(row.signature) === normalizedSignature)
    assert.ok(beforeRow && afterRow, `function exists: ${signature}`)
    for (const field of ['prosrc', 'proargtypes', 'prorettype', 'provolatile', 'prosecdef', 'proowner', 'proacl']) {
      assert.deepEqual(afterRow[field], beforeRow[field], `${field} preserved: ${signature}`)
    }
    assert.ok(afterRow.proconfig?.includes('search_path=""'), `empty search_path: ${signature}`)
  }

  const user = '00000000-0000-0000-0000-000000000001'
  const scalar = async sql => (await db.query(sql)).rows[0].result
  await db.exec(`INSERT INTO public.profiles(id,coins,level,role,membership_tier,membership_period)
    VALUES ('${user}',200,10,'user','free','none');
    SELECT set_config('request.jwt.claim.sub','${user}',false);
    SET ROLE authenticated;`)
  assert.equal(await scalar("SELECT public.get_shop_item_price('pixel_border') result"), 15)
  assert.equal(await scalar("SELECT public.get_shop_item_min_level('science_orbit') result"), 8)
  const purchase = await scalar("SELECT public.purchase_item('pixel_border') result")
  assert.equal(purchase.ok, true)
  assert.equal(purchase.price, 15)
  assert.equal(await scalar(`SELECT coins result FROM public.profiles WHERE id='${user}'`), 185)
  assert.equal((await scalar("SELECT public.purchase_item('pixel_border') result")).error, 'already_owned')
  assert.equal((await scalar("SELECT public.equip_avatar_frame(NULL) result")).ok, true)
  assert.equal((await scalar("SELECT public.equip_avatar_frame('pixel_border') result")).equipped, 'pixel_border')
  assert.equal((await scalar("SELECT public.equip_avatar_frame('golden_crown') result")).error, 'not_owned')
  await db.exec(`UPDATE public.profiles SET role='admin',coins=9999,membership_tier='pro' WHERE id='${user}'`)
  const profile = (await db.query(`SELECT role,coins,membership_tier FROM public.profiles WHERE id='${user}'`)).rows[0]
  assert.deepEqual(profile, {role: 'user', coins: 185, membership_tier: 'free'}, 'sensitive fields remain protected')
  await db.exec('RESET ROLE')
  assert.equal(await scalar('SELECT count(*)::int result FROM public.user_inventory'), 1)
  assert.equal(await scalar('SELECT sum(amount)::int result FROM public.coin_logs'), -15)

  await db.exec(migration)
  const rerun = await db.query(metadataQuery)
  assert.deepEqual(rerun.rows, after, 'rerun preserves function metadata and configuration')
  console.log('PASS: 19 real function definitions, empty search paths, metadata/ACL/body preservation, real shop/profile runtime checks, idempotence')
} catch (error) {
  console.error(error.message)
  if (error.where) console.error(error.where)
  process.exitCode = 1
} finally {
  await db.close()
}
