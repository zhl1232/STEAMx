#!/usr/bin/env node
/** Offline SQL preparation only. Apply a reviewed migration with pnpm db:push -- --only=... . */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ids = [1175, 1183, 1200, 1257]
const label = 'restore-science-grade-projects-20261030'
const fields = ['id','title','description','author_id','image_url','category','difficulty','likes_count','views_count','created_at','updated_at','status','reviewed_by','reviewed_at','rejection_reason','tags','sub_category_id','difficulty_stars','coins_count','challenge_id','reflection','problem_statement','iterations','steam_weights','comments_count','moderation_state','recommended_min_age','recommended_max_age','support_level','classification_status','classification_source','classification_reviewed_at','classification_reviewed_by','classification_revision','video_url']
const select = (value, keys) => Object.fromEntries(keys.map(key => [key, value[key]]))
const hash = value => createHash('sha256').update(value).digest('hex')
const literal = value => `'${String(value).replaceAll("'", "''")}'`
const json = value => `${literal(JSON.stringify(value))}::jsonb`
const marker = id => {
  const value = hash(`${label}:${id}`)
  return `${value.slice(0,8)}-${value.slice(8,12)}-4${value.slice(13,16)}-a${value.slice(17,20)}-${value.slice(20,32)}`
}

export function prepareScienceGradeRestore({ backupPath, manifestPath, auditPath, sourcePath = fileURLToPath(new URL('../data/store/science-kits-source.json', import.meta.url)) }) {
  assert.ok(backupPath && manifestPath && auditPath, 'Explicit backup, manifest and audit paths are required')
  const bytes = readFileSync(backupPath)
  const manifest = JSON.parse(readFileSync(manifestPath))
  assert.equal(hash(bytes), manifest.files['database.json'], 'Database backup checksum mismatch')
  const backup = JSON.parse(bytes)[0].backup
  const audit = JSON.parse(readFileSync(auditPath))
  const source = JSON.parse(readFileSync(sourcePath))
  assert.equal(audit.readOnly, true)
  assert.equal(source.offerId, '731063650115')
  const backupRoot = path.dirname(path.resolve(backupPath))
  const projects = ids.map(id => {
    const project = backup.projects.find(project => project.id === id)
    assert.ok(project, `Missing backed-up project ${id}`)
    assert.equal(project.status, 'approved')
    assert.equal(project.moderation_state, 'hidden')
    assert.equal(project.classification_status, 'reviewed')
    assert.equal(project.classification_source, 'manual')
    assert.ok(project.classification_reviewed_at && project.classification_reviewed_by)
    // These four published source projects share their public institutional author/reviewer.
    assert.equal(project.author_id, project.classification_reviewed_by, 'Unexpected private author identity')
    assert.equal(project.likes_count, 0)
    assert.equal(project.comments_count, 0)
    assert.equal(project.coins_count, 0)
    assert.equal(project.challenge_id, null)
    const result = select(project, fields)
    result.moderation_state = 'approved'
    result.classification_revision += backup.materials.filter(row => row.project_id === id).length
      + backup.steps.filter(row => row.project_id === id).length
    return result
  })
  const materials = backup.materials.filter(row => ids.includes(row.project_id)).map(row => select(row, ['id','project_id','material','sort_order']))
  const steps = backup.steps.filter(row => ids.includes(row.project_id)).map(row => select(row, ['id','project_id','title','description','image_url','sort_order']))
  const historicalReviews = backup.classification_reviews.filter(row => ids.includes(row.content_id) && row.content_type === 'project')
    .map(row => select(row, ['id','content_type','content_id','decision','created_at']))
  assert.ok(ids.every(id => historicalReviews.some(row => row.content_id === id)), 'Missing historical review evidence')
  const relations = []
  const kits = []
  for (const id of [...ids, 1226]) {
    const found = audit.kits.flatMap(kit => kit.catalog.flatMap(item => item.sourceOrigins
      .filter(origin => origin.project.id === id && (id !== 1226 || kit.grade === '三年级'))
      .map(origin => ({ kit, item, origin }))))
    assert.equal(found.length, 1, `Ambiguous source identity ${id}`)
    const { kit, item, origin } = found[0]
    assert.equal(origin.deleted, id !== 1226)
    assert.ok(origin.project.sourceTags.includes(origin.sourceTag))
    assert.ok(origin.sourceTag.startsWith(`kejiao16a-src:${kit.grade}:`))
    const variant = source.variants.find(variant => variant.kitId === kit.id)
    assert.ok(variant && variant.catalog.includes(item.catalogTitle))
    assert.equal(kit.revision, 2)
    if (!kits.some(row => row.id === kit.id)) kits.push({
      id: kit.id, slug: kit.slug, revision: kit.revision, status: 'published', kind: 'material_pack',
      catalog: variant.catalog, cover_url: variant.coverUrl,
      source_evidence: { specId: variant.specId, offerId: source.offerId, sourceUrl: source.sourceUrl,
        observedAt: source.observedAt, imageSha256: variant.imageSha256, supplierSkuId: variant.supplierSkuId,
        sourceImageUrl: variant.sourceImageUrl, catalogEvidence: variant.catalogEvidence },
    })
    let mediaSha256
    if (id !== 1226) {
      const project = projects.find(project => project.id === id)
      assert.equal(origin.project.title, project.title)
      assert.equal(origin.project.videoUrl, project.video_url)
      const media = origin.media.find(media => media.kind === 'oss' && media.key === decodeURI(new URL(project.video_url).pathname).slice(1))
      assert.ok(media && !media.missing)
      const mediaPath = path.resolve(media.file)
      assert.ok(mediaPath.startsWith(`${backupRoot}${path.sep}media${path.sep}`), 'Media must be inside the explicit backup')
      assert.equal(hash(readFileSync(mediaPath)), media.sha256, `Video backup changed ${id}`)
      mediaSha256 = media.sha256
    }
    relations.push({ kit_id: kit.id, project_id: id, status: 'candidate', preparation_status: 'unknown',
      extras: [], project_hash: null, kit_revision: kit.revision, sort_order: id,
      evidence: { basis: 'exact_grade_source_and_current_supplier_directory', reviewedAt: audit.checkedAt.slice(0,10),
        sourceTag: origin.sourceTag, catalogTitle: item.catalogTitle, projectTitle: origin.project.title,
        projectVideoUrl: origin.project.videoUrl, directoryTypeId: kit.externalTypeId,
        directoryItemIds: item.externalItems.map(item => item.id),
        ...(mediaSha256 ? { sourceVideoSha256: mediaSha256, restoredFromBackupSha256: hash(bytes) } : {}),
        physicalTested: false, preparationComplete: false },
    })
  }
  const fan = audit.kits.find(kit => kit.grade === '三年级').catalog.find(item => item.sourceOrigins.some(origin => origin.project.id === 1226)).sourceOrigins.find(origin => origin.project.id === 1226).project
  assert.equal(fan.title, '木质小风扇')
  assert.equal(relations.find(row => row.project_id === 1226).evidence.catalogTitle, '木制小风扇')
  const payload = { projects, materials, steps, relations, kits, historicalReviews,
    fan: { id: fan.id, title: fan.title, video_url: fan.videoUrl, source_tags: [...fan.sourceTags].sort() },
    markers: ids.map(id => ({ id, key: marker(id) })), backupSha256: hash(bytes) }
  const sql = `-- Offline-generated restoration of four original grade-specific source projects and five candidate links.
-- Backup SHA-256: ${payload.backupSha256}; source audit SHA-256: ${hash(readFileSync(auditPath))}.
-- Original reviewed metadata is restored; this is not a new human classification review.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL request.jwt.claim.role = 'service_role';
CREATE TEMP TABLE grade_restore_payload(document jsonb) ON COMMIT DROP;
INSERT INTO grade_restore_payload VALUES (${json(payload)});
DO $restore$
DECLARE
 data jsonb; expected jsonb; actual jsonb; initial jsonb; item jsonb; current_project public.projects;
 restore_count integer; marker_count integer; expected_revision bigint; relation_name text; seq_name text; seq_value bigint;
BEGIN
 SELECT document INTO data FROM grade_restore_payload;
 LOCK TABLE public.projects,public.project_materials,public.project_steps,public.experiment_kit_projects IN SHARE ROW EXCLUSIVE MODE;
 -- Source kits are not edited by this repair. Any current identity/evidence change blocks it.
 FOR expected IN SELECT value FROM jsonb_array_elements(data->'kits') LOOP
  SELECT to_jsonb(k) INTO actual FROM public.experiment_kits k WHERE k.id=(expected->>'id')::uuid FOR UPDATE;
  IF actual IS NULL OR (SELECT jsonb_object_agg(key,actual->key) FROM jsonb_object_keys(expected) AS key) IS DISTINCT FROM expected
   THEN RAISE EXCEPTION 'grade_restore_kit_changed:%',expected->>'slug'; END IF;
 END LOOP;
 SELECT to_jsonb(p) INTO actual FROM public.projects p WHERE p.id=1226 FOR UPDATE;
 expected:=data->'fan';
 IF actual IS NULL OR actual->>'title' IS DISTINCT FROM expected->>'title' OR actual->>'video_url' IS DISTINCT FROM expected->>'video_url'
  OR actual->>'status'<>'approved' OR actual->>'moderation_state'<>'approved'
  OR ARRAY(SELECT value FROM jsonb_array_elements_text(actual->'tags') AS value WHERE value LIKE 'kejiao16a-src:%' ORDER BY value)
    IS DISTINCT FROM ARRAY(SELECT value FROM jsonb_array_elements_text(expected->'source_tags') AS value ORDER BY value)
 THEN RAISE EXCEPTION 'grade_restore_fan_changed'; END IF;
 -- The retained append-only historical audit must still identify every backed-up record.
 FOR expected IN SELECT value FROM jsonb_array_elements(data->'historicalReviews') LOOP
  IF NOT EXISTS(SELECT 1 FROM public.content_classification_reviews r WHERE r.id=(expected->>'id')::bigint
   AND r.content_type=expected->>'content_type' AND r.content_id=(expected->>'content_id')::bigint
   AND r.decision=expected->>'decision' AND r.created_at=(expected->>'created_at')::timestamptz)
  THEN RAISE EXCEPTION 'grade_restore_historical_audit_changed:%',expected->>'id'; END IF;
 END LOOP;
 SELECT count(*) INTO restore_count FROM public.projects WHERE id=ANY(ARRAY[1175,1183,1200,1257]::bigint[]);
 SELECT count(*) INTO marker_count FROM public.content_classification_reviews r JOIN jsonb_to_recordset(data->'markers') AS m(id bigint,key uuid)
  ON r.content_id=m.id AND r.idempotency_key=m.key WHERE r.content_type='project' AND r.actor_type='migration' AND r.actor_label='${label}' AND r.reason='Restore original backup review metadata; not a new human review';
 IF restore_count<>0 AND (restore_count<>4 OR marker_count<>4) THEN RAISE EXCEPTION 'grade_restore_project_id_conflict'; END IF;
 IF restore_count=0 AND marker_count<>0 THEN RAISE EXCEPTION 'grade_restore_partial_state'; END IF;
 IF restore_count=0 AND (EXISTS(SELECT 1 FROM public.comments WHERE project_id=ANY(ARRAY[1175,1183,1200,1257]::bigint[]))
  OR EXISTS(SELECT 1 FROM public.completed_projects WHERE project_id=ANY(ARRAY[1175,1183,1200,1257]::bigint[])))
 THEN RAISE EXCEPTION 'grade_restore_user_dependencies_present'; END IF;
 IF restore_count=4 THEN
  -- Replay must match the complete restored content; never replace subsequent manual edits.
  FOR expected IN SELECT value FROM jsonb_array_elements(data->'projects') LOOP
   SELECT to_jsonb(p) INTO actual FROM public.projects p WHERE p.id=(expected->>'id')::bigint;
   IF (SELECT jsonb_object_agg(key,actual->key) FROM jsonb_object_keys(expected) AS key) IS DISTINCT FROM expected
   THEN RAISE EXCEPTION 'grade_restore_project_drift:%',expected->>'id'; END IF;
  END LOOP;
 ELSE
  -- Child primary keys must be free before any parent is inserted.
  IF EXISTS(SELECT 1 FROM public.project_materials m JOIN jsonb_to_recordset(data->'materials') AS e(id bigint) USING(id))
   OR EXISTS(SELECT 1 FROM public.project_steps s JOIN jsonb_to_recordset(data->'steps') AS e(id bigint) USING(id))
  THEN RAISE EXCEPTION 'grade_restore_child_id_conflict'; END IF;
  FOREACH relation_name IN ARRAY ARRAY['projects','project_materials','project_steps'] LOOP
   seq_name:=pg_get_serial_sequence('public.'||relation_name,'id');
   IF seq_name IS NULL THEN RAISE EXCEPTION 'grade_restore_missing_sequence:%',relation_name; END IF;
   EXECUTE format('SELECT last_value FROM %s',seq_name) INTO seq_value;
   SELECT max((value->>'id')::bigint) INTO expected_revision FROM jsonb_array_elements(data->CASE relation_name WHEN 'projects' THEN 'projects' WHEN 'project_materials' THEN 'materials' ELSE 'steps' END);
   IF seq_value<expected_revision THEN RAISE EXCEPTION 'grade_restore_sequence_behind:%',relation_name; END IF;
  END LOOP;
  FOR expected IN SELECT value FROM jsonb_array_elements(data->'projects') LOOP
   initial:=expected||jsonb_build_object('moderation_state','hidden','classification_status','unreviewed','classification_source',NULL,'classification_reviewed_at',NULL,'classification_reviewed_by',NULL,
    'classification_revision',(expected->>'classification_revision')::bigint-(SELECT count(*) FROM jsonb_array_elements(data->'materials') m WHERE m->>'project_id'=expected->>'id')-(SELECT count(*) FROM jsonb_array_elements(data->'steps') s WHERE s->>'project_id'=expected->>'id'));
   INSERT INTO public.projects(${fields.join(',')}) SELECT ${fields.map(field => `p.${field}`).join(',')} FROM jsonb_populate_record(NULL::public.projects,initial) p;
  END LOOP;
  INSERT INTO public.project_materials(id,project_id,material,sort_order) SELECT id,project_id,material,sort_order FROM jsonb_populate_recordset(NULL::public.project_materials,data->'materials');
  INSERT INTO public.project_steps(id,project_id,title,description,image_url,sort_order) SELECT id,project_id,title,description,image_url,sort_order FROM jsonb_populate_recordset(NULL::public.project_steps,data->'steps');
  FOR expected IN SELECT value FROM jsonb_array_elements(data->'projects') LOOP
   SELECT * INTO current_project FROM public.projects WHERE id=(expected->>'id')::bigint FOR UPDATE;
   IF current_project.classification_revision<>(expected->>'classification_revision')::bigint THEN RAISE EXCEPTION 'grade_restore_invalidation_revision_changed'; END IF;
   PERFORM public.begin_content_classification_context('review');
   UPDATE public.projects SET classification_status=expected->>'classification_status',classification_source=expected->>'classification_source',
    classification_reviewed_at=(expected->>'classification_reviewed_at')::timestamptz,classification_reviewed_by=(expected->>'classification_reviewed_by')::uuid
    WHERE id=(expected->>'id')::bigint;
   IF public.content_classification_review_context() THEN RAISE EXCEPTION 'grade_restore_context_not_consumed'; END IF;
   UPDATE public.projects SET moderation_state='approved' WHERE id=(expected->>'id')::bigint;
   SELECT to_jsonb(p) INTO actual FROM public.projects p WHERE p.id=(expected->>'id')::bigint;
   INSERT INTO public.content_classification_reviews(content_type,content_id,decision,previous_value,new_value,reason,actor_type,actor_label,idempotency_key)
    VALUES('project',(expected->>'id')::bigint,'approve',to_jsonb(current_project),actual,'Restore original backup review metadata; not a new human review','migration','${label}',
     (SELECT (value->>'key')::uuid FROM jsonb_array_elements(data->'markers') WHERE value->>'id'=expected->>'id'));
  END LOOP;
 END IF;
 -- Exact child identity/count checks apply both on the initial write and replay.
 SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.id),'[]'::jsonb) INTO actual FROM public.project_materials m WHERE project_id=ANY(ARRAY[1175,1183,1200,1257]::bigint[]);
 SELECT coalesce(jsonb_agg(value ORDER BY (value->>'id')::bigint),'[]'::jsonb) INTO expected FROM jsonb_array_elements(data->'materials');
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'grade_restore_material_drift'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb) INTO actual FROM public.project_steps s WHERE project_id=ANY(ARRAY[1175,1183,1200,1257]::bigint[]);
 SELECT coalesce(jsonb_agg(value ORDER BY (value->>'id')::bigint),'[]'::jsonb) INTO expected FROM jsonb_array_elements(data->'steps');
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'grade_restore_step_drift'; END IF;
 FOR expected IN SELECT value FROM jsonb_array_elements(data->'relations') LOOP
  SELECT to_jsonb(r) INTO actual FROM public.experiment_kit_projects r WHERE kit_id=(expected->>'kit_id')::uuid AND project_id=(expected->>'project_id')::bigint;
  IF actual IS NOT NULL AND actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'grade_restore_relation_changed:%',expected->>'project_id'; END IF;
  IF actual IS NULL THEN
   IF restore_count=4 THEN RAISE EXCEPTION 'grade_restore_relation_missing_on_replay'; END IF;
   INSERT INTO public.experiment_kit_projects SELECT * FROM jsonb_populate_record(NULL::public.experiment_kit_projects,expected);
  END IF;
 END LOOP;
 -- Initial application receives the same final content checks as replay.
 FOR expected IN SELECT value FROM jsonb_array_elements(data->'projects') LOOP
  SELECT to_jsonb(p) INTO actual FROM public.projects p WHERE p.id=(expected->>'id')::bigint;
  IF (SELECT jsonb_object_agg(key,actual->key) FROM jsonb_object_keys(expected) AS key) IS DISTINCT FROM expected
  THEN RAISE EXCEPTION 'grade_restore_final_project_changed:%',expected->>'id'; END IF;
 END LOOP;
 PERFORM public.consume_content_classification_context('review');
 PERFORM public.consume_content_classification_context('candidate');
 PERFORM public.consume_content_classification_context('invalidation');
 PERFORM set_config('app.content_classification_operation','',true);
END
$restore$;
`
  return { sql, payload }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => {
    const match = /^--(backup|manifest|audit|output)=(.+)$/.exec(arg)
    assert.ok(match, `Unknown argument: ${arg}`)
    return [match[1], match[2]]
  }))
  assert.ok(args.output, '--output is required')
  const result = prepareScienceGradeRestore({ backupPath: args.backup, manifestPath: args.manifest, auditPath: args.audit })
  writeFileSync(args.output, result.sql)
  console.log('Prepared offline SQL: 4 original projects, 5 candidate relationships; no database or media writes.')
}
