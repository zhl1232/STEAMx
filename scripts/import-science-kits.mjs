#!/usr/bin/env node
/** Generate reviewable SQL only; apply the resulting migration with pnpm db:push.
 * node scripts/import-science-kits.mjs --projects=/path/to/project-snapshot.json --output=/tmp/review.sql
 * No credentials, network requests, publication or database mutations occur here.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const literal = value => `'${String(value).replaceAll("'", "''")}'`
const json = value => `${literal(JSON.stringify(value))}::jsonb`
const uuid = value => { const h=createHash('md5').update(`science-offer-731063650115:${value}`).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20)}` }
const oldIds = ['61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002']
const packNote = '按班级或年级配套的16项实验材料，按盒内目录选择对应教程。清水等日常材料按项目清单自备，耗材使用后需补充。'
const note = '器材可重复使用，耗材用完后需补充。实验目录列出适用实验，不表示一套材料能将全部实验各完成一次。请按单次用量取用并妥善保存，水、鸡蛋、盐等日常材料按项目清单自备。'

export function buildScienceKitSeed(source, projects=[]) {
  if (source.offerId!=='731063650115' || source.variants?.length!==18) throw new Error('Expected current offer and exactly 18 variants')
  if (new Set(source.variants.map(v=>v.supplierSkuId)).size!==18 || new Set(source.variants.map(v=>v.kitId)).size!==18) throw new Error('Duplicate kit or supplier SKU identity')
  for(const v of source.variants) {
    if (!['material_pack','general_materials'].includes(v.kind) || !v.specId || !Number.isSafeInteger(v.sortOrder) || v.sortOrder<0 || !v.coverUrl || !/^\d+$/.test(v.supplierSkuId) || !Number.isSafeInteger(v.costCents) || v.costCents<=0 || v.priceCents!==v.costCents*2 || v.stockQuantity!==100) throw new Error(`Invalid current SKU: ${v.supplierSkuId}`)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v.kitId)) throw new Error('Invalid kit UUID')
  }
  const supplier=uuid('supplier'), lines=[`-- Generated from current offer ${source.offerId}; observed ${source.observedAt}.\n-- Draft products and kits only. Activation requires deployed shipping/kit support.\n-- ON CONFLICT DO NOTHING preserves subsequent administrator edits and stock.`,
  `DO $cleanup$ BEGIN
 LOCK TABLE public.store_products IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.store_product_variants IN SHARE ROW EXCLUSIVE MODE;
 PERFORM 1 FROM store_products WHERE id=ANY(ARRAY[${oldIds.map(literal)}]::uuid[]) FOR UPDATE;
 PERFORM 1 FROM store_product_variants WHERE product_id=ANY(ARRAY[${oldIds.map(literal)}]::uuid[]) FOR UPDATE;
 IF EXISTS(SELECT 1 FROM store_order_items WHERE product_id=ANY(ARRAY[${oldIds.map(literal)}]::uuid[]) OR variant_id IN(SELECT id FROM store_product_variants WHERE product_id=ANY(ARRAY[${oldIds.map(literal)}]::uuid[])))
 OR EXISTS(SELECT 1 FROM store_inventory_reservations WHERE variant_id IN(SELECT id FROM store_product_variants WHERE product_id=ANY(ARRAY[${oldIds.map(literal)}]::uuid[])))
 OR EXISTS(SELECT 1 FROM store_product_sources WHERE variant_id IN(SELECT id FROM store_product_variants WHERE product_id=ANY(ARRAY[${oldIds.map(literal)}]::uuid[])))
 OR EXISTS(SELECT 1 FROM store_products WHERE id=ANY(ARRAY[${oldIds.map(literal)}]::uuid[]) AND (status<>'draft' OR catalog_version<>0 OR NOT coalesce((metadata->>'sourceDraft')::boolean,false) OR shipping_cents IS NOT NULL OR fulfillment_description IS NOT NULL))
 OR EXISTS(SELECT 1 FROM store_product_variants WHERE product_id=ANY(ARRAY[${oldIds.map(literal)}]::uuid[]) AND (catalog_version<>0 OR status<>'paused' OR stock_quantity<>0 OR stock_reserved<>0 OR NOT coalesce((metadata->>'sourceDraft')::boolean,false)))
 THEN RAISE EXCEPTION 'old_science_drafts_have_dependencies_or_edits'; END IF;
 DELETE FROM store_products WHERE id=ANY(ARRAY[${oldIds.map(literal)}]::uuid[]);
 END $cleanup$;`,
  `INSERT INTO store_suppliers(id,name,source,supports_drop_ship,status,metadata) VALUES(${literal(supplier)},'科学实验套装供应商','1688',true,'active',${json({offerId:source.offerId,sourceUrl:source.sourceUrl})}) ON CONFLICT DO NOTHING;`]
  let candidateCount=0
  for(const kind of ['general_materials','material_pack']) {
    const variants=source.variants.filter(v=>v.kind===kind), id=uuid(`product:${kind}`), name=kind==='material_pack'?'分年级实验材料包':'通用科学实验材料套装', productNote=kind==='material_pack'?packNote:note
    if(variants.length!==9) throw new Error('Expected nine variants per product')
    lines.push(`INSERT INTO store_products(id,slug,name,description,cover_url,source,status,currency,price_cents,shipping_cents,shipping_province_overrides,fulfillment_description,checkout_mode,category,detail_content,metadata) VALUES(${literal(id)},${literal(`science-${kind.replaceAll('_','-')}`)},${literal(name)},${literal(productNote)},${literal(variants[0].coverUrl)},'1688','draft','CNY',${Math.min(...variants.map(v=>v.priceCents))},0,'{"新疆维吾尔自治区":3200,"西藏自治区":3200}','付款后48小时内发货。中国大陆除新疆、西藏外包邮；新疆、西藏每单运费32元，不随购买数量增加。','internal','科学实验',${literal(productNote)},${json({kitManaged:true,currentOfferId:source.offerId})}) ON CONFLICT DO NOTHING;`)
    for(const v of variants) {
      const variant=uuid(`sku:${v.supplierSkuId}`), evidence={offerId:source.offerId,supplierSkuId:v.supplierSkuId,specId:v.specId,sourceUrl:source.sourceUrl,observedAt:source.observedAt,sourceImageUrl:v.sourceImageUrl,imageSha256:v.imageSha256,catalogEvidence:v.catalogEvidence,materialsEvidence:v.materialsEvidence}
      lines.push(`INSERT INTO experiment_kits(id,slug,name,kind,status,cover_url,gallery_urls,materials,catalog,preparation_note,source_evidence,sort_order) VALUES(${literal(v.kitId)},${literal(v.slug)},${literal(v.name)},${literal(kind)},'draft',${literal(v.coverUrl)},ARRAY[${(v.galleryUrls??[v.coverUrl]).map(literal)}]::text[],${json(v.materials??[])},${json(v.catalog??[])},${literal(v.preparationNote??note)},${json(evidence)},${v.sortOrder}) ON CONFLICT DO NOTHING;`)
      lines.push(`INSERT INTO store_product_variants(id,product_id,name,sku,price_cents,stock_quantity,min_quantity,status,metadata) VALUES(${literal(variant)},${literal(id)},${literal(v.name)},${literal(`CT-SCI-${String(v.sortOrder+1).padStart(2,'0')}`)},${v.priceCents},100,1,'paused',${json({supplierSkuId:v.supplierSkuId})}) ON CONFLICT DO NOTHING;`)
      lines.push(`INSERT INTO store_product_sources(variant_id,supplier_id,offer_id,spec_id,source_url,source_price_cents,source_min_quantity,is_primary,payload) VALUES(${literal(variant)},${literal(supplier)},${literal(source.offerId)},${literal(v.specId)},${literal(source.sourceUrl)},${v.costCents},1,true,${json(evidence)}) ON CONFLICT DO NOTHING;`)
      lines.push(`INSERT INTO store_variant_kits(variant_id,kit_id,kit_revision,verified,evidence) SELECT ${literal(variant)},id,revision,true,${json(evidence)} FROM experiment_kits WHERE id=${literal(v.kitId)} ON CONFLICT DO NOTHING;`)
      const grade=v.name.replace(/^2026/,'').split('16件套')[0]
      for(const project of projects) {
        const tags=project.tags??[]
        const eligible=kind==='general_materials' ? tags.includes('趣味实验') : tags.includes('科教版') && tags.includes(grade)
        if(!eligible || !(v.catalog??[]).includes(project.title) || !Number.isSafeInteger(project.id) || project.id<=0) continue
        candidateCount++
      }
    }
  }
  if (projects.length) {
    const catalogTitles=new Set(source.variants.flatMap(v=>v.catalog??[]))
    const snapshot=projects.filter(p=>catalogTitles.has(p.title)).map(p=>({id:p.id,title:p.title,tags:p.tags??[],video:p.video_url??null})).filter(p=>Number.isSafeInteger(p.id)&&p.id>0)
    lines.push(`WITH evidence_projects AS (SELECT * FROM jsonb_to_recordset(${json(snapshot)}) AS e(id bigint,title text,tags text[],video text))
INSERT INTO experiment_kit_projects(kit_id,project_id,status,preparation_status,kit_revision,evidence,sort_order)
SELECT k.id,p.id,'candidate','unknown',k.revision,jsonb_build_object('basis','legacy_source_cohort_only','originalTags',e.tags,'originalVideoUrl',e.video,'reviewRequired',true),p.id
FROM experiment_kits k CROSS JOIN evidence_projects e JOIN projects p ON p.id=e.id AND p.title=e.title
WHERE k.id=ANY(ARRAY[${source.variants.map(v=>literal(v.kitId))}]::uuid[])
AND k.catalog ? e.title
AND ((k.kind='general_materials' AND '趣味实验'=ANY(e.tags)) OR (k.kind='material_pack' AND '科教版'=ANY(e.tags) AND split_part(regexp_replace(k.name,'^2026',''),'16件套',1)=ANY(e.tags)))
ON CONFLICT DO NOTHING;`)
  }
  lines.push(`UPDATE projects p SET tags=ARRAY(SELECT t.tag FROM unnest(p.tags) WITH ORDINALITY AS t(tag,n) WHERE t.tag IS NULL OR btrim(t.tag) NOT IN ('趣味实验','科教版') ORDER BY t.n) WHERE EXISTS(SELECT 1 FROM unnest(p.tags) AS tag WHERE btrim(tag) IN ('趣味实验','科教版'));`)
  return {sql:lines.join('\n')+'\n',candidateCount}
}

export function buildScienceKitActivation(source) {
  buildScienceKitSeed(source)
  const kitIds=source.variants.map(v=>literal(v.kitId)).join(',')
  const expectedEvidence=source.variants.map(v=>({kitId:v.kitId,evidence:{offerId:source.offerId,supplierSkuId:v.supplierSkuId,specId:v.specId,sourceUrl:source.sourceUrl,observedAt:source.observedAt,sourceImageUrl:v.sourceImageUrl,imageSha256:v.imageSha256,catalogEvidence:v.catalogEvidence,materialsEvidence:v.materialsEvidence}}))
  const variantIds=source.variants.map(v=>literal(uuid(`sku:${v.supplierSkuId}`))).join(',')
  const productIds=['general_materials','material_pack'].map(kind=>literal(uuid(`product:${kind}`))).join(',')
  return `-- Execute only AFTER deployed application shipping/kit support is verified.
-- This file is intentionally separate from the draft import migration.
BEGIN;
LOCK TABLE store_products,store_product_variants,experiment_kits,store_variant_kits,experiment_kit_projects IN SHARE ROW EXCLUSIVE MODE;
DO $activation$ BEGIN
 IF (SELECT count(*) FROM store_products WHERE id=ANY(ARRAY[${productIds}]::uuid[]) AND status='draft' AND catalog_version=0 AND metadata->>'kitManaged'='true' AND shipping_cents=0 AND shipping_province_overrides='{"新疆维吾尔自治区":3200,"西藏自治区":3200}'::jsonb)<>2 THEN RAISE EXCEPTION 'science_activation_product_state_changed'; END IF;
 IF (SELECT count(*) FROM experiment_kits k JOIN store_variant_kits m ON m.kit_id=k.id JOIN store_product_variants v ON v.id=m.variant_id WHERE k.id=ANY(ARRAY[${kitIds}]::uuid[]) AND k.status='draft' AND k.revision=1 AND k.edit_version=1 AND m.verified AND m.kit_revision=1 AND v.status='paused' AND v.stock_quantity=100 AND v.stock_reserved=0 AND v.catalog_version=0 AND v.product_id=ANY(ARRAY[${productIds}]::uuid[]))<>18 THEN RAISE EXCEPTION 'science_activation_review_or_inventory_changed'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(${json(expectedEvidence)}) AS e("kitId" uuid,evidence jsonb) JOIN experiment_kits k ON k.id=e."kitId" JOIN store_variant_kits m ON m.kit_id=k.id WHERE k.source_evidence IS DISTINCT FROM e.evidence OR m.evidence IS DISTINCT FROM e.evidence) THEN RAISE EXCEPTION 'science_activation_evidence_changed'; END IF;
 IF (SELECT count(*) FROM store_product_variants WHERE product_id=ANY(ARRAY[${productIds}]::uuid[]))<>18 THEN RAISE EXCEPTION 'science_activation_extra_variants'; END IF;
 UPDATE experiment_kits SET status='published' WHERE id=ANY(ARRAY[${kitIds}]::uuid[]);
 UPDATE store_variant_kits m SET kit_revision=k.revision FROM experiment_kits k WHERE k.id=m.kit_id AND k.id=ANY(ARRAY[${kitIds}]::uuid[]) AND m.kit_revision=1;
 UPDATE experiment_kit_projects p SET kit_revision=k.revision FROM experiment_kits k WHERE k.id=p.kit_id AND k.id=ANY(ARRAY[${kitIds}]::uuid[]) AND p.kit_revision=1;
 UPDATE store_product_variants SET status='active' WHERE id=ANY(ARRAY[${variantIds}]::uuid[]);
 UPDATE store_products SET status='active' WHERE id=ANY(ARRAY[${productIds}]::uuid[]);
END $activation$;
COMMIT;
`
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const i=arg.indexOf('=');if(i<0 || !['--source','--projects','--output','--activation-output'].includes(arg.slice(0,i))) throw new Error(`Unknown argument: ${arg}`);return [arg.slice(2,i),arg.slice(i+1)]}))
  const source=JSON.parse(readFileSync(args.source??path.join(root,'data/store/science-kits-source.json'),'utf8'))
  const projects=args.projects ? JSON.parse(readFileSync(args.projects,'utf8')) : []
  const result=buildScienceKitSeed(source,projects)
  if(args['activation-output']) writeFileSync(args['activation-output'],buildScienceKitActivation(source))
  if(args.output) {writeFileSync(args.output,result.sql);console.error(`Generated draft seed: 2 products, 18 SKUs/kits, ${result.candidateCount} candidate links. No database request made.`)}
  else process.stdout.write(result.sql)
}
