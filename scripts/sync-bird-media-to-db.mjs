#!/usr/bin/env node
/**
 * 将 public/birds/images 与 public/birds/audio 中已有文件回写到 public.species
 *
 * Usage:
 *   node scripts/sync-bird-media-to-db.mjs
 *   node scripts/sync-bird-media-to-db.mjs --dry-run
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const IMAGES_DIR = path.join(ROOT, "public", "birds", "images");
const AUDIO_DIR = path.join(ROOT, "public", "birds", "audio");

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
  };
}

async function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  try {
    const content = await fs.readFile(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ignore
  }
}

async function listFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

function mapSlugToAsset(files, prefix) {
  const map = new Map();
  for (const file of files) {
    const dotIdx = file.lastIndexOf(".");
    if (dotIdx <= 0) continue;
    const slug = file.slice(0, dotIdx);
    if (!slug) continue;
    if (!map.has(slug)) {
      map.set(slug, `${prefix}/${file}`);
    }
  }
  return map;
}

async function postQuery(sql) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const resp = await fetch(`${supabaseUrl}/pg/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  }
  return await resp.json();
}

async function getActiveSpecies() {
  const rows = await postQuery(`
    SELECT id, slug, cover_image_url, audio_url
    FROM public.species
    WHERE is_active = TRUE
    ORDER BY id;
  `);
  return Array.isArray(rows) ? rows : [];
}

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await loadEnvLocal();

  const [imageFiles, audioFiles, speciesRows] = await Promise.all([
    listFiles(IMAGES_DIR),
    listFiles(AUDIO_DIR),
    getActiveSpecies(),
  ]);

  const imageMap = mapSlugToAsset(imageFiles, "/birds/images");
  const audioMap = mapSlugToAsset(audioFiles, "/birds/audio");

  let imageUpdates = 0;
  let audioUpdates = 0;
  const updates = [];

  for (const row of speciesRows) {
    const coverUrl = imageMap.get(row.slug) || null;
    const audioUrl = audioMap.get(row.slug) || null;
    const shouldUpdateImage = coverUrl !== row.cover_image_url;
    const shouldUpdateAudio = audioUrl !== row.audio_url;

    if (!shouldUpdateImage && !shouldUpdateAudio) continue;

    if (shouldUpdateImage) imageUpdates++;
    if (shouldUpdateAudio) audioUpdates++;

    const coverSql = coverUrl ? `'${escapeSql(coverUrl)}'` : "NULL";
    const audioSql = audioUrl ? `'${escapeSql(audioUrl)}'` : "NULL";
    updates.push(`
      UPDATE public.species
      SET cover_image_url = ${coverSql},
          audio_url = ${audioSql},
          updated_at = now()
      WHERE id = ${row.id};
    `);
  }

  console.log(`Active species: ${speciesRows.length}`);
  console.log(`Local image files: ${imageFiles.length}`);
  console.log(`Local audio files: ${audioFiles.length}`);
  console.log(`Rows to update: ${updates.length}`);
  console.log(`Image URL changes: ${imageUpdates}`);
  console.log(`Audio URL changes: ${audioUpdates}`);

  if (args.dryRun || updates.length === 0) {
    console.log(args.dryRun ? "Dry-run finished." : "No updates needed.");
    return;
  }

  await postQuery(updates.join("\n"));
  console.log("Database species media URLs updated.");
}

main().catch((err) => {
  console.error(`Failed: ${err.message || err}`);
  process.exit(1);
});
