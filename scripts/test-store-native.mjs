#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const root = new URL('..', import.meta.url).pathname
const name = `store-native-${process.pid}-${Date.now()}`
const image = process.env.STORE_NATIVE_PG_IMAGE || 'postgres:16-alpine'
const migrations = ['20260822120000_store_foundation.sql','20260823100000_store_external_checkout.sql','20260823110000_store_context_keys.sql','20260926120000_store_native_transactions.sql','20260926121000_store_native_actions.sql','20260927090000_store_catalog_versions.sql']
const run = (args, opts = {}) => spawnSync('docker', args, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, ...opts })
const sql = (text, opts = {}) => {
  const r = run(['exec','-i',name,'psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-X','-A','-t','-F','|'], { input: text })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}
const expectError = (statement, contains) => sql(`DO $$ BEGIN BEGIN PERFORM ${statement}; RAISE EXCEPTION 'expected failure'; EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'expected failure' THEN RAISE; END IF; IF position(${`'${contains.replaceAll("'","''")}'`} in SQLERRM)=0 THEN RAISE EXCEPTION 'wrong error: %', SQLERRM; END IF; END; END $$;`)
const psqlAsync = statement => new Promise((resolve, reject) => {
  const child = spawn('docker',['exec','-i',name,'psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-X','-c',statement], { cwd: root })
  let out = ''; let err = ''; child.stdout.on('data', x => { out += x }); child.stderr.on('data', x => { err += x })
  child.on('close', code => code ? reject(new Error(err || out)) : resolve(out.trim()))
})
const prelude = `CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), role text NOT NULL DEFAULT 'user');`
let started = false
try {
  const start = run(['run','--detach','--rm','--name',name,'-e','POSTGRES_PASSWORD=test',image])
  if (start.status !== 0) throw new Error(start.stderr || start.stdout)
  started = true
  for (let i = 0; i < 60; i++) { if (run(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']).status === 0) break; if (i === 59) throw new Error('postgres did not become ready'); await new Promise(r => setTimeout(r, 500)) }
  sql(prelude)
  for (const file of migrations) sql(readFileSync(`${root}/supabase/migrations/${file}`, 'utf8'))
  const ids = Object.fromEntries(['alice','bob','admin','outsider','address','address2','product','blockedProduct','adminProduct','variant','variant2','raceVariant','sameVariant','moqVariant','blockedVariant','adminVariant','supplier'].map(k => [k, randomUUID()]))
  sql(`INSERT INTO auth.users(id,email) VALUES ('${ids.alice}','alice@test'),('${ids.bob}','bob@test'),('${ids.admin}','admin@test'),('${ids.outsider}','outsider@test');
    INSERT INTO profiles(id,role) VALUES ('${ids.alice}','user'),('${ids.bob}','user'),('${ids.admin}','admin'),('${ids.outsider}','user');
    INSERT INTO store_addresses(id,user_id,recipient_name_masked,phone_last4,payload_encrypted,is_default) VALUES ('${ids.address}','${ids.alice}','A***','1234','encrypted-address',true);
    INSERT INTO store_addresses(id,user_id,recipient_name_masked,phone_last4,payload_encrypted,is_default) VALUES ('${ids.address2}','${ids.bob}','B***','5678','encrypted-address-2',true);
    INSERT INTO store_suppliers(id,name,source) VALUES ('${ids.supplier}','Manual','manual');
    INSERT INTO store_products(id,slug,name,source,status,price_cents,shipping_cents,blocked_provinces,checkout_mode) VALUES ('${ids.product}','native-test','Native test','manual','active',1000,100,ARRAY['香港特别行政区'],'internal');
    INSERT INTO store_product_variants(id,product_id,name,sku,price_cents,stock_quantity,min_quantity,status) VALUES ('${ids.variant}','${ids.product}','Default','N-1',1000,1,1,'active');
    INSERT INTO store_product_sources(variant_id,supplier_id,offer_id,is_primary) VALUES ('${ids.variant}','${ids.supplier}','manual-offer',true);`)
  sql(`INSERT INTO store_product_variants(id,product_id,name,sku,price_cents,stock_quantity,min_quantity,status) VALUES ('${ids.variant2}','${ids.product}','Cancel fixture','N-2',1000,1,1,'active'); INSERT INTO store_product_sources(variant_id,supplier_id,offer_id,is_primary) VALUES ('${ids.variant2}','${ids.supplier}','manual-offer-2',true);`)
  sql(`INSERT INTO store_product_variants(id,product_id,name,sku,price_cents,stock_quantity,min_quantity,status) VALUES ('${ids.raceVariant}','${ids.product}','Race fixture','N-R',1000,1,1,'active'),('${ids.sameVariant}','${ids.product}','Same key fixture','N-S',1000,1,1,'active'),('${ids.moqVariant}','${ids.product}','MOQ fixture','N-M',1000,5,2,'active'); INSERT INTO store_product_sources(variant_id,supplier_id,offer_id,is_primary) VALUES ('${ids.raceVariant}','${ids.supplier}','race-offer',true),('${ids.sameVariant}','${ids.supplier}','same-offer',true),('${ids.moqVariant}','${ids.supplier}','moq-offer',true); INSERT INTO store_products(id,slug,name,source,status,price_cents,shipping_cents,blocked_provinces,checkout_mode) VALUES ('${ids.blockedProduct}','blocked-test','Blocked test','manual','active',1000,0,ARRAY['北京市'],'internal'); INSERT INTO store_product_variants(id,product_id,name,sku,price_cents,stock_quantity,min_quantity,status) VALUES ('${ids.blockedVariant}','${ids.blockedProduct}','Blocked','N-B',1000,2,1,'active'); INSERT INTO store_product_sources(variant_id,supplier_id,offer_id,is_primary) VALUES ('${ids.blockedVariant}','${ids.supplier}','blocked-offer',true);`)
  sql(`INSERT INTO store_products(id,slug,name,source,status,price_cents,shipping_cents,blocked_provinces,checkout_mode) VALUES ('${ids.adminProduct}','admin-version-test','Admin version test','manual','active',1000,0,ARRAY[]::text[],'internal'); INSERT INTO store_product_variants(id,product_id,name,sku,price_cents,stock_quantity,min_quantity,status) VALUES ('${ids.adminVariant}','${ids.adminProduct}','Admin variant','N-A',1000,2,1,'active'); INSERT INTO store_product_sources(variant_id,supplier_id,offer_id,is_primary) VALUES ('${ids.adminVariant}','${ids.supplier}','admin-offer',true);`)
  const draftProductVersion = sql(`SELECT catalog_version FROM store_products WHERE id='${ids.product}'`)
  const item = JSON.stringify([{variant_id: ids.variant, quantity: 1, client_unit_price_cents: 1}]).replaceAll("'", "''")
  const order = sql(`SELECT create_store_native_order('${ids.alice}','idem-1','${ids.address}','snapshot','北京市','${item}'::jsonb)`).trim()
  const draftVariantVersion = sql(`SELECT catalog_version FROM store_product_variants WHERE id='${ids.variant}'`)
  if (order !== sql(`SELECT create_store_native_order('${ids.alice}','idem-1','${ids.address}','tampered','北京市','${item}'::jsonb)`)) throw new Error('idempotency returned different order')
  const row = sql(`SELECT subtotal_cents,total_cents,(SELECT unit_price_cents FROM store_order_items WHERE order_id='${order}') FROM store_orders WHERE id='${order}'`, {csv:true}); if (row !== '1000|1100|1000') throw new Error(`client price was accepted: ${row}`)
  expectError(`create_store_native_order('${ids.alice}','bad-moq','${ids.address}','x','北京市','[{"variant_id":"${ids.moqVariant}","quantity":1}]'::jsonb)`, 'native_variant_unavailable')
  expectError(`create_store_native_order('${ids.alice}','bad-region','${ids.address}','x','香港特别行政区','[{"variant_id":"${ids.variant}","quantity":1}]'::jsonb)`, 'mainland_province_required')
  expectError(`create_store_native_order('${ids.alice}','bad-block','${ids.address}','x','北京市','[{"variant_id":"${ids.blockedVariant}","quantity":1}]'::jsonb)`, 'province_blocked')
  const races = await Promise.allSettled([psqlAsync(`SELECT create_store_native_order('${ids.alice}','race-a','${ids.address}','x','北京市','[{"variant_id":"${ids.raceVariant}","quantity":1}]'::jsonb)`), psqlAsync(`SELECT create_store_native_order('${ids.bob}','race-b','${ids.address2}','x','北京市','[{"variant_id":"${ids.raceVariant}","quantity":1}]'::jsonb)` )])
  if (races.filter(x => x.status === 'fulfilled').length !== 1) throw new Error(`concurrency expected one success: ${JSON.stringify(races)}`)
  if (sql(`SELECT stock_reserved||':'||(SELECT count(*) FROM store_orders o JOIN store_order_items i ON i.order_id=o.id WHERE i.variant_id='${ids.raceVariant}') FROM store_product_variants WHERE id='${ids.raceVariant}'`) !== '1:1') throw new Error('concurrency final reservation mismatch')
  const same = await Promise.all([psqlAsync(`SELECT create_store_native_order('${ids.alice}','same-key','${ids.address}','x','北京市','[{"variant_id":"${ids.sameVariant}","quantity":1}]'::jsonb)`), psqlAsync(`SELECT create_store_native_order('${ids.alice}','same-key','${ids.address}','x','北京市','[{"variant_id":"${ids.sameVariant}","quantity":1}]'::jsonb)`)]); if (same[0].split('\n').pop() !== same[1].split('\n').pop()) throw new Error('same-key concurrency returned different ids')
  if (sql(`SELECT count(*) FROM store_orders WHERE user_id='${ids.alice}' AND external_order_id='same-key'`) !== '1') throw new Error('same-key duplicate order')
  const attempt = sql(`SELECT start_store_payment_attempt('${order}','alipay','token-a')`); if (sql(`SELECT start_store_payment_attempt('${order}','alipay','token-a')`) !== attempt) throw new Error('payment idempotency failed')
  expectError(`start_store_payment_attempt('${order}','wechat','token-b')`, 'close_previous_attempt_first'); expectError(`close_store_payment_attempt('${attempt}',false)`, 'channel_close_confirmation_required'); sql(`SELECT close_store_payment_attempt('${attempt}',true)`)
  const attempt2 = sql(`SELECT start_store_payment_attempt('${order}','wechat','token-b')`); sql(`SELECT confirm_store_payment('${attempt2}',1100,'CNY','provider-1')`); sql(`SELECT confirm_store_payment('${attempt2}',1100,'CNY','provider-1')`)
  const paid = sql(`SELECT status,payment_status,(SELECT stock_quantity||':'||stock_reserved||':'||stock_sold FROM store_product_variants WHERE id='${ids.variant}'),(SELECT count(*) FROM store_procurements WHERE order_id='${order}'),(SELECT source FROM store_procurements WHERE order_id='${order}'),(SELECT count(*) FROM store_sync_jobs WHERE order_id='${order}') FROM store_orders WHERE id='${order}'`, {csv:true}); if (paid !== 'paid|paid|0:0:1|1|manual|0') throw new Error(`bad payment result: ${paid}`)
  expectError(`save_store_native_catalog('${ids.product}', '{"version":${draftProductVersion},"slug":"native-test","name":"Stale draft","source":"manual","status":"active","priceCents":1200,"shippingCents":0}', '[{"id":"${ids.variant}","version":${draftVariantVersion},"name":"Stale draft","sku":"N-1","priceCents":1200,"stockQuantity":1,"minQuantity":1}]'::jsonb)`, 'catalog_version_conflict')
  const paidState = sql(`SELECT (SELECT stock_quantity||':'||stock_sold FROM store_product_variants WHERE id='${ids.variant}'),(SELECT name FROM store_products WHERE id='${ids.product}')`, {csv:true}); if (paidState !== '0:1|Native test') throw new Error(`stale draft changed paid catalog: ${paidState}`)
  const freshProductVersion = sql(`SELECT catalog_version FROM store_products WHERE id='${ids.product}'`)
  const freshVariantVersion = sql(`SELECT catalog_version FROM store_product_variants WHERE id='${ids.variant}'`)
  const freshVariant2Version = sql(`SELECT catalog_version FROM store_product_variants WHERE id='${ids.variant2}'`)
  sql(`SELECT save_store_native_catalog('${ids.product}', '{"version":${freshProductVersion},"slug":"native-test","name":"Fresh stock update","source":"manual","status":"active","priceCents":1200,"shippingCents":0}', '[{"id":"${ids.variant}","version":${freshVariantVersion},"name":"Fresh stock update","sku":"N-1","priceCents":1200,"stockQuantity":2,"minQuantity":1,"supplierUrl":"manual://same","costCents":400},{"id":"${ids.variant2}","version":${freshVariant2Version},"name":"Cancel fixture","sku":"N-2","priceCents":1000,"stockQuantity":1,"minQuantity":1,"supplierUrl":"manual://same","costCents":400}]'::jsonb)`)
  if (sql(`SELECT stock_quantity||':'||stock_sold||':'||(SELECT name FROM store_products WHERE id='${ids.product}') FROM store_product_variants WHERE id='${ids.variant}'`) !== '2:1:Fresh stock update') throw new Error('fresh version stock update failed')
  const cancelOrder = sql(`SELECT create_store_native_order('${ids.bob}','cancel-1','${ids.address2}','snapshot','北京市','[{"variant_id":"${ids.variant2}","quantity":1}]'::jsonb)`)
  const cancelAttempt = sql(`SELECT start_store_payment_attempt('${cancelOrder}','alipay','cancel-token')`)
  sql(`SELECT close_store_payment_attempt('${cancelAttempt}',true)`)
  sql(`SELECT cancel_store_native_order('${cancelOrder}','${ids.bob}')`)
  if (sql(`SELECT cancel_store_native_order('${cancelOrder}','${ids.bob}')`) !== 'f') throw new Error('cancel was not idempotent')
  if (sql(`SELECT stock_reserved FROM store_product_variants WHERE id='${ids.variant2}'`) !== '0') throw new Error('cancel did not release reservation once')
  const af = sql(`SELECT request_store_refund('${order}','${ids.alice}','return please',true)`); expectError(`request_store_refund('${order}','${ids.outsider}','wrong owner',true)`, 'order_not_refundable'); expectError(`store_native_user_action('${order}','${ids.outsider}','return_shipped','{"carrier":"SF","trackingNumber":"BAD"}'::jsonb)`, 'order_missing'); expectError(`confirm_store_refund('${af}',999,'wechat','${af.replaceAll('-','')}')`, 'refund_confirmation_mismatch'); expectError(`confirm_store_refund('${af}',1100,'alipay','${af.replaceAll('-','')}')`, 'refund_confirmation_mismatch'); expectError(`confirm_store_refund('${af}',1100,'wechat','wrong-ref')`, 'refund_confirmation_mismatch'); expectError(`confirm_store_refund('${af}',1100,'wechat','${af.replaceAll('-','')}')`, 'refund_not_approved'); expectError(`store_native_admin_action('${order}','approve_refund','{}'::jsonb,'${ids.outsider}')`, 'admin_required')
  sql(`SELECT store_native_admin_action('${order}','require_return','{"returnAddressEncrypted":"this-is-a-long-encrypted-return-address"}'::jsonb,'${ids.admin}')`); sql(`SELECT store_native_user_action('${order}','${ids.alice}','return_shipped','{"carrier":"SF","trackingNumber":"SF123"}'::jsonb)`); sql(`SELECT store_native_admin_action('${order}','receive_return','{}'::jsonb,'${ids.admin}')`); sql(`SELECT confirm_store_refund('${af}',1100,'wechat','${af.replaceAll('-','')}')`); sql(`SELECT confirm_store_refund('${af}',1100,'wechat','${af.replaceAll('-','')}')`)
  const refunded = sql(`SELECT status,payment_status,(SELECT status FROM store_procurements WHERE order_id='${order}'),(SELECT count(*) FROM store_order_events WHERE order_id='${order}' AND event_type='refunded') FROM store_orders WHERE id='${order}'`, {csv:true}); if (refunded !== 'refunded|refunded|cancelled|1') throw new Error(`bad refund result: ${refunded}`)
  const catalogSave = (productName, variantName, stockQuantity) => {
    const productVersion = sql(`SELECT catalog_version FROM store_products WHERE id='${ids.product}'`)
    const variantVersion = sql(`SELECT catalog_version FROM store_product_variants WHERE id='${ids.raceVariant}'`)
    return sql(`SELECT save_store_native_catalog('${ids.product}', '{"version":${productVersion},"slug":"native-test","name":"${productName}","source":"manual","status":"active","priceCents":1200,"shippingCents":0}', '[{"id":"${ids.raceVariant}","version":${variantVersion},"name":"${variantName}","sku":"N-R","priceCents":1200,"stockQuantity":${stockQuantity},"minQuantity":1,"supplierUrl":"manual://same","costCents":400}]'::jsonb)`)
  }
  catalogSave('Changed', 'Changed', 1); if (sql(`SELECT shipping_cents FROM store_products WHERE id='${ids.product}'`) !== '0') throw new Error('zero shipping was not preserved'); const sourceCount = sql(`SELECT count(*) FROM store_product_sources WHERE variant_id='${ids.raceVariant}'`)
  catalogSave('Changed', 'Changed', 1); if (sql(`SELECT count(*) FROM store_product_sources WHERE variant_id='${ids.raceVariant}'`) !== sourceCount) throw new Error('repeated catalog save duplicated source')
  const rollbackProductVersion = sql(`SELECT catalog_version FROM store_products WHERE id='${ids.product}'`)
  const rollbackVariantVersion = sql(`SELECT catalog_version FROM store_product_variants WHERE id='${ids.raceVariant}'`)
  expectError(`save_store_native_catalog('${ids.product}', '{"version":${rollbackProductVersion},"slug":"native-test","name":"Rollback","source":"manual","status":"active","priceCents":1200,"shippingCents":0}', '[{"id":"${ids.raceVariant}","version":${rollbackVariantVersion},"name":"Rollback","sku":"N-R","stockQuantity":0,"minQuantity":1}]'::jsonb)`, 'stock_below_reserved'); if (sql(`SELECT name FROM store_products WHERE id='${ids.product}'`) !== 'Changed') throw new Error('catalog rollback failed')
  const adminDraft = `save_store_native_catalog('${ids.adminProduct}', '{"version":0,"slug":"admin-version-test","name":"Admin draft","source":"manual","status":"active","priceCents":1100,"shippingCents":0}', '[{"id":"${ids.adminVariant}","version":0,"name":"Admin variant","sku":"N-A","priceCents":1100,"stockQuantity":2,"minQuantity":1,"supplierUrl":"manual://admin","costCents":500}]'::jsonb)`
  const adminSaves = await Promise.allSettled([psqlAsync(`SELECT ${adminDraft}`), psqlAsync(`SELECT ${adminDraft}`)])
  if (adminSaves.filter(x => x.status === 'fulfilled').length !== 1 || adminSaves.filter(x => x.status === 'rejected' && String(x.reason).includes('catalog_version_conflict')).length !== 1) throw new Error(`concurrent stale admin save mismatch: ${JSON.stringify(adminSaves)}`)
  console.log('PASS native commerce PostgreSQL integration suite')
} catch (error) { console.error(`FAIL native commerce PostgreSQL integration suite\n${error.stack || error}`); process.exitCode = 1 } finally { if (started) run(['rm','-f',name]) }
