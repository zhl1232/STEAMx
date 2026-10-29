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
  const r = run(['exec','-i',name,'psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-X','-q','-A','-t','-F','|'], { input: text })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}
// Match db:push's dynamic migration statement inside its single atomic DO batch.
const scopedSql = statement => sql(`DO $store_scoped_test$ BEGIN EXECUTE $store_migration_test$${statement}$store_migration_test$; END; $store_scoped_test$;`)
const expectError = (statement, contains) => sql(`DO $$ BEGIN BEGIN PERFORM ${statement}; RAISE EXCEPTION 'expected failure'; EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'expected failure' THEN RAISE; END IF; IF position(${`'${contains.replaceAll("'","''")}'`} in SQLERRM)=0 THEN RAISE EXCEPTION 'wrong error: %', SQLERRM; END IF; END; END $$;`)
const psqlAsync = statement => new Promise((resolve, reject) => {
  const child = spawn('docker',['exec','-i',name,'psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-X','-c',statement], { cwd: root })
  let out = ''; let err = ''; child.stdout.on('data', x => { out += x }); child.stderr.on('data', x => { err += x })
  child.on('close', code => code ? reject(new Error(err || out)) : resolve(out.trim()))
})
// Keep a real transaction open until the other session has reached its row-lock wait.
async function holdRowLock(statement) {
  const child = spawn('docker',['exec','-i',name,'psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-X','-q','-A','-t'], {cwd: root})
  const marker = `locked-${randomUUID()}`
  let output = ''; let errors = ''; let timer
  const closed = new Promise((resolve, reject) => {
    child.stderr.on('data', value => { errors += value })
    child.on('error', reject)
    child.on('close', code => code ? reject(new Error(errors || output)) : resolve())
  })
  const ready = new Promise((resolve, reject) => {
    child.stdout.on('data', value => { output += value; if (output.includes(marker)) resolve() })
    child.on('error', reject)
    child.on('close', () => reject(new Error(`lock holder exited before ready: ${errors}`)))
    timer = setTimeout(() => reject(new Error('row lock holder did not become ready')), 10000)
  })
  child.stdin.write(`BEGIN; ${statement}; SELECT '${marker}';\n`)
  try { await ready } catch (error) { child.stdin.end('ROLLBACK;\n'); await closed; throw error } finally { clearTimeout(timer) }
  return async (statement = 'ROLLBACK;') => { child.stdin.end(`${statement}\n`); await closed }
}
function expectQueryError(statement, expected) {
  try { sql(statement) } catch (error) {
    if (String(error).includes(expected)) return
    throw error
  }
  throw new Error(`expected query failure: ${expected}`)
}

const prelude = `CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions; CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
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
  // Reproduce the production extension layout before applying the repair.
  expectError(`start_store_payment_attempt('${order}','alipay','crypto-regression')`, 'function gen_random_bytes(integer) does not exist')
  const cryptoFix = readFileSync(`${root}/supabase/migrations/20261027003000_store_payment_crypto_schema.sql`, 'utf8')
  scopedSql(cryptoFix)
  scopedSql(cryptoFix)
  const deadlineFix = readFileSync(`${root}/supabase/migrations/20261027012000_store_payment_attempt_deadline.sql`, 'utf8')
  const paymentFunctionSecurity = () => sql(`SELECT jsonb_build_object('owner',proowner,'acl',proacl,'definer',prosecdef,'config',proconfig) FROM pg_proc WHERE oid='public.start_store_payment_attempt(uuid,text,text)'::regprocedure`)
  const beforeDeadlineSecurity = paymentFunctionSecurity()
  scopedSql(deadlineFix)
  scopedSql(deadlineFix)
  if (paymentFunctionSecurity() !== beforeDeadlineSecurity) throw new Error('payment deadline migration changed ownership, ACLs or security settings')
  if (sql(`SELECT has_function_privilege('anon','public.start_store_payment_attempt(uuid,text,text)','execute') OR has_function_privilege('authenticated','public.start_store_payment_attempt(uuid,text,text)','execute') OR NOT has_function_privilege('service_role','public.start_store_payment_attempt(uuid,text,text)','execute')`) !== 'f') throw new Error('payment attempt RPC permissions leaked')
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
  // Apply v1 after the historical scenarios: old orders remain readable and unchanged.
  sql(`ALTER TABLE profiles ADD COLUMN coins integer NOT NULL DEFAULT 0, ADD COLUMN membership_tier text DEFAULT 'free', ADD COLUMN membership_period text DEFAULT 'none', ADD COLUMN membership_expires_at timestamptz;
    CREATE TABLE coin_logs(id bigserial PRIMARY KEY,user_id uuid REFERENCES profiles(id),amount integer,action_type text,resource_id text,created_at timestamptz DEFAULT now());`)
  scopedSql(readFileSync(`${root}/supabase/migrations/20261026140000_store_member_benefits.sql`, 'utf8'))
  sql(`UPDATE store_products SET gallery_urls=ARRAY['https://media.test/gallery.jpg'],detail_content='Reviewed detail',video_url='https://media.test/demo.mp4',category='Science' WHERE id='${ids.adminProduct}'`)
  const mediaState = () => JSON.parse(sql(`SELECT jsonb_build_object('gallery',gallery_urls,'detail',detail_content,'video',video_url,'category',category) FROM store_products WHERE id='${ids.adminProduct}'`))
  const reviewedMedia = JSON.stringify(mediaState())
  const saveCompatibilityCatalog = (media={}) => {
    const product = {version:Number(sql(`SELECT catalog_version FROM store_products WHERE id='${ids.adminProduct}'`)),slug:'admin-version-test',name:'Admin compatibility',status:'draft',priceCents:1100,shippingCents:0,...media}
    const variants = [{id:ids.adminVariant,version:Number(sql(`SELECT catalog_version FROM store_product_variants WHERE id='${ids.adminVariant}'`)),name:'Admin variant',sku:'N-A',priceCents:1100,stockQuantity:2,minQuantity:1,supplierUrl:'manual://admin',costCents:500}]
    sql(`SELECT save_store_native_catalog('${ids.adminProduct}','${JSON.stringify(product)}','${JSON.stringify(variants)}')`)
  }
  saveCompatibilityCatalog()
  if (JSON.stringify(mediaState()) !== reviewedMedia) throw new Error('legacy catalog payload cleared new media fields')
  saveCompatibilityCatalog({galleryUrls:[],detailContent:null,videoUrl:null,category:null})
  const clearedMedia = mediaState()
  if (clearedMedia.gallery.length || clearedMedia.detail !== null || clearedMedia.video !== null || clearedMedia.category !== null) throw new Error('explicit media clearing was ignored')
  saveCompatibilityCatalog({galleryUrls:null})
  if (mediaState().gallery.length !== 0) throw new Error('explicit null gallery did not clear')
  console.info('PASS legacy catalog payload preserves new media, explicit empty/null values clear it')
  const memberVariant = randomUUID(); const memberProduct = randomUUID()
  sql(`INSERT INTO store_products(id,slug,name,source,status,price_cents,shipping_cents,fulfillment_description) VALUES('${memberProduct}','member-fixture','Member fixture','manual','active',1001,100,'Ships in three days');
    INSERT INTO store_product_variants(id,product_id,name,sku,price_cents,stock_quantity,status) VALUES('${memberVariant}','${memberProduct}','Member variant','MEMBER',1001,100,'active');
    INSERT INTO store_product_sources(variant_id,supplier_id,is_primary,source_url,source_price_cents,payload) VALUES('${memberVariant}','${ids.supplier}',true,'https://supplier.test/original',400,'{"supplierVariant":"immutable-A"}');
    UPDATE profiles SET membership_tier='pro',membership_period='monthly',membership_expires_at=now()+interval '1 day',coins=500 WHERE id='${ids.alice}';
    UPDATE profiles SET membership_tier='founder',membership_period='founder',coins=500 WHERE id='${ids.bob}';`)
  const memberItems = JSON.stringify([{variant_id:memberVariant,quantity:3}])
  const legacyOrder = sql(`SELECT create_store_native_order('${ids.alice}','legacy-after-benefits','${ids.address}','encrypted','北京市','[{"variant_id":"${memberVariant}","quantity":1}]')`)
  if (sql(`SELECT original_subtotal_cents,member_subtotal_cents,member_discount_cents,total_cents,membership_tier_snapshot FROM store_orders WHERE id='${legacyOrder}'`) !== '1001|1001|0|1101|free') throw new Error('legacy order did not retain base amount snapshots after benefits migration')
  sql(`SELECT cancel_store_native_order('${legacyOrder}','${ids.alice}')`)
  console.info('PASS legacy order creator fills nonzero original/member snapshots without applying implicit benefits')
  const quote = (user, coupon='NULL', coins=false, quantity=3) => sql(`SELECT quote_store_native_order('${user}','北京市','${JSON.stringify([{variant_id:memberVariant,quantity}])}',${coupon},${coins})`)
  const createMember = (user,key,address,q,coupon='NULL',coins=false,quantity=3) => sql(`SELECT create_store_native_order_v1('${user}','${key}','${address}','encrypted','北京市','${JSON.stringify([{variant_id:memberVariant,quantity}])}','${q}'::jsonb,${coupon},${coins})`)
  async function testPaymentDeadlineDuringLock(expireDuringWait) {
    const key = `payment-deadline-${expireDuringWait ? 'expired' : 'valid'}`
    const paymentOrder = createMember(ids.alice,key,ids.address,quote(ids.alice))
    const release = await holdRowLock(`SELECT id FROM store_orders WHERE id='${paymentOrder}' FOR UPDATE`)
    const application = `payment-deadline-${randomUUID()}`
    let result
    let before
    try {
      sql(`UPDATE store_inventory_reservations SET expires_at=clock_timestamp()+interval '${expireDuringWait ? '5 seconds' : '1 day'}' WHERE order_id='${paymentOrder}'`)
      before = sql(`SELECT to_jsonb(o) FROM store_orders o WHERE id='${paymentOrder}'`)
      result = psqlAsync(`SET statement_timeout='20s'; SET application_name='${application}'; SET ROLE service_role; SELECT start_store_payment_attempt('${paymentOrder}','alipay','${key}')`).then(value=>({value}),error=>({error}))
      let waiting = false
      for (let i=0;i<100;i++) {
        const activity = sql(`SELECT (wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid))>0)::text||':'||(xact_start<(SELECT expires_at FROM store_inventory_reservations WHERE order_id='${paymentOrder}'))::text FROM pg_stat_activity WHERE application_name='${application}'`)
        if (activity === 'true:true') { waiting = true; break }
        if (activity === 'true:false') throw new Error('payment transaction began after the fixture deadline')
        await new Promise(resolve=>setTimeout(resolve,25))
      }
      if (!waiting) throw new Error('payment attempt never reached the order row-lock wait')
      if (expireDuringWait) {
        // Wait against PostgreSQL's real deadline, after proving the transaction began before it.
        sql(`SELECT pg_sleep(greatest(extract(epoch FROM ((SELECT expires_at FROM store_inventory_reservations WHERE order_id='${paymentOrder}')-clock_timestamp())),0)+0.1)`)
        if (sql(`SELECT bool_and(expires_at<=clock_timestamp()) FROM store_inventory_reservations WHERE order_id='${paymentOrder}'`) !== 't') throw new Error('payment reservation did not expire before releasing the order lock')
      }
    } finally { await release(); if (result) await result }
    const outcome = await result
    const attempts = sql(`SELECT count(*) FROM store_payment_attempts WHERE order_id='${paymentOrder}'`)
    if (expireDuringWait) {
      if (!outcome.error || !String(outcome.error).includes('order_expired')) throw new Error(`expired blocked payment must fail with order_expired: ${JSON.stringify(outcome)}`)
      if (attempts !== '0' || sql(`SELECT to_jsonb(o) FROM store_orders o WHERE id='${paymentOrder}'`) !== before) throw new Error('expired blocked payment created an attempt or changed the order/payment status')
    } else {
      if (outcome.error) throw new Error(`unexpired blocked payment failed: ${outcome.error}`)
      if (attempts !== '1' || sql(`SELECT status||':'||payment_status FROM store_orders WHERE id='${paymentOrder}'`) !== 'pending_payment:pending') throw new Error('unexpired blocked payment did not create exactly one pending attempt')
      sql(`SELECT close_store_payment_attempt(id,true) FROM store_payment_attempts WHERE order_id='${paymentOrder}'`)
    }
    sql(`SELECT cancel_store_native_order('${paymentOrder}','${ids.alice}')`)
  }
  await testPaymentDeadlineDuringLock(false)
  await testPaymentDeadlineDuringLock(true)
  console.log('PASS payment deadline after real order-lock waits: valid attempt succeeds; expired attempt rolls back without order changes; migration replay and service-only ACL preserved')
  const proQuote = quote(ids.alice,'NULL',true)
  const pro = JSON.parse(proQuote)
  if (pro.memberSubtotalCents !== 2643 || pro.coinsUsed !== 264 || pro.totalCents !== 2479) throw new Error(`bad aggregate member/coin rounding ${proQuote}`)
  const memberOrder = createMember(ids.alice,'member-coins',ids.address,proQuote,'NULL',true)
  if (sql(`SELECT coins FROM profiles WHERE id='${ids.alice}'`) !== '236') throw new Error('coins not atomically predebited')
  if (createMember(ids.alice,'member-coins',ids.address,'{}','NULL',false) !== memberOrder) throw new Error('retry repriced existing order')
  sql(`UPDATE store_product_sources SET source_url='https://supplier.test/changed',source_price_cents=900 WHERE variant_id='${memberVariant}'; UPDATE profiles SET membership_expires_at=now()-interval '1 second' WHERE id='${ids.alice}';`)
  if (JSON.parse(quote(ids.alice)).membershipTier !== 'free') throw new Error('expired membership retained benefit')
  const paidAttempt = sql(`SELECT start_store_payment_attempt('${memberOrder}','alipay','member-pay')`)
  sql(`SELECT confirm_store_payment('${paidAttempt}',2479,'CNY','member-provider'); SELECT confirm_store_payment('${paidAttempt}',2479,'CNY','member-provider');`)
  if (sql(`SELECT coins FROM profiles WHERE id='${ids.alice}'`) !== '236') throw new Error('payment debited coins twice')
  if (sql(`SELECT snapshot->>'supplierUrl' FROM store_order_procurement_snapshots WHERE order_id='${memberOrder}'`) !== 'https://supplier.test/original') throw new Error('procurement snapshot mutated')
  expectError(`quote_store_native_order('${ids.alice}','北京市','${memberItems}',NULL,true)`, 'active_membership_required')
  expectError(`create_store_native_order_v1('${ids.alice}','changed-quote','${ids.address}','x','北京市','${memberItems}','${proQuote}'::jsonb,NULL,false)`, 'quote_changed')
  const memberAfter = sql(`SELECT request_store_refund('${memberOrder}','${ids.alice}','full refund',false)`)
  sql(`SELECT store_native_admin_action('${memberOrder}','approve_refund','{}','${ids.admin}'); SELECT confirm_store_refund('${memberAfter}',2479,'alipay','${memberAfter.replaceAll('-','')}'); SELECT confirm_store_refund('${memberAfter}',2479,'alipay','${memberAfter.replaceAll('-','')}');`)
  if (sql(`SELECT coins FROM profiles WHERE id='${ids.alice}'`) !== '500' || sql(`SELECT count(*) FROM store_benefit_ledger WHERE order_id='${memberOrder}' AND event='coin_returned'`) !== '1') throw new Error('full refund did not return coins once')
  const founderQuote = quote(ids.bob,'NULL',true)
  const cancelled = createMember(ids.bob,'founder-cancel',ids.address2,founderQuote,'NULL',true)
  const ca = sql(`SELECT start_store_payment_attempt('${cancelled}','wechat','cancel-benefits')`)
  expectError(`cancel_store_native_order('${cancelled}','${ids.bob}')`, 'payment_attempted')
  if (sql(`SELECT coins FROM profiles WHERE id='${ids.bob}'`) !== '260') throw new Error('unsafe cancellation released coins')
  sql(`SELECT close_store_payment_attempt('${ca}',true); SELECT cancel_store_native_order('${cancelled}','${ids.bob}'); SELECT cancel_store_native_order('${cancelled}','${ids.bob}');`)
  if (sql(`SELECT coins FROM profiles WHERE id='${ids.bob}'`) !== '500') throw new Error('cancellation coin release replay')
  const template = randomUUID()
  sql(`INSERT INTO store_coupon_templates(id,title,threshold_cents,discount_cents,valid_days,terms,eligible_product_ids,active) VALUES('${template}','Founder coupon',2000,500,30,'Test founder-only coupon terms',ARRAY['${memberProduct}']::uuid[],true);`)
  const batch = JSON.parse(sql(`SELECT grant_store_coupon_batch('${ids.admin}','${template}','founder-batch',ARRAY['${ids.bob}']::uuid[])`))
  if (JSON.parse(sql(`SELECT grant_store_coupon_batch('${ids.admin}','${template}','founder-batch',ARRAY['${ids.bob}']::uuid[])`)).batchId !== batch.batchId) throw new Error('batch retry not idempotent')
  expectError(`grant_store_coupon_batch('${ids.admin}','${template}','not-founder',ARRAY['${ids.alice}']::uuid[])`, 'founder_required')
  const coupon = sql(`SELECT id FROM store_user_coupons WHERE batch_id='${batch.batchId}'`)
  const couponArg = `'${coupon}'`
  expectError(`quote_store_native_order('${ids.bob}','北京市','${memberItems}','${coupon}',true)`, 'coupon_and_coins_exclusive')
  const couponQuote = quote(ids.bob,couponArg)
  if (JSON.parse(couponQuote).totalCents !== 2002) throw new Error('coupon incorrect founder subtotal')
  const couponOrder = createMember(ids.bob,'coupon-order',ids.address2,couponQuote,couponArg)
  expectError(`quote_store_native_order('${ids.bob}','北京市','${memberItems}','${coupon}',false)`, 'coupon_unavailable')
  sql(`SELECT cancel_store_native_order('${couponOrder}','${ids.bob}');`)
  const expires = sql(`SELECT expires_at FROM store_user_coupons WHERE id='${coupon}'`)
  const reuseOrder = createMember(ids.bob,'coupon-reused',ids.address2,quote(ids.bob,couponArg),couponArg)
  const couponPay = sql(`SELECT start_store_payment_attempt('${reuseOrder}','alipay','coupon-pay')`)
  sql(`SELECT confirm_store_payment('${couponPay}',2002,'CNY','coupon-provider');`)
  const couponAfter = sql(`SELECT request_store_refund('${reuseOrder}','${ids.bob}','refund coupon',false)`)
  sql(`SELECT store_native_admin_action('${reuseOrder}','approve_refund','{}','${ids.admin}'); SELECT confirm_store_refund('${couponAfter}',2002,'alipay','${couponAfter.replaceAll('-','')}'); SELECT confirm_store_refund('${couponAfter}',2002,'alipay','${couponAfter.replaceAll('-','')}');`)
  if (sql(`SELECT status||':'||expires_at FROM store_user_coupons WHERE id='${coupon}'`) !== `available:${expires}`) throw new Error('coupon refund changed expiry or replayed')
  expectError(`quote_store_native_order('${ids.bob}','北京市','[{"variant_id":"${memberVariant}","quantity":1}]','${coupon}',false)`, 'coupon_unavailable')
  // Same coupon across two distinct orders must reserve once, even across sessions.
  const couponRaceQuote = quote(ids.bob,couponArg)
  const couponRaces = await Promise.allSettled(['a','b'].map(key => psqlAsync(`SELECT create_store_native_order_v1('${ids.bob}','coupon-race-${key}','${ids.address2}','x','北京市','${memberItems}','${couponRaceQuote}'::jsonb,'${coupon}',false)`)))
  if (couponRaces.filter(r=>r.status==='fulfilled').length !== 1) throw new Error('coupon was reserved concurrently twice')
  sql(`SELECT cancel_store_native_order(order_id,'${ids.bob}') FROM store_user_coupons WHERE id='${coupon}'; UPDATE profiles SET coins=100 WHERE id='${ids.bob}';`)
  const coinRaceQuote = quote(ids.bob,'NULL',true)
  const coinRaces = await Promise.allSettled(['a','b'].map(key => psqlAsync(`SELECT create_store_native_order_v1('${ids.bob}','coin-race-${key}','${ids.address2}','x','北京市','${memberItems}','${coinRaceQuote}'::jsonb,NULL,true)`)))
  if (coinRaces.filter(r=>r.status==='fulfilled').length !== 1 || sql(`SELECT coins FROM profiles WHERE id='${ids.bob}'`) !== '0') throw new Error('concurrent coin predebit overspent balance')
  sql(`UPDATE profiles SET membership_tier='free',membership_period='none' WHERE id='${ids.bob}';`)
  expectError(`quote_store_native_order('${ids.bob}','北京市','${memberItems}','${coupon}',false)`, 'coupon_unavailable')
  const expiredBatch = randomUUID(); const expiredCoupon = randomUUID()
  sql(`INSERT INTO store_coupon_batches(id,template_id,batch_key,created_by) VALUES('${expiredBatch}','${template}','expired-fixture','${ids.admin}');
    INSERT INTO store_user_coupons(id,batch_id,user_id,title,threshold_cents,discount_cents,terms,eligible_product_ids,expires_at) VALUES('${expiredCoupon}','${expiredBatch}','${ids.bob}','Expired',2000,500,'Expired terms',ARRAY['${memberProduct}']::uuid[],now()-interval '1 second');
    UPDATE profiles SET membership_tier='founder',membership_period='founder' WHERE id='${ids.bob}';`)
  expectError(`quote_store_native_order('${ids.bob}','北京市','${memberItems}','${expiredCoupon}',false)`, 'coupon_unavailable')
  // Role alone never grants a paid membership discount.
  if (JSON.parse(quote(ids.admin)).memberDiscountCents !== 0) throw new Error('admin received implicit member benefits')
  sql(`DO $$ BEGIN BEGIN UPDATE store_user_coupons SET discount_cents=400 WHERE id='${coupon}'; RAISE EXCEPTION 'mutable coupon'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'coupon_terms_immutable' THEN RAISE; END IF; END; END $$;`)
  sql(`DO $$ BEGIN BEGIN UPDATE store_order_procurement_snapshots SET snapshot='{}' WHERE order_id='${memberOrder}'; RAISE EXCEPTION 'mutable snapshot'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'procurement_snapshot_immutable' THEN RAISE; END IF; END; END $$;`)
  if (sql(`SELECT has_function_privilege('authenticated','create_store_native_order_v1(uuid,text,uuid,text,text,jsonb,jsonb,uuid,boolean)','execute') OR has_table_privilege('authenticated','store_order_procurement_snapshots','select')`) !== 'f') throw new Error('private benefit write/read leaked to authenticated')
  // Exercise actual column grants and owner RLS under the browser's database role.
  const ownerColumns = 'id,original_subtotal_cents,member_subtotal_cents,member_discount_cents,coupon_discount_cents,coin_discount_cents,coins_used,membership_tier_snapshot,coupon_id,total_cents'
  const ownerRead = JSON.parse(sql(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='${ids.alice}'; SELECT row_to_json(safe_order) FROM (SELECT ${ownerColumns} FROM store_orders WHERE id='${memberOrder}') safe_order; COMMIT;`))
  if (ownerRead.id !== memberOrder || ownerRead.original_subtotal_cents !== 3003 || ownerRead.member_subtotal_cents !== 2643 || ownerRead.member_discount_cents !== 360 || ownerRead.coin_discount_cents !== 264 || ownerRead.coins_used !== 264 || ownerRead.membership_tier_snapshot !== 'pro' || ownerRead.coupon_discount_cents !== 0 || ownerRead.coupon_id !== null || ownerRead.total_cents !== 2479) throw new Error(`owner cannot read correct safe amount snapshots: ${JSON.stringify(ownerRead)}`)
  if (sql(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='${ids.outsider}'; SELECT count(id) FROM store_orders WHERE id='${memberOrder}'; COMMIT;`) !== '0') throw new Error('outsider read another user order')
  expectQueryError(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='${ids.alice}'; SELECT snapshot FROM store_order_procurement_snapshots WHERE order_id='${memberOrder}'; COMMIT;`, 'permission denied for table store_order_procurement_snapshots')
  expectQueryError(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='${ids.alice}'; SELECT address_snapshot_encrypted FROM store_orders WHERE id='${memberOrder}'; COMMIT;`, 'permission denied for table store_orders')
  console.log('PASS authenticated owner safe-column access, outsider isolation and private procurement/address denial')

  async function expectExpiryDuringLock({lockStatement, expiresAt, createStatement, expectedError, key, userId}) {
    const release = await holdRowLock(lockStatement)
    const application = `expiry-${randomUUID()}`
    const financialState = () => sql(`SELECT jsonb_build_object('coins',(SELECT coins FROM profiles WHERE id='${userId}'),'holds',(SELECT count(*) FROM store_coin_holds WHERE user_id='${userId}'),'ledger',(SELECT count(*) FROM store_benefit_ledger WHERE user_id='${userId}'),'reserved',(SELECT stock_reserved FROM store_product_variants WHERE id='${memberVariant}'))`)
    const before = financialState()
    const result = psqlAsync(`SET application_name='${application}'; ${createStatement}`).then(value => ({value}), error => ({error}))
    let waiting = false
    try {
      for (let i=0; i<40; i++) {
        const activity = sql(`SELECT (wait_event_type='Lock')::text||':'||(xact_start<(${expiresAt}))::text FROM pg_stat_activity WHERE application_name='${application}'`)
        if (activity === 'true:true') { waiting = true; break }
        if (activity === 'true:false') throw new Error('expiry fixture elapsed before the competing transaction began')
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      if (!waiting) throw new Error('competing order never reached a row-lock wait before expiry')
      // The creator's transaction is already open, so now() would be stale after this wait.
      sql(`SELECT pg_sleep(greatest(extract(epoch FROM ((${expiresAt})-clock_timestamp())),0)+0.1)`)
    } finally { await release() }
    const outcome = await result
    if (!outcome.error || !String(outcome.error).includes(expectedError)) throw new Error(`post-lock expiry should fail with ${expectedError}: ${JSON.stringify(outcome)}`)
    if (sql(`SELECT count(*) FROM store_orders WHERE user_id='${userId}' AND external_order_id='${key}'`) !== '0' || financialState() !== before) throw new Error('expired blocked checkout created an order, hold, debit or stock reservation')
  }
  sql(`UPDATE profiles SET membership_tier='pro',membership_period='monthly',membership_expires_at=clock_timestamp()+interval '4 seconds',coins=500 WHERE id='${ids.alice}'`)
  const shortMemberQuote = quote(ids.alice)
  if (JSON.parse(shortMemberQuote).membershipTier !== 'pro') throw new Error('short membership fixture was not active at quote')
  await expectExpiryDuringLock({
    lockStatement: `SELECT id FROM profiles WHERE id='${ids.alice}' FOR UPDATE`,
    expiresAt: `SELECT membership_expires_at FROM profiles WHERE id='${ids.alice}'`,
    createStatement: `SELECT create_store_native_order_v1('${ids.alice}','member-expired-wait','${ids.address}','x','北京市','${memberItems}','${shortMemberQuote}'::jsonb,NULL,false)`,
    expectedError: 'quote_changed', key: 'member-expired-wait', userId: ids.alice,
  })
  const shortBatch = randomUUID(); const shortCoupon = randomUUID()
  sql(`INSERT INTO store_coupon_batches(id,template_id,batch_key,created_by) VALUES('${shortBatch}','${template}','short-expiry-fixture','${ids.admin}');
    INSERT INTO store_user_coupons(id,batch_id,user_id,title,threshold_cents,discount_cents,terms,eligible_product_ids,expires_at) VALUES('${shortCoupon}','${shortBatch}','${ids.bob}','Short expiry',2000,500,'Short expiry terms',ARRAY['${memberProduct}']::uuid[],clock_timestamp()+interval '4 seconds');`)
  const shortCouponQuote = quote(ids.bob,`'${shortCoupon}'`)
  await expectExpiryDuringLock({
    lockStatement: `SELECT id FROM store_user_coupons WHERE id='${shortCoupon}' FOR UPDATE`,
    expiresAt: `SELECT expires_at FROM store_user_coupons WHERE id='${shortCoupon}'`,
    createStatement: `SELECT create_store_native_order_v1('${ids.bob}','coupon-expired-wait','${ids.address2}','x','北京市','${memberItems}','${shortCouponQuote}'::jsonb,'${shortCoupon}',false)`,
    expectedError: 'coupon_unavailable', key: 'coupon-expired-wait', userId: ids.bob,
  })
  if (sql(`SELECT status||':'||(order_id IS NULL)::text FROM store_user_coupons WHERE id='${shortCoupon}'`) !== 'available:true') throw new Error('expired coupon became reserved while waiting')
  console.log('PASS real membership/coupon expiry during two-session row-lock waits, with no order, hold or debit')

  const seed = readFileSync(`${root}/supabase/migrations/20261026160000_store_source_drafts.sql`, 'utf8')
  const seededProducts = "'61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002'"
  scopedSql(seed)
  if (sql(`SELECT count(*) FROM store_products WHERE id IN (${seededProducts}) AND source='1688' AND status='draft' AND stock_quantity=0 AND shipping_cents IS NULL AND fulfillment_description IS NULL`) !== '2') throw new Error('source seed must contain exactly two unconfirmed drafts')
  if (sql(`SELECT count(*)||':'||sum(stock_quantity)||':'||count(*) FILTER(WHERE status='paused') FROM store_product_variants WHERE product_id IN (${seededProducts})`) !== '18:0:18') throw new Error('source seed variants must be eighteen paused zero-stock drafts')
  if (sql(`SELECT count(*) FROM store_product_sources s JOIN store_product_variants v ON v.id=s.variant_id WHERE v.product_id IN (${seededProducts})`) !== '0') throw new Error('source seed created an unverified executable procurement mapping')
  sql(`UPDATE store_products SET name='Reviewed operator title',shipping_cents=123,metadata=metadata||'{"operatorNote":"preserve"}'::jsonb WHERE id='61000000-0000-4000-8000-000000000001'; UPDATE store_product_variants SET name='Reviewed operator variant',stock_quantity=7 WHERE id='62100000-0000-4000-8000-000000000001';`)
  const seedState = () => sql(`SELECT jsonb_build_object('products',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM store_products p WHERE id IN (${seededProducts})),'variants',(SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM store_product_variants v WHERE product_id IN (${seededProducts})))`)
  const beforeReapply = seedState()
  sql(seed)
  if (seedState() !== beforeReapply) throw new Error('reapplying source seed overwrote reviewed operational data or duplicated rows')
  const lockFix = readFileSync(`${root}/supabase/migrations/20261027010000_store_catalog_lock_order.sql`, 'utf8')
  const catalogFunctionSecurity = () => sql(`SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('create_store_native_order','create_store_native_order_v1','save_store_native_catalog')`)
  const beforeLockFixSecurity = catalogFunctionSecurity()
  scopedSql(lockFix)
  scopedSql(lockFix)
  if (catalogFunctionSecurity() !== beforeLockFixSecurity) throw new Error('catalog lock migration changed function ownership, ACLs or security settings')

  // Reproduce the actual cycle: administrator owns the product, creator waits
  // for it, then that same administrator saves the child variant. Both entry
  // points must wait before taking the variant, or the save will deadlock.
  async function testCatalogCheckoutLockOrder({ legacy = false, changedQuote = false }) {
    const productId = randomUUID(); const variantId = randomUUID()
    const key = `catalog-lock-${randomUUID()}`
    const application = `catalog-lock-${randomUUID()}`
    sql(`UPDATE profiles SET membership_tier='pro',membership_period='lifetime',coins=500 WHERE id='${ids.alice}';
      INSERT INTO store_products(id,slug,name,source,status,price_cents,shipping_cents,fulfillment_description) VALUES('${productId}','${key}','Lock order fixture','manual','active',1000,100,'Reviewed delivery');
      INSERT INTO store_product_variants(id,product_id,name,sku,price_cents,stock_quantity,status) VALUES('${variantId}','${productId}','Lock variant','${key}',1000,10,'active');
      INSERT INTO store_product_sources(variant_id,supplier_id,is_primary,source_url,source_price_cents) VALUES('${variantId}','${ids.supplier}',true,'manual://lock-fixture',400);`)
    const items = JSON.stringify([{variant_id:variantId,quantity:1}])
    const expected = sql(`SELECT quote_store_native_order('${ids.alice}','北京市','${items}',NULL,true)`)
    const financialState = () => sql(`SELECT jsonb_build_object('coins',(SELECT coins FROM profiles WHERE id='${ids.alice}'),'holds',(SELECT count(*) FROM store_coin_holds WHERE user_id='${ids.alice}'),'ledger',(SELECT count(*) FROM store_benefit_ledger WHERE user_id='${ids.alice}'),'reserved',(SELECT stock_reserved FROM store_product_variants WHERE id='${variantId}'))`)
    const before = financialState()
    const release = await holdRowLock(`SELECT id FROM store_products WHERE id='${productId}' FOR UPDATE`)
    const createStatement = legacy
      ? `SELECT create_store_native_order('${ids.alice}','${key}','${ids.address}','x','北京市','${items}')`
      : `SELECT create_store_native_order_v1('${ids.alice}','${key}','${ids.address}','x','北京市','${items}','${expected}'::jsonb,NULL,true)`
    const result = psqlAsync(`SET statement_timeout='10s'; SET application_name='${application}'; ${createStatement}`).then(value=>({value}),error=>({error}))
    let waiting = false
    try {
      for (let i=0;i<80;i++) {
        if (sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${application}' AND wait_event_type='Lock'`) === '1') { waiting = true; break }
        await new Promise(resolve=>setTimeout(resolve,25))
      }
      if (!waiting) throw new Error('checkout did not reach the catalog row lock')
      const price = changedQuote ? 1100 : 1000
      const product = {version:Number(sql(`SELECT catalog_version FROM store_products WHERE id='${productId}'`)),slug:key,name:'Saved during checkout',status:'active',priceCents:price,shippingCents:100,fulfillmentDescription:'Reviewed delivery'}
      const variants = [{id:variantId,version:Number(sql(`SELECT catalog_version FROM store_product_variants WHERE id='${variantId}'`)),name:'Lock variant',sku:key,priceCents:price,stockQuantity:10,minQuantity:1,supplierUrl:'manual://lock-fixture',costCents:400}]
      await release(`SET LOCAL statement_timeout='10s'; SELECT save_store_native_catalog('${productId}','${JSON.stringify(product)}','${JSON.stringify(variants)}'); COMMIT;`)
    } catch (error) { await release().catch(()=>{}); await result; throw error }
    const outcome = await result
    if (changedQuote) {
      if (!outcome.error || !String(outcome.error).includes('quote_changed')) throw new Error(`changed catalog quote did not fail safely: ${JSON.stringify(outcome)}`)
      if (financialState() !== before || sql(`SELECT count(*) FROM store_orders WHERE user_id='${ids.alice}' AND external_order_id='${key}'`) !== '0') throw new Error('catalog race failure leaked an order, inventory, coins or benefit ledger')
    } else {
      if (outcome.error) throw new Error(`catalog save/checkout deadlocked or failed: ${outcome.error}`)
      if (sql(`SELECT count(*) FROM store_orders WHERE user_id='${ids.alice}' AND external_order_id='${key}'`) !== '1' || sql(`SELECT stock_reserved FROM store_product_variants WHERE id='${variantId}'`) !== '1') throw new Error('catalog race did not create exactly one reservation')
      if (sql(`SELECT coins FROM profiles WHERE id='${ids.alice}'`) !== (legacy ? '500' : '412')) throw new Error('catalog race coin debit mismatch')
      sql(`SELECT cancel_store_native_order(id,'${ids.alice}') FROM store_orders WHERE user_id='${ids.alice}' AND external_order_id='${key}'`)
      // Cancellation keeps ledger history but restores balances and reservations.
      if (sql(`SELECT coins FROM profiles WHERE id='${ids.alice}'`) !== '500' || sql(`SELECT stock_reserved FROM store_product_variants WHERE id='${variantId}'`) !== '0' || sql(`SELECT count(*) FROM store_coin_holds h JOIN store_orders o ON o.id=h.order_id WHERE o.external_order_id='${key}' AND h.status='reserved'`) !== '0') throw new Error('catalog race cancellation leaked inventory or coin reservation')
    }
  }
  await testCatalogCheckoutLockOrder({legacy:true})
  await testCatalogCheckoutLockOrder({})
  await testCatalogCheckoutLockOrder({changedQuote:true})
  console.log('PASS real product-lock/catalog-save races for legacy/v1 checkout, changed-quote rollback, migration replay and ACL preservation')
  console.log('PASS source seed: two drafts, eighteen paused zero-stock variants, unconfirmed shipping, no source mappings, reapply preserves edits')
  console.log('PASS membership discounts, frozen quotes, coin reserve/pay/cancel/refund replay, coupon grant/use/restore and immutable procurement')
  const makeRecoveryRefund = ({user=ids.alice,address=ids.address,coupon='NULL',coins=true,provider='wechat',key}) => {
    const quoted = quote(user,coupon,coins)
    const recoveryOrder = createMember(user,key,address,quoted,coupon,coins)
    const amount = JSON.parse(quoted).totalCents
    const paymentAttempt = sql(`SELECT start_store_payment_attempt('${recoveryOrder}','${provider}','${key}')`)
    sql(`SELECT confirm_store_payment('${paymentAttempt}',${amount},'CNY','${key}-provider-payment')`)
    const paymentReference = sql(`SELECT payment_reference FROM store_orders WHERE id='${recoveryOrder}'`)
    const aftersale = sql(`SELECT request_store_refund('${recoveryOrder}','${user}','Refund recovery fixture',false)`)
    sql(`SELECT store_native_admin_action('${recoveryOrder}','approve_refund','{}','${ids.admin}')`)
    return {order:recoveryOrder,aftersale,amount,paymentReference,reference:aftersale.replaceAll('-',''),provider}
  }
  // This approved refund predates the migration and must keep its channel ID.
  const recoveredClosed = makeRecoveryRefund({key:'recovery-legacy-pending'})
  const refundFix = readFileSync(`${root}/supabase/migrations/20261027011000_store_refund_recovery.sql`, 'utf8')
  scopedSql(refundFix)
  scopedSql(refundFix)
  const refundState = fixture => sql(`SELECT jsonb_build_object('order',(SELECT status||':'||payment_status FROM store_orders WHERE id='${fixture.order}'),'aftersale',(SELECT to_jsonb(a) FROM store_aftersales a WHERE id='${fixture.aftersale}'),'attempts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY attempt_no) FROM store_refund_attempts r WHERE aftersale_id='${fixture.aftersale}'),'coins',(SELECT coins FROM profiles WHERE id='${ids.alice}'),'ledger',(SELECT count(*) FROM store_benefit_ledger WHERE order_id='${fixture.order}'))`)
  const getAttempt = fixture => JSON.parse(sql(`SELECT get_store_refund_attempt('${fixture.order}')`))
  const recordResult = (fixture,reference,status,amount=fixture.amount) => `record_store_refund_result('${fixture.order}','${reference}','${fixture.provider}','${fixture.paymentReference}',${amount},'CNY','${status}')`
  const recoveredInitial = getAttempt(recoveredClosed)
  if (recoveredInitial.refund_reference !== recoveredClosed.reference || recoveredInitial.attempt_no !== 1 || recoveredInitial.status !== 'pending') throw new Error('pending legacy refund lost its original channel reference')
  const oldRefundLedger = sql(`SELECT count(*) FROM store_benefit_ledger WHERE order_id='${memberOrder}'`)
  if (JSON.parse(sql(`SELECT get_store_refund_attempt('${memberOrder}')`)).refund_reference !== memberAfter.replaceAll('-','')) throw new Error('refunded legacy order lost its channel reference')
  sql(`SELECT confirm_store_refund('${memberAfter}',2479,'alipay','${memberAfter.replaceAll('-','')}')`)
  if (sql(`SELECT count(*) FROM store_benefit_ledger WHERE order_id='${memberOrder}'`) !== oldRefundLedger) throw new Error('legacy refund replay duplicated benefit settlement')
  const beforeMismatch = refundState(recoveredClosed)
  expectError(recordResult(recoveredClosed,recoveredClosed.reference,'closed',recoveredClosed.amount+1),'refund_confirmation_mismatch')
  if (refundState(recoveredClosed) !== beforeMismatch) throw new Error('mismatched refund amount persisted a channel result')
  expectError(`restart_store_refund_attempt('${recoveredClosed.order}','${recoveredClosed.reference}','${ids.admin}')`,'refund_closure_not_confirmed')
  expectError(`restart_store_refund_attempt('${recoveredClosed.order}','${recoveredClosed.reference}','${ids.outsider}')`,'admin_required')
  const beforeClosedCoins = sql(`SELECT coins FROM profiles WHERE id='${ids.alice}'`)
  sql(`SELECT ${recordResult(recoveredClosed,recoveredClosed.reference,'closed')}`)
  if (sql(`SELECT coins FROM profiles WHERE id='${ids.alice}'`) !== beforeClosedCoins || sql(`SELECT count(*) FROM store_benefit_ledger WHERE order_id='${recoveredClosed.order}' AND event='coin_returned'`) !== '0' || sql(`SELECT status FROM store_coin_holds WHERE order_id='${recoveredClosed.order}'`) !== 'consumed') throw new Error('closed channel refund returned coins before verified success')
  expectError(`confirm_store_refund('${recoveredClosed.aftersale}',${recoveredClosed.amount},'wechat','${recoveredClosed.reference}')`,'refund_requires_manual_reconciliation')
  const restarts = await Promise.all([
    psqlAsync(`SELECT restart_store_refund_attempt('${recoveredClosed.order}','${recoveredClosed.reference}','${ids.admin}')`),
    psqlAsync(`SELECT restart_store_refund_attempt('${recoveredClosed.order}','${recoveredClosed.reference}','${ids.admin}')`),
  ])
  const nextAttempt = getAttempt(recoveredClosed)
  if (restarts[0] !== restarts[1] || nextAttempt.attempt_no !== 2 || nextAttempt.refund_reference === recoveredClosed.reference || sql(`SELECT count(*) FROM store_refund_attempts WHERE aftersale_id='${recoveredClosed.aftersale}'`) !== '2') throw new Error('concurrent refund restart created more than one successor')
  expectError(recordResult(recoveredClosed,recoveredClosed.reference,'closed'),'stale_refund_attempt')
  expectError(`confirm_store_refund('${recoveredClosed.aftersale}',${recoveredClosed.amount},'wechat','${recoveredClosed.reference}')`,'refund_confirmation_mismatch')
  expectError(`restart_store_refund_attempt('${recoveredClosed.order}','unknown-old-reference','${ids.admin}')`,'stale_refund_attempt')
  const rotatedState = refundState(recoveredClosed)
  scopedSql(refundFix)
  if (refundState(recoveredClosed) !== rotatedState) throw new Error('refund migration replay overwrote a rotated channel reference or state')
  sql(`SELECT confirm_store_refund('${recoveredClosed.aftersale}',${recoveredClosed.amount},'wechat','${nextAttempt.refund_reference}'); SELECT confirm_store_refund('${recoveredClosed.aftersale}',${recoveredClosed.amount},'wechat','${nextAttempt.refund_reference}');`)
  if (sql(`SELECT coins FROM profiles WHERE id='${ids.alice}'`) !== '500' || sql(`SELECT count(*) FROM store_benefit_ledger WHERE order_id='${recoveredClosed.order}' AND event='coin_returned'`) !== '1' || sql(`SELECT count(*) FROM store_order_events WHERE order_id='${recoveredClosed.order}' AND event_type='refunded'`) !== '1') throw new Error('restarted refund did not return coins exactly once')

  const recoveredAbnormal = makeRecoveryRefund({user:ids.bob,address:ids.address2,coupon:couponArg,coins:false,key:'recovery-abnormal-coupon'})
  if (getAttempt(recoveredAbnormal).refund_reference !== recoveredAbnormal.reference) throw new Error('new refund initial reference changed')
  sql(`SELECT ${recordResult(recoveredAbnormal,recoveredAbnormal.reference,'abnormal')}`)
  expectError(`restart_store_refund_attempt('${recoveredAbnormal.order}','${recoveredAbnormal.reference}','${ids.admin}')`,'refund_closure_not_confirmed')
  sql(`SELECT ${recordResult(recoveredAbnormal,recoveredAbnormal.reference,'pending')}`)
  if (getAttempt(recoveredAbnormal).status !== 'abnormal' || sql(`SELECT status FROM store_user_coupons WHERE id='${coupon}'`) !== 'used') throw new Error('abnormal refund regressed to pending or prematurely returned coupon')
  sql(`SELECT confirm_store_refund('${recoveredAbnormal.aftersale}',${recoveredAbnormal.amount},'wechat','${recoveredAbnormal.reference}'); SELECT confirm_store_refund('${recoveredAbnormal.aftersale}',${recoveredAbnormal.amount},'wechat','${recoveredAbnormal.reference}');`)
  if (getAttempt(recoveredAbnormal).status !== 'refunded' || sql(`SELECT status FROM store_user_coupons WHERE id='${coupon}'`) !== 'available' || sql(`SELECT count(*) FROM store_benefit_ledger WHERE order_id='${recoveredAbnormal.order}' AND event='coupon_returned'`) !== '1') throw new Error('verified abnormal refund success did not return its coupon once')
  const refundFunctions = ['get_store_refund_attempt(uuid)','record_store_refund_result(uuid,text,text,text,integer,text,text)','restart_store_refund_attempt(uuid,text,uuid)','confirm_store_refund(uuid,integer,text,text)']
  for (const signature of refundFunctions) {
    if (sql(`SELECT has_function_privilege('anon','${signature}','execute') OR has_function_privilege('authenticated','${signature}','execute') OR NOT has_function_privilege('service_role','${signature}','execute')`) !== 'f') throw new Error(`refund RPC permissions leaked: ${signature}`)
  }
  if (sql(`SELECT has_table_privilege('authenticated','store_refund_attempts','select') OR has_table_privilege('anon','store_refund_attempts','select')`) !== 'f') throw new Error('private refund attempts exposed to browser roles')
  expectQueryError(`BEGIN; SET LOCAL ROLE authenticated; SELECT * FROM store_refund_attempts; COMMIT;`,'permission denied for table store_refund_attempts')
  console.log('PASS refund recovery: legacy/new channel references, closed concurrent restart, stale/admin/amount guards, abnormal-to-success, exactly-once coin/coupon return, replay and private ACLs')
  scopedSql(readFileSync(new URL('../supabase/migrations/20261029120000_coin_coupon_exchange.sql', import.meta.url), 'utf8'))
  sql(`UPDATE store_product_variants SET stock_quantity=1000,stock_reserved=0 WHERE product_id='${memberProduct}'; UPDATE profiles SET coins=1000 WHERE id='${ids.alice}';`)
  const offer = JSON.parse(sql(`SELECT save_store_coupon_offer('{"templateId":"${template}","coinPrice":100,"totalLimit":2,"perUserLimit":1,"active":true}'::jsonb)`))
  const offers = JSON.parse(sql(`SELECT list_store_coupon_offers('${ids.alice}')`))
  const quotedOffer = offers.find(o => o.id === offer.id)
  if (!quotedOffer?.available) throw new Error('exchange offer unavailable')
  const exchangeCall = `exchange_store_coupon('${ids.alice}','${offer.id}','${quotedOffer.version}','exchange-test')`
  const concurrent = await Promise.all([psqlAsync(`SELECT ${exchangeCall}`), psqlAsync(`SELECT ${exchangeCall}`)])
  const exchange = JSON.parse(sql(`SELECT ${exchangeCall}`))
  if (!concurrent.every(result => result.includes(exchange.id))) throw new Error('concurrent intent did not recover one exchange')
  if (JSON.parse(quote(ids.alice,`'${exchange.coupon_id}'`,false)).couponDiscountCents !== 500) throw new Error('ordinary user cannot use exchange coupon')
  sql(`UPDATE store_coupon_offers SET active=false WHERE id='${offer.id}'`)
  if (JSON.parse(sql(`SELECT ${exchangeCall}`)).id !== exchange.id) throw new Error('closed offer blocked completed intent')
  sql(`UPDATE store_coupon_offers SET active=true WHERE id='${offer.id}'`)
  if (JSON.parse(sql(`SELECT ${exchangeCall}`)).id !== exchange.id || sql(`SELECT coins FROM profiles WHERE id='${ids.alice}'`) !== '900') throw new Error('exchange retry double spent')
  if(sql(`SELECT usage_policy || ':' || source FROM store_user_coupons WHERE id='${exchange.coupon_id}'`) !== 'all:coin_exchange') throw new Error('exchange coupon eligibility incorrect')
  const latestVersion = JSON.parse(sql(`SELECT list_store_coupon_offers('${ids.alice}')`)).find(o=>o.id===offer.id).version
  expectError(`exchange_store_coupon('${ids.alice}','${offer.id}','${latestVersion}','exchange-limit')`,'exchange_limit')
  expectError(`quote_store_native_order('${ids.alice}','北京市','[]',NULL,true)`,'direct_coins_disabled')
  console.log('PASS coupon exchange: migration, eligibility, atomic debit, retry, limits and direct coins removal')
  console.log('PASS native commerce PostgreSQL integration suite')
} catch (error) { console.error(`FAIL native commerce PostgreSQL integration suite\n${error.stack || error}`); process.exitCode = 1 } finally { if (started) run(['rm','-f',name]) }
