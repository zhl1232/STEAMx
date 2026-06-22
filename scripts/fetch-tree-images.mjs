#!/usr/bin/env node
/**
 * Fetch tree images from iNaturalist + Wikimedia Commons.
 *
 * For each species in tree.json, downloads multiple images (up to --per-species)
 * into public/trees/images/<slug>-1.jpg, <slug>-2.jpg, ...
 *
 * Usage:
 *   node scripts/fetch-tree-images.mjs
 *   node scripts/fetch-tree-images.mjs --limit=5 --per-species=6 --force
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INPUT_PATH = path.join(ROOT, "tree.json");
const OUTPUT_DIR = path.join(ROOT, "public", "trees", "images");
const MANIFEST_PATH = path.join(ROOT, "public", "trees", "media-manifest.json");

const INAT_API = "https://api.inaturalist.org/v1";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const HEADERS = {
  "User-Agent": "steam-explore-tree-media/1.0 (research; local-project)",
  Accept: "application/json",
};

function parseArgs() {
  const args = { limit: null, perSpecies: 5, force: false, delayMs: 400 };
  for (const t of process.argv.slice(2)) {
    if (t.startsWith("--limit=")) args.limit = Number(t.split("=")[1]) || null;
    else if (t.startsWith("--per-species=")) args.perSpecies = Number(t.split("=")[1]) || 5;
    else if (t === "--force") args.force = true;
    else if (t.startsWith("--delay-ms=")) args.delayMs = Number(t.split("=")[1]) || 400;
  }
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url, { headers: HEADERS });
      if (resp.status === 429) {
        await sleep(12000 * (i + 1));
        lastErr = new Error("HTTP 429");
        continue;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (e) {
      lastErr = e;
      await sleep(1000 * (i + 1));
    }
  }
  throw lastErr;
}

async function downloadFile(url, outPath, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url, { headers: HEADERS });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      await fs.writeFile(outPath, buf);
      return;
    } catch (e) {
      lastErr = e;
      await sleep(1000 * (i + 1));
    }
  }
  throw lastErr;
}

/** Strip cultivar/variety/form suffixes to get a simpler search name */
function simplifyName(name) {
  // Remove quoted cultivar: 'Atropurpurea', 'Luteus', etc.
  let s = name.replace(/\s*'[^']*'$/g, "").replace(/\s*"[^"]*"$/g, "");
  // Remove var./subsp./f. suffixes
  s = s.replace(/\s+(var\.|subsp\.|f\.)\s+\S+/g, "");
  return s.trim();
}

/** Get multiple observation photos from iNaturalist */
async function getInatImages(scientificName, maxCount) {
  const names = [scientificName];
  const simple = simplifyName(scientificName);
  if (simple !== scientificName) names.push(simple);

  let taxon = null;
  for (const name of names) {
    const taxaData = await fetchJson(
      `${INAT_API}/taxa?q=${encodeURIComponent(name)}&rank=species,variety,hybrid,subspecies&per_page=5`
    );
    const taxa = taxaData?.results || [];
    taxon = taxa.find((t) => t.name?.toLowerCase() === name.toLowerCase()) || taxa[0];
    if (taxon) break;
  }
  if (!taxon) return [];

  // Get observations with photos
  const obsData = await fetchJson(
    `${INAT_API}/observations?taxon_id=${taxon.id}&photos=true&quality_grade=research&per_page=${maxCount}&order_by=votes`
  );
  const observations = obsData?.results || [];

  const urls = [];
  for (const obs of observations) {
    for (const photo of obs.photos || []) {
      if (urls.length >= maxCount) break;
      const url = (photo.url || "").replace("/square.", "/medium.");
      if (url) urls.push({ url, license: photo.license_code, attribution: photo.attribution });
    }
    if (urls.length >= maxCount) break;
  }
  return urls.slice(0, maxCount);
}

/** Get one image from Wikimedia via Wikidata P18 */
async function getWikimediaImage(scientificName) {
  const names = [scientificName];
  const simple = simplifyName(scientificName);
  if (simple !== scientificName) names.push(simple);

  for (const name of names) {
    const searchData = await fetchJson(
      `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=3&format=json&origin=*`
    );
    const hit = (searchData?.search || []).find(
      (s) => s.label?.toLowerCase() === name.toLowerCase()
    ) || searchData?.search?.[0];
    if (!hit) continue;

    const entityData = await fetchJson(
      `${WIKIDATA_API}?action=wbgetentities&ids=${hit.id}&props=claims&format=json&origin=*`
    );
    const entity = entityData?.entities?.[hit.id];
    const fileName = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!fileName) continue;

    const fileInfoData = await fetchJson(
      `${COMMONS_API}?action=query&titles=File:${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url|mime&format=json&origin=*`
    );
    const pages = fileInfoData?.query?.pages || {};
    const info = Object.values(pages)[0]?.imageinfo?.[0];
    if (info?.url) return { url: info.url, license: "Wikimedia Commons", attribution: null };
  }
  return null;
}

async function loadSpecies() {
  const raw = await fs.readFile(INPUT_PATH, "utf8");
  // Fix known JSON corruption: field name truncations
  const fixed = raw
    .replace(/"taxon_gr: "/g, '"taxon_group": "')
    .replace(/"tes": "/g, '"habitat_notes": "')
    .replace(/"tat_notes": "/g, '"habitat_notes": "');
  // Try parsing; if still broken, extract via regex
  try {
    return JSON.parse(fixed);
  } catch {
    // Fallback: extract slug + scientific_name pairs
    const slugs = [...raw.matchAll(/"slug":\s*"([^"]+)"/g)].map((m) => m[1]);
    const names = [...raw.matchAll(/"scientific_name":\s*"([^"]+)"/g)].map((m) => m[1]);
    return slugs.map((slug, i) => ({ slug, scientific_name: names[i] || "" }));
  }
}

async function main() {
  const args = parseArgs();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const allSpecies = await loadSpecies();
  const species = args.limit ? allSpecies.slice(0, args.limit) : allSpecies;

  console.log(`Loaded ${allSpecies.length} species, processing ${species.length}`);
  console.log(`Target: ${args.perSpecies} images per species\n`);

  const results = [];

  for (let i = 0; i < species.length; i++) {
    const sp = species[i];
    if (!sp.slug || !sp.scientific_name) continue;

    process.stdout.write(`[${i + 1}/${species.length}] ${sp.slug} (${sp.scientific_name}) ... `);

    // Check existing files
    const existingFiles = [];
    if (!args.force) {
      for (let n = 1; n <= args.perSpecies; n++) {
        const p = path.join(OUTPUT_DIR, `${sp.slug}-${n}.jpg`);
        if (await fs.access(p).then(() => true).catch(() => false)) {
          existingFiles.push(`${sp.slug}-${n}.jpg`);
        }
      }
      if (existingFiles.length >= args.perSpecies) {
        results.push({ slug: sp.slug, scientificName: sp.scientific_name, images: existingFiles, status: "exists" });
        console.log(`exists(${existingFiles.length})`);
        continue;
      }
    }

    try {
      // Get images from iNaturalist (primary source, multiple photos)
      const inatImages = await getInatImages(sp.scientific_name, args.perSpecies);
      // If not enough, try Wikimedia for one more
      const allImages = [...inatImages];
      if (allImages.length < args.perSpecies) {
        const wikiImg = await getWikimediaImage(sp.scientific_name);
        if (wikiImg) allImages.push(wikiImg);
      }

      const downloaded = [];
      for (let n = 0; n < Math.min(allImages.length, args.perSpecies); n++) {
        const fileName = `${sp.slug}-${n + 1}.jpg`;
        const outPath = path.join(OUTPUT_DIR, fileName);
        // Skip if already exists and not forcing
        if (!args.force && await fs.access(outPath).then(() => true).catch(() => false)) {
          downloaded.push(fileName);
          continue;
        }
        try {
          await downloadFile(allImages[n].url, outPath);
          downloaded.push(fileName);
        } catch {
          // skip this image
        }
        await sleep(200);
      }

      results.push({ slug: sp.slug, scientificName: sp.scientific_name, images: downloaded, status: downloaded.length ? "downloaded" : "not_found" });
      console.log(`${downloaded.length} images`);
    } catch (e) {
      results.push({ slug: sp.slug, scientificName: sp.scientific_name, images: [], status: "error", error: e.message });
      console.log(`error: ${e.message}`);
    }

    await sleep(args.delayMs);
  }

  // Write manifest
  const summary = {
    total: results.length,
    downloaded: results.filter((r) => r.status === "downloaded").length,
    exists: results.filter((r) => r.status === "exists").length,
    not_found: results.filter((r) => r.status === "not_found").length,
    error: results.filter((r) => r.status === "error").length,
    totalImages: results.reduce((s, r) => s + r.images.length, 0),
  };
  const manifest = { generatedAt: new Date().toISOString(), perSpecies: args.perSpecies, summary, results };
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");

  console.log(`\nDone! Manifest: public/trees/media-manifest.json`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
