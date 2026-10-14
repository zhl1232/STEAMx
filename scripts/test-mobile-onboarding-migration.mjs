// Offline, in-memory migration execution. Never connects to an external database.
// PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js node scripts/test-mobile-onboarding-migration.mjs
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const modulePath = process.env.PGLITE_MODULE_PATH
if (!modulePath) throw new Error('Set PGLITE_MODULE_PATH to an installed PGlite module; no remote database is used.')
const { PGlite } = await import(pathToFileURL(modulePath).href)
const read = name => fs.readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
const seed = await read('20260922120000_platform_communications.sql')
const brand = await read('20261004100000_refresh_welcome_brand_copy.sql')
const sql = await read('20261013210000_simplify_mobile_onboarding.sql')
const oldBodies = [seed.match(/body text NOT NULL DEFAULT '([^']+)'/)?.[1], brand.match(/SET body = '([^']+)'/)?.[1]]
assert(oldBodies.every(Boolean), 'Historical bodies must be extracted from actual migrations')
const expected = '和孩子选一件想做的事，一起动手试试。'
const quote = value => `'${value.replaceAll("'", "''")}'`
let cases = 0
for (const body of [...oldBodies, '管理员自定义：先完成手中的作品。']) {
  for (const contact of ['/about#contact', '/settings/about#contact', '/help#support']) {
    const db = new PGlite()
    try {
      await db.exec(`CREATE TABLE public.platform_welcome_settings (
        id boolean PRIMARY KEY DEFAULT true CHECK (id),
        enabled boolean NOT NULL DEFAULT false,
        title text NOT NULL DEFAULT '自定义标题',
        body text NOT NULL DEFAULT ${quote(body)},
        contact_href text NOT NULL DEFAULT ${quote(contact)},
        activated_after timestamptz NOT NULL DEFAULT '2026-09-22T00:00:00Z'
      ); INSERT INTO public.platform_welcome_settings DEFAULT VALUES;`)
      const row = async () => (await db.query('SELECT * FROM public.platform_welcome_settings')).rows[0]
      const before = await row()
      await db.exec(sql)
      const once = await row()
      assert.equal(once.body, oldBodies.includes(body) ? expected : body)
      assert.equal(once.contact_href, contact === '/help#support' ? contact : '/about#support')
      for (const key of ['id', 'enabled', 'title', 'activated_after']) assert.deepEqual(once[key], before[key])
      await db.exec(sql)
      assert.deepEqual(await row(), once, 'Running twice must not alter the result')
      await db.exec('DELETE FROM public.platform_welcome_settings; INSERT INTO public.platform_welcome_settings DEFAULT VALUES;')
      assert.deepEqual(await row(), once, 'Column defaults must migrate only when they match known old defaults')
      cases++
    } finally {
      await db.close()
    }
  }
}
console.log(`PASS: ${cases} in-memory migration scenarios, including custom rows/defaults, disabled state and idempotency.`)
