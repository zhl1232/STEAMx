// PGlite check for 20261004100000_refresh_welcome_brand_copy.sql.
// Usage: PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js node scripts/test-welcome-brand-copy-migration.mjs
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath =
  process.env.PGLITE_MODULE_PATH ||
  "/tmp/rls-validation/node_modules/@electric-sql/pglite/dist/index.js";
const { PGlite } = await import(pathToFileURL(modulePath).href);

const read = (name) => fs.readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const base = await read("20260922120000_platform_communications.sql");
const refresh = await read("20261004100000_refresh_welcome_brand_copy.sql");

const OLD_BODY =
  "从兴趣出发，在动手中成长。你可以探索积木搭建、Scratch 编程、科学实验、自然观察、项目式学习和游乐场挑战，遇到问题随时联系我们。";
const NEW_BODY =
  "兴趣是最好的老师。在真实项目中动手探索，学会拆解问题、持续迭代。创探空间是少儿 STEAM 项目式学习平台：你可以探索积木搭建、Scratch 编程、科学实验、自然观察、PBL 挑战和游乐场，遇到问题随时联系我们。";

const SETUP = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'service_role'::text $$;
  CREATE TABLE auth.users(id uuid primary key);
  CREATE TABLE profiles(id uuid primary key, created_at timestamptz not null);
  CREATE TABLE notifications(
    id bigserial primary key, user_id uuid not null, type text not null, content text not null,
    is_read boolean not null default false, created_at timestamptz not null default now(),
    from_username text, title text, system_kind text, announcement_id bigint
  );
`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function freshDb(name) {
  const db = new PGlite(`memory://${name}`);
  await db.exec(SETUP);
  await db.exec(base);
  return db;
}

const welcome = async (db) =>
  (await db.query("SELECT body, title, contact_href, enabled FROM public.platform_welcome_settings WHERE id")).rows[0];
const bodyDefault = async (db) =>
  (
    await db.query(`
      SELECT pg_get_expr(d.adbin, d.adrelid) AS expr
      FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
      WHERE d.adrelid = 'public.platform_welcome_settings'::regclass AND a.attname = 'body'`)
  ).rows[0].expr;

// 1) Untouched default row + default column value are refreshed; re-running is a no-op.
{
  const db = await freshDb("welcome-default");
  assert((await welcome(db)).body === OLD_BODY, "historical migration should seed the old body");
  await db.exec(refresh);
  const row = await welcome(db);
  assert(row.body === NEW_BODY, `default body should be refreshed, got ${row.body}`);
  assert(row.title === "欢迎来到创探空间" && row.contact_href === "/about#contact" && row.enabled === true, "other fields stay");
  assert((await bodyDefault(db)).includes(NEW_BODY), "column default should be refreshed");
  await db.exec(refresh);
  assert((await welcome(db)).body === NEW_BODY, "re-run keeps the new body");
  assert((await bodyDefault(db)).includes(NEW_BODY), "re-run keeps the new default");
  // A fresh insert now gets the new default.
  await db.exec("DELETE FROM public.platform_welcome_settings; INSERT INTO public.platform_welcome_settings (id) VALUES (true);");
  assert((await welcome(db)).body === NEW_BODY, "new rows use the new default");
  await db.close();
}

// 2) Admin-customized body is left alone (the default column value is still refreshed).
{
  const db = await freshDb("welcome-custom");
  const custom = "欢迎！这是管理员自定义的欢迎语。";
  await db.exec(`UPDATE public.platform_welcome_settings SET body = '${custom}'`);
  await db.exec(refresh);
  assert((await welcome(db)).body === custom, "custom body must be untouched");
  await db.close();
}

// 3) An already-changed column default is not overwritten.
{
  const db = await freshDb("welcome-custom-default");
  await db.exec("ALTER TABLE public.platform_welcome_settings ALTER COLUMN body SET DEFAULT '自定义默认'");
  await db.exec(refresh);
  assert((await bodyDefault(db)) === "'自定义默认'::text", "custom column default must be untouched");
  await db.close();
}

console.log("welcome brand copy migration: OK");
