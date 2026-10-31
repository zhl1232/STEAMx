#!/usr/bin/env node
/** Offline preparation only. Apply the generated migration with a scoped pnpm db:push. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const author = '66020423-0000-0000-0000-000000000000'
const sources = new Map([
  ['supplier-tutorial:2247503647', ['悬浮吹球', ['e9f5b164-86cf-56cb-bced-45d650e569db']]],
  ['supplier-tutorial:2247507624', ['迷你两驱小车', ['522ae6c0-77ff-582b-847f-7830c455956b', '2ec5bebf-be3b-5ac4-9e5e-5a507875da22']]],
  ['supplier-tutorial:2247505836', ['太阳能发电', ['1cdae286-72fc-5c41-8f43-7922e3587fe4']]],
])
const kitFields = ['id', 'slug', 'revision', 'status', 'kind', 'catalog', 'cover_url', 'source_evidence']
const quote = value => `'${String(value).replaceAll("'", "''")}'`
const json = value => `${quote(JSON.stringify(value))}::jsonb`
const select = (value, keys) => Object.fromEntries(keys.map(key => [key, value[key]]))

export function prepareSupplierDrafts(input) {
  assert.equal(input.projects?.length, 3, 'Exactly three supplier versions are allowed')
  assert.equal(input.kits?.length, 4, 'Exactly four current source kits are required')
  assert.equal(new Set(input.projects.map(p => p.sourceTag)).size, 3, 'Duplicate source tag')
  const projects = input.projects.map(p => {
    const source = sources.get(p.sourceTag)
    assert.ok(source, `Unexpected source tag ${p.sourceTag}`)
    assert.equal(p.title, source[0], 'Unexpected canonical title')
    for (const field of ['description', 'category', 'problem_statement']) assert.ok(typeof p[field] === 'string' && p[field].trim(), `Missing ${field}`)
    for (const field of ['video_url', 'image_url']) {
      const url = new URL(p[field])
      assert.equal(url.origin, 'https://assets.steamx.cc', `Unexpected ${field} origin`)
      assert.equal(url.search, '', 'Signed/transient media URLs must not be stored')
    }
    assert.ok(Array.isArray(p.tags) && p.tags.includes(p.sourceTag) && new Set(p.tags).size === p.tags.length)
    assert.ok(Array.isArray(p.materials) && p.materials.length > 0 && p.materials.every(m => typeof m === 'string' && m.trim()))
    assert.ok(Array.isArray(p.steps) && p.steps.length > 0 && p.steps.every(s => typeof s.title === 'string' && s.title.trim() && typeof s.description === 'string' && s.description.trim()))
    assert.ok(Number.isInteger(p.recommended_min_age) && p.recommended_min_age >= 3 && p.recommended_min_age <= 16)
    assert.ok(['guided', 'independent', 'adult_required'].includes(p.support_level))
    assert.ok(Number.isInteger(p.difficulty_stars) && p.difficulty_stars >= 1 && p.difficulty_stars <= 6)
    assert.deepEqual(p.relations.map(r => r.kit_id).sort(), [...source[1]].sort(), 'Unexpected kit mapping')
    const relations = p.relations.map(r => {
      assert.equal(r.status, 'candidate')
      assert.equal(r.preparation_status, 'unknown')
      assert.equal(r.kit_revision, 2)
      assert.ok(r.evidence && typeof r.evidence === 'object' && !Array.isArray(r.evidence))
      const match = r.evidence.visualMatch
      if (match) {
        assert.equal(match.projectTitle, p.title)
        assert.equal(match.videoUrl, p.video_url)
        assert.equal(match.scope, 'matching_core_structure')
        assert.equal(match.kitCoverUrl, input.kits.find(k => k.id === r.kit_id)?.cover_url)
        for (const key of ['videoSha256', 'kitImageSha256']) assert.match(match[key], /^[a-f0-9]{64}$/)
      }
      return { ...select(r, ['kit_id', 'status', 'preparation_status', 'kit_revision', 'evidence']), extras: [], project_hash: null }
    })
    return {
      sourceTag: p.sourceTag,
      project: {
        ...select(p, ['title', 'description', 'category', 'video_url', 'image_url', 'tags', 'problem_statement', 'reflection', 'recommended_min_age', 'support_level', 'difficulty_stars']),
        author_id: author, difficulty: p.difficulty_stars <= 2 ? 'easy' : p.difficulty_stars <= 4 ? 'medium' : 'hard',
        recommended_max_age: null, status: 'pending', moderation_state: 'hidden',
        classification_status: 'unreviewed', classification_source: null,
        classification_reviewed_at: null, classification_reviewed_by: null,
      },
      materials: p.materials.map((material, sort_order) => ({ material, sort_order })),
      steps: p.steps.map((s, sort_order) => ({ ...select(s, ['title', 'description']), image_url: null, sort_order })),
      relations,
    }
  })
  const kits = input.kits.map(k => {
    assert.ok([...sources.values()].some(([, ids]) => ids.includes(k.id)), 'Unexpected kit')
    assert.equal(k.revision, 2)
    assert.equal(k.status, 'published')
    assert.equal(k.kind, 'material_pack')
    for (const key of kitFields) assert.notEqual(k[key], undefined, `Missing kit field ${key}`)
    return select(k, kitFields)
  })
  assert.equal(new Set(kits.map(k => k.id)).size, 4, 'Duplicate kit')
  const payload = { projects, kits }
  const sql = `-- Three supplier tutorial versions, intentionally awaiting a NEW human classification review.
-- This migration does not publish content, copy historical review metadata, or replace older versions.
-- Prepared payload SHA-256: ${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL request.jwt.claim.role = 'service_role';
CREATE TEMP TABLE supplier_draft_payload(document jsonb) ON COMMIT DROP;
INSERT INTO supplier_draft_payload VALUES (${json(payload)});
DO $draft$
DECLARE
 data jsonb; item jsonb; expected jsonb; actual jsonb; rel jsonb; prior jsonb; protected_before jsonb;
 v_project_id bigint; found_count integer; is_replay boolean; expected_revision bigint;
BEGIN
 SELECT document INTO data FROM supplier_draft_payload;
 LOCK TABLE public.projects,public.project_materials,public.project_steps,public.experiment_kit_projects IN SHARE ROW EXCLUSIVE MODE;
 SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) INTO protected_before FROM public.projects p WHERE p.id IN(1193,1250,1276);
 IF jsonb_array_length(coalesce(protected_before,'[]'))<>3 THEN RAISE EXCEPTION 'supplier_draft_original_version_missing'; END IF;
 FOR expected IN SELECT value FROM jsonb_array_elements(data->'kits') LOOP
  SELECT to_jsonb(k) INTO actual FROM public.experiment_kits k WHERE k.id=(expected->>'id')::uuid FOR UPDATE;
  IF actual IS NULL OR (SELECT jsonb_object_agg(key,actual->key) FROM jsonb_object_keys(expected) AS key) IS DISTINCT FROM expected
  THEN RAISE EXCEPTION 'supplier_draft_kit_changed:%',expected->>'slug'; END IF;
 END LOOP;
 SELECT count(*) INTO found_count FROM public.projects p WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(data->'projects') i WHERE p.tags @> ARRAY[i->>'sourceTag']);
 IF found_count NOT IN(0,3) THEN RAISE EXCEPTION 'supplier_draft_partial_or_duplicate_sources'; END IF;
 is_replay:=found_count=3;
 FOR item IN SELECT value FROM jsonb_array_elements(data->'projects') LOOP
  expected:=item->'project';
  SELECT count(*),min(p.id) INTO found_count,v_project_id FROM public.projects p WHERE p.tags @> ARRAY[item->>'sourceTag'];
  IF found_count>1 OR (is_replay AND found_count<>1) OR (NOT is_replay AND found_count<>0)
  THEN RAISE EXCEPTION 'supplier_draft_source_collision:%',item->>'sourceTag'; END IF;
  IF NOT is_replay THEN
   INSERT INTO public.projects(title,description,category,video_url,image_url,tags,problem_statement,reflection,author_id,difficulty,
    recommended_min_age,recommended_max_age,support_level,difficulty_stars,status,moderation_state,
    classification_status,classification_source,classification_reviewed_at,classification_reviewed_by)
   SELECT p.title,p.description,p.category,p.video_url,p.image_url,p.tags,p.problem_statement,p.reflection,p.author_id,p.difficulty,
    p.recommended_min_age,p.recommended_max_age,p.support_level,p.difficulty_stars,p.status,p.moderation_state,
    p.classification_status,p.classification_source,p.classification_reviewed_at,p.classification_reviewed_by
    FROM jsonb_populate_record(NULL::public.projects,expected) p RETURNING id INTO v_project_id;
   INSERT INTO public.project_materials(project_id,material,sort_order)
    SELECT v_project_id,m.material,m.sort_order FROM jsonb_to_recordset(item->'materials') AS m(material text,sort_order integer);
   INSERT INTO public.project_steps(project_id,title,description,image_url,sort_order)
    SELECT v_project_id,s.title,s.description,s.image_url,s.sort_order FROM jsonb_to_recordset(item->'steps') AS s(title text,description text,image_url text,sort_order integer);
  END IF;
  IF v_project_id IN(1193,1250,1276) THEN RAISE EXCEPTION 'supplier_draft_original_id_collision'; END IF;
  SELECT to_jsonb(p) INTO actual FROM public.projects p WHERE p.id=v_project_id;
  IF (SELECT jsonb_object_agg(key,actual->key) FROM jsonb_object_keys(expected) AS key) IS DISTINCT FROM expected
  THEN RAISE EXCEPTION 'supplier_draft_project_drift:%',item->>'sourceTag'; END IF;
  expected_revision:=jsonb_array_length(item->'materials')+jsonb_array_length(item->'steps');
  IF (actual->>'classification_revision')::bigint<>expected_revision THEN RAISE EXCEPTION 'supplier_draft_revision_drift'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('material',m.material,'sort_order',m.sort_order) ORDER BY m.sort_order,m.id),'[]'::jsonb)
   INTO actual FROM public.project_materials m WHERE m.project_id=v_project_id;
  IF actual IS DISTINCT FROM item->'materials' THEN RAISE EXCEPTION 'supplier_draft_material_drift'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('title',s.title,'description',s.description,'image_url',s.image_url,'sort_order',s.sort_order) ORDER BY s.sort_order,s.id),'[]'::jsonb)
   INTO actual FROM public.project_steps s WHERE s.project_id=v_project_id;
  IF actual IS DISTINCT FROM item->'steps' THEN RAISE EXCEPTION 'supplier_draft_step_drift'; END IF;
  FOR rel IN SELECT value FROM jsonb_array_elements(item->'relations') LOOP
   expected:=rel||jsonb_build_object('project_id',v_project_id,'sort_order',v_project_id);
   SELECT to_jsonb(r) INTO actual FROM public.experiment_kit_projects r WHERE r.kit_id=(expected->>'kit_id')::uuid AND r.project_id=v_project_id;
   IF is_replay THEN
    IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'supplier_draft_relation_drift'; END IF;
   ELSE
    IF actual IS NOT NULL THEN RAISE EXCEPTION 'supplier_draft_relation_collision'; END IF;
    INSERT INTO public.experiment_kit_projects SELECT * FROM jsonb_populate_record(NULL::public.experiment_kit_projects,expected);
   END IF;
  END LOOP;
  SELECT count(*) INTO found_count FROM public.experiment_kit_projects r WHERE r.project_id=v_project_id;
  IF found_count<>jsonb_array_length(item->'relations') THEN RAISE EXCEPTION 'supplier_draft_extra_relation'; END IF;
 END LOOP;
 SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) INTO actual FROM public.projects p WHERE p.id IN(1193,1250,1276);
 IF actual IS DISTINCT FROM protected_before THEN RAISE EXCEPTION 'supplier_draft_original_project_changed'; END IF;
END
$draft$;
`
  return { sql, payload }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => {
    const match = /^--(payload|output)=(.+)$/.exec(arg)
    assert.ok(match, `Unknown argument ${arg}`)
    return [match[1], match[2]]
  }))
  assert.ok(args.payload && args.output, '--payload and --output are required')
  const { sql } = prepareSupplierDrafts(JSON.parse(readFileSync(args.payload, 'utf8')))
  writeFileSync(args.output, sql)
  console.log('Prepared offline SQL: three hidden, unreviewed supplier versions and four candidate kit links; no external writes.')
}
