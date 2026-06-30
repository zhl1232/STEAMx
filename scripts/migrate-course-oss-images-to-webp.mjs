#!/usr/bin/env node
/**
 * Replace legacy OSS course PNG/JPG images with WebP.
 *
 * It scans oss:courses/ for .png/.jpg/.jpeg objects, converts each object to a
 * sibling .webp object, deletes the legacy object after upload, and rewrites
 * course image URLs in Supabase plus local scripts/courseware/*.json.
 *
 * Usage:
 *   node scripts/migrate-course-oss-images-to-webp.mjs --dry-run
 *   node scripts/migrate-course-oss-images-to-webp.mjs --apply
 *   node scripts/migrate-course-oss-images-to-webp.mjs --apply --only=3-chang-jing-long
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { rewriteCourseImageUrlToWebp } from "./lib/course-image-webp.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const COURSEWARE_DIR = join(ROOT, "scripts/courseware");
const DEFAULT_QUALITY = 82;
const IMAGE_KEY_RE = /^courses\/[^/]+\/(?:slides\/[^/]+|finished)\.(png|jpe?g)$/i;
const COURSE_IMAGE_KEY_RE = /^courses\/[^/]+\/(?:slides\/[^/]+|finished)\.(webp|png|jpe?g)$/i;

const argv = process.argv.slice(2);
const flags = new Map();
for (const token of argv) {
  const match = token.match(/^--([^=]+)(?:=(.*))?$/);
  if (match) flags.set(match[1], match[2] === undefined ? "true" : match[2]);
}

const flag = (name, fallback) => (flags.has(name) ? flags.get(name) : fallback);
const bool = (name) => flags.get(name) === "true" || flags.get(name) === "";
const dryRun = bool("dry-run");
const apply = bool("apply");
const cleanupLegacy = bool("cleanup-legacy");
const updateDb = !bool("no-db");
const updateJson = !bool("no-json");
const deleteOriginals = !bool("keep-originals");
const sourceMode = flag("source", "auto");
const referer = flag("referer", process.env.ASSETS_DOWNLOAD_REFERER || process.env.NEXT_PUBLIC_APP_URL || "https://www.steamx.cc/");
const quality = Number(flag("quality", DEFAULT_QUALITY)) || DEFAULT_QUALITY;
const concurrency = Number(flag("concurrency", 8)) || 8;
const prefix = normalizePrefix(flag("prefix", "courses/"));
const onlyMatchers = (flag("only", "") || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

if (!dryRun && !apply) {
  console.error("Refusing to run without --dry-run or --apply.");
  process.exit(1);
}

function normalizePrefix(value) {
  const trimmed = String(value || "courses/").replace(/^\/+/, "");
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function loadEnv() {
  for (const filename of [".env.local", ".env.production", ".env"]) {
    const envPath = join(ROOT, filename);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function toWebpKey(key) {
  return key.replace(/\.(png|jpe?g)$/i, ".webp");
}

function getAssetsBaseUrl() {
  return (process.env.NEXT_PUBLIC_ASSETS_BASE_URL || process.env.ASSETS_BASE_URL || "").trim().replace(/\/+$/, "");
}

function keyMatchesOnly(key) {
  if (onlyMatchers.length === 0) return true;
  const lowered = key.toLowerCase();
  return onlyMatchers.some((matcher) => lowered.includes(matcher));
}

async function listAllObjects(client, listPrefix) {
  const objects = [];
  let continuationToken = null;

  do {
    const response = await client.listV2(
      {
        prefix: listPrefix,
        "max-keys": 1000,
        ...(continuationToken ? { continuationToken } : {}),
      },
      {},
    );
    objects.push(...(response.objects || []));
    continuationToken = response.nextContinuationToken;
  } while (continuationToken);

  return objects;
}

function extractCourseImageKeysFromText(text) {
  const keys = new Set();
  if (!text) return keys;

  const re = /(?:https?:\/\/[^"'\s)]+)?\/courses\/[^"'\s)]+?\.(?:webp|png|jpe?g)(?=[?#"'\s)]|$)/gi;
  for (const match of String(text).matchAll(re)) {
    const rawUrl = match[0];
    let pathname = rawUrl;
    try {
      pathname = rawUrl.startsWith("http") ? new URL(rawUrl).pathname : rawUrl.split(/[?#]/)[0];
    } catch {
      pathname = rawUrl.split(/[?#]/)[0];
    }
    const key = pathname.replace(/^\/+/, "");
    if (COURSE_IMAGE_KEY_RE.test(key)) keys.add(key);
  }

  return keys;
}

async function legacyImageObjectsFromDatabase() {
  const rows = await execSQL(`
SELECT content::text AS payload
  FROM public.course_lessons
 WHERE lesson_type = 'building_3d'
   AND content::text ~ '/courses/[^"]+\\.(png|jpg|jpeg)(["?#])'
UNION ALL
SELECT image_url AS payload
  FROM public.courses
 WHERE image_url ~ '/courses/.+\\.(png|jpg|jpeg)(\\?|#)?$'
UNION ALL
SELECT image_url AS payload
  FROM public.projects
 WHERE image_url ~ '/courses/.+\\.(png|jpg|jpeg)(\\?|#)?$';
`);

  const keys = new Set();
  for (const row of rows || []) {
    for (const key of extractCourseImageKeysFromText(row.payload)) keys.add(key);
  }

  return [...keys]
    .filter((key) => key.startsWith(prefix))
    .filter((key) => keyMatchesOnly(key))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, size: 0, source: "database" }));
}

async function legacyImageObjectsFromCurrentWebpReferences() {
  const rows = await execSQL(`
SELECT content::text AS payload
  FROM public.course_lessons
 WHERE lesson_type = 'building_3d'
   AND content::text LIKE '%/courses/%'
UNION ALL
SELECT image_url AS payload
  FROM public.courses
 WHERE image_url LIKE '%/courses/%'
UNION ALL
SELECT image_url AS payload
  FROM public.projects
 WHERE image_url LIKE '%/courses/%';
`);

  const keys = new Set();
  for (const row of rows || []) {
    for (const webpKey of extractCourseImageKeysFromText(row.payload)) {
      if (!/\.webp$/i.test(webpKey)) continue;
      keys.add(webpKey.replace(/\.webp$/i, ".png"));
    }
  }

  return [...keys]
    .filter((key) => key.startsWith(prefix))
    .filter((key) => keyMatchesOnly(key))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, size: 0, source: "webp-reference" }));
}

async function getLegacyImageObjects(client) {
  try {
    const allObjects = await listAllObjects(client, prefix);
    return {
      source: "oss-list",
      allObjectCount: allObjects.length,
      imageObjects: allObjects
        .filter((object) => IMAGE_KEY_RE.test(object.name))
        .filter((object) => keyMatchesOnly(object.name))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch (error) {
    if (error?.code !== "AccessDenied") throw error;

    console.warn("OSS list denied; falling back to database URL inventory.");
    const imageObjects = await legacyImageObjectsFromDatabase();
    return {
      source: "database",
      allObjectCount: null,
      imageObjects,
    };
  }
}

async function readObjectBuffer(client, key) {
  const response = await client.get(key);
  if (Buffer.isBuffer(response.content)) return response.content;
  if (typeof response.content === "string") return Buffer.from(response.content);
  throw new Error(`Unexpected OSS object content for ${key}`);
}

async function readCdnBuffer(key) {
  const baseUrl = getAssetsBaseUrl();
  if (!baseUrl) throw new Error("Missing NEXT_PUBLIC_ASSETS_BASE_URL for CDN source fallback");

  const response = await fetch(`${baseUrl}/${key}`, {
    headers: {
      Referer: referer,
      "User-Agent": "steamx-course-webp-migration/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`CDN fetch failed for ${key}: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function readSourceImageBuffer(client, key) {
  if (sourceMode === "cdn") return readCdnBuffer(key);
  if (sourceMode === "oss") return readObjectBuffer(client, key);

  try {
    return await readObjectBuffer(client, key);
  } catch (error) {
    if (error?.code !== "AccessDenied") throw error;
    return readCdnBuffer(key);
  }
}

async function withConcurrency(items, limit, worker) {
  const queue = items.slice();
  const errors = [];
  let index = 0;
  let done = 0;

  async function runOne() {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      const current = (index += 1);
      try {
        await worker(item, current);
      } catch (error) {
        errors.push({ item, error });
      } finally {
        done += 1;
        if (done % 25 === 0 || done === items.length) {
          process.stdout.write(`  processed ${done}/${items.length}\n`);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runOne()));
  return errors;
}

function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

function getSlugsFromObjects(objects) {
  return [
    ...new Set(
      objects
        .map((object) => object.name.match(/^courses\/([^/]+)\//)?.[1])
        .filter(Boolean),
    ),
  ].sort();
}

async function execSQL(sql) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const response = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  const data = await response.json();
  if (data && !Array.isArray(data) && data.error) throw new Error(data.error);
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item?.error) throw new Error(item.error);
    }
  }
  return data ?? [];
}

function buildSlugLikeArray(slugs) {
  return `ARRAY[${slugs.map((slug) => `'%/courses/${escapeSqlLiteral(slug)}/%'`).join(", ")}]`;
}

async function updateDatabaseReferences(slugs) {
  if (slugs.length === 0) return { dryRun, rows: [{ lessons: 0, courses: 0, projects: 0 }] };

  const likeArray = buildSlugLikeArray(slugs);
  const sql = `
WITH updated_lessons AS (
  UPDATE public.course_lessons
     SET content = replace(replace(replace(content::text, '.jpeg', '.webp'), '.jpg', '.webp'), '.png', '.webp')::jsonb,
         updated_at = NOW()
   WHERE lesson_type = 'building_3d'
     AND content::text LIKE ANY (${likeArray})
     AND content::text ~ '\\.(png|jpg|jpeg)(["?#])'
  RETURNING id
), updated_courses AS (
  UPDATE public.courses
     SET image_url = replace(replace(replace(image_url, '.jpeg', '.webp'), '.jpg', '.webp'), '.png', '.webp'),
         updated_at = NOW()
   WHERE image_url LIKE ANY (${likeArray})
     AND image_url ~ '/courses/.*\\.(png|jpg|jpeg)(\\?|#)?$'
  RETURNING id
), updated_projects AS (
  UPDATE public.projects
     SET image_url = replace(replace(replace(image_url, '.jpeg', '.webp'), '.jpg', '.webp'), '.png', '.webp'),
         updated_at = NOW()
   WHERE image_url LIKE ANY (${likeArray})
     AND image_url ~ '/courses/.*\\.(png|jpg|jpeg)(\\?|#)?$'
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM updated_lessons) AS lessons,
  (SELECT COUNT(*) FROM updated_courses) AS courses,
  (SELECT COUNT(*) FROM updated_projects) AS projects;
`;

  if (dryRun) {
    const preview = await execSQL(`
SELECT
  (SELECT COUNT(*) FROM public.course_lessons WHERE lesson_type = 'building_3d' AND content::text LIKE ANY (${likeArray}) AND content::text ~ '\\.(png|jpg|jpeg)(["?#])') AS lessons,
  (SELECT COUNT(*) FROM public.courses WHERE image_url LIKE ANY (${likeArray}) AND image_url ~ '/courses/.*\\.(png|jpg|jpeg)(\\?|#)?$') AS courses,
  (SELECT COUNT(*) FROM public.projects WHERE image_url LIKE ANY (${likeArray}) AND image_url ~ '/courses/.*\\.(png|jpg|jpeg)(\\?|#)?$') AS projects;
`);
    return { dryRun: true, rows: preview };
  }

  return { dryRun: false, rows: await execSQL(sql) };
}

function rewriteJsonValue(value) {
  if (typeof value === "string") return rewriteCourseImageUrlToWebp(value);
  if (Array.isArray(value)) return value.map(rewriteJsonValue);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) value[key] = rewriteJsonValue(value[key]);
  }
  return value;
}

function updateLocalCoursewareJson(slugs) {
  if (!existsSync(COURSEWARE_DIR)) return { scanned: 0, changed: 0 };
  const slugSet = new Set(slugs);

  let scanned = 0;
  let changed = 0;
  for (const filename of readdirSync(COURSEWARE_DIR).filter((name) => name.endsWith(".json"))) {
    const jsonPath = join(COURSEWARE_DIR, filename);
    const before = readFileSync(jsonPath, "utf8");
    const json = JSON.parse(before);
    const slug = json.slug || filename.replace(/\.json$/, "");
    if (!slugSet.has(slug)) continue;
    scanned += 1;
    rewriteJsonValue(json);
    const hasSlideImages = Array.isArray(json.content?.building3d?.slideImageUrls)
      && json.content.building3d.slideImageUrls.length > 0;
    if (hasSlideImages && json.assets?.slideExt && json.assets.slideExt !== "webp") json.assets.slideExt = "webp";
    if (typeof json.assets?.finished === "string") json.assets.finished = rewriteCourseImageUrlToWebp(json.assets.finished);
    json.generatedAt = new Date().toISOString();
    const after = `${JSON.stringify(json, null, 2)}\n`;
    if (after !== before) {
      changed += 1;
      if (!dryRun) writeFileSync(jsonPath, after, "utf8");
      console.log(`  ${dryRun ? "would update" : "updated"} ${relative(ROOT, jsonPath)}`);
    }
  }
  return { scanned, changed };
}

async function migrateObjects(client, objects) {
  const sharp = (await import("sharp")).default;
  const migrated = [];

  const errors = await withConcurrency(objects, concurrency, async (object) => {
    const sourceKey = object.name;
    const targetKey = toWebpKey(sourceKey);

    if (dryRun) {
      migrated.push({ sourceKey, targetKey, beforeBytes: object.size || 0, afterBytes: 0 });
      return;
    }

    const input = await readSourceImageBuffer(client, sourceKey);
    const output = await sharp(input).webp({ quality }).toBuffer();
    await client.put(targetKey, output, {
      mime: "image/webp",
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      timeout: 300_000,
    });

    let deleted = false;
    let deleteSkipped = false;
    if (deleteOriginals) {
      try {
        await client.delete(sourceKey, { timeout: 120_000 });
        deleted = true;
      } catch (error) {
        if (error?.code !== "AccessDenied") throw error;
        deleteSkipped = true;
      }
    }

    migrated.push({ sourceKey, targetKey, beforeBytes: input.length, afterBytes: output.length, uploaded: true, deleted, deleteSkipped });
  });

  if (errors.length > 0) {
    console.error(`OSS migration had ${errors.length} error(s):`);
    for (const { item, error } of errors.slice(0, 10)) {
      console.error(`  ${item.name}: ${error?.message || error}`);
    }
    throw new Error(`Failed to migrate ${errors.length} OSS object(s)`);
  }

  return {
    uploaded: migrated.filter((item) => item.uploaded).length,
    deleted: migrated.filter((item) => item.deleted).length,
    deleteSkipped: migrated.filter((item) => item.deleteSkipped).length,
    beforeBytes: migrated.reduce((sum, item) => sum + (item.beforeBytes || 0), 0),
    afterBytes: migrated.reduce((sum, item) => sum + (item.afterBytes || 0), 0),
    migrated,
  };
}

async function cleanupLegacyObjects(client, objects) {
  const migrated = [];
  const errors = await withConcurrency(objects, concurrency, async (object) => {
    const sourceKey = object.name;
    const targetKey = toWebpKey(sourceKey);

    try {
      await client.head(targetKey, { timeout: 120_000 });
    } catch (error) {
      migrated.push({ sourceKey, targetKey, skipped: true, reason: `missing-webp:${error.code || error.message}` });
      return;
    }

    if (dryRun) {
      migrated.push({ sourceKey, targetKey, dryRun: true });
      return;
    }

    await client.delete(sourceKey, { timeout: 120_000 });
    migrated.push({ sourceKey, targetKey, deleted: true });
  });

  if (errors.length > 0) {
    console.error(`Legacy cleanup had ${errors.length} error(s):`);
    for (const { item, error } of errors.slice(0, 10)) {
      console.error(`  ${item.name}: ${error?.code || error?.message || error}`);
    }
    throw new Error(`Failed to cleanup ${errors.length} legacy OSS object(s)`);
  }

  return {
    candidates: objects.length,
    deleted: migrated.filter((item) => item.deleted).length,
    skipped: migrated.filter((item) => item.skipped).length,
    dryRun: migrated.filter((item) => item.dryRun).length,
    migrated,
  };
}

function requireOssEnvIfNeeded() {
  const missing = [
    "ALIYUN_OSS_ACCESS_KEY_ID",
    "ALIYUN_OSS_ACCESS_KEY_SECRET",
    "ALIYUN_OSS_BUCKET",
  ].filter((name) => !process.env[name]);
  if (!process.env.ALIYUN_OSS_REGION && !process.env.ALIYUN_OSS_ENDPOINT) {
    missing.push("ALIYUN_OSS_REGION or ALIYUN_OSS_ENDPOINT");
  }
  if (missing.length > 0) {
    throw new Error(`Missing OSS credentials: ${missing.join(", ")}`);
  }
}

function printSummary(label, result) {
  console.log(`\n# ${label}`);
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  loadEnv();
  console.log(`course OSS WebP migration · prefix=${prefix} · mode=${dryRun ? "dry-run" : "apply"} · q=${quality}`);
  console.log(`source=${sourceMode} referer=${referer}`);

  requireOssEnvIfNeeded();
  const { createOssClient } = await import("../lib/utils/oss-client.mjs");
  const client = createOssClient();

  const inventory = await getLegacyImageObjects(client);
  const imageObjects = cleanupLegacy
    ? await legacyImageObjectsFromCurrentWebpReferences()
    : inventory.imageObjects;

  console.log(
    `Inventory source: ${cleanupLegacy ? "webp-reference" : inventory.source}; ${
      inventory.allObjectCount === null ? "OSS list unavailable" : `${inventory.allObjectCount} OSS object(s)`
    }, ${imageObjects.length} legacy course image(s)`,
  );
  for (const object of imageObjects.slice(0, 20)) {
    console.log(`  ${object.name} -> ${toWebpKey(object.name)} (${object.size || 0} bytes)`);
  }
  if (imageObjects.length > 20) console.log(`  ... ${imageObjects.length - 20} more`);

  if (cleanupLegacy) {
    const cleanupResult = await cleanupLegacyObjects(client, imageObjects);
    printSummary("Legacy cleanup", {
      candidates: cleanupResult.candidates,
      deleted: cleanupResult.deleted,
      skipped: cleanupResult.skipped,
      dryRun: cleanupResult.dryRun,
    });
    console.log("\nDone.");
    return;
  }

  const ossResult = await migrateObjects(client, imageObjects);
  const migratedSlugs = getSlugsFromObjects(imageObjects);
  printSummary("OSS", {
    inventorySource: inventory.source,
    scanned: inventory.allObjectCount,
    legacyImages: imageObjects.length,
    slugs: migratedSlugs.length,
    uploaded: ossResult.uploaded,
    deleted: ossResult.deleted,
    deleteSkipped: ossResult.deleteSkipped,
    beforeMB: Number((ossResult.beforeBytes / 1e6).toFixed(2)),
    afterMB: Number((ossResult.afterBytes / 1e6).toFixed(2)),
  });

  if (updateDb) {
    printSummary("Database references", await updateDatabaseReferences(migratedSlugs));
  }

  if (updateJson) {
    printSummary("Local courseware JSON", updateLocalCoursewareJson(migratedSlugs));
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
