#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim().replace(/^"|"$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadEnv();

const { createOssClient } = await import(join(ROOT, "lib/utils/oss-client.mjs"));
const client = createOssClient();

const ASSETS = [
  ["slides/slide-01.webp", "slide"],
  ["instructions.pdf", "pdf"],
  ["animation.mp4", "video"],
  ["finished.webp", "finished"],
];

const LEGACY_IMAGE_FALLBACKS = {
  slide: "slides/slide-01.png",
  finished: "finished.png",
};

async function head(key) {
  try {
    const r = await client.head(key);
    return { ok: true, size: r.res?.headers?.["content-length"] ?? "?" };
  } catch (e) {
    return { ok: false, code: e.code || String(e.message).slice(0, 80) };
  }
}

const samples = ["3-bao-jian", "3-dian-hua-ji", "4-diao-che", "5-re-qi-qiu", "3-ai-fei-er-tie-ta"];
const sampleResults = [];
for (const slug of samples) {
  const row = { slug, assets: {} };
  for (const [path, label] of ASSETS) {
    const result = await head(`courses/${slug}/${path}`);
    row.assets[label] = result.ok || !LEGACY_IMAGE_FALLBACKS[label]
      ? result
      : { ...(await head(`courses/${slug}/${LEGACY_IMAGE_FALLBACKS[label]}`)), legacy: true };
  }
  sampleResults.push(row);
}

const allSlugs = readdirSync(join(ROOT, "scripts/courseware"))
  .filter((f) => f.endsWith(".json") && f !== "batch-slide-export-report.json" && f !== "eiffel-tower.json")
  .map((f) => f.replace(/\.json$/, ""));

const stats = { total: allSlugs.length, slide: 0, pdf: 0, video: 0, finished: 0 };
const missing = { pdf: [], video: [], finished: [] };

for (const slug of allSlugs) {
  for (const [path, label] of ASSETS) {
    let r = await head(`courses/${slug}/${path}`);
    if (!r.ok && LEGACY_IMAGE_FALLBACKS[label]) {
      r = { ...(await head(`courses/${slug}/${LEGACY_IMAGE_FALLBACKS[label]}`)), legacy: true };
    }
    if (r.ok) {
      stats[label] += 1;
    } else if (label !== "slide" && missing[label].length < 15) {
      missing[label].push(slug);
    }
  }
  if (allSlugs.indexOf(slug) % 50 === 49) {
    process.stdout.write(`  checked ${allSlugs.indexOf(slug) + 1}/${allSlugs.length}\n`);
  }
}

console.log(JSON.stringify({ samples: sampleResults, stats, missingSamples: missing }, null, 2));
