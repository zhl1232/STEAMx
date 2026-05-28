#!/usr/bin/env node
/**
 * Mirror Scratch GUI media library assets locally so the embedded editor works
 * without reaching out to assets.scratch.mit.edu (which is unreliable in CN).
 *
 * Scans public/scratch/libraries/{sprites,costumes,backdrops,sounds}.json for
 * every `md5ext` reference and downloads each into public/scratch/assets/.
 * Existing files are skipped unless --force is passed.
 *
 * Usage:
 *   node scripts/fetch-scratch-assets.mjs
 *   node scripts/fetch-scratch-assets.mjs --concurrency=12 --force
 *   HTTPS_PROXY=http://127.0.0.1:7890 node scripts/fetch-scratch-assets.mjs
 */

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LIB_DIR = path.join(ROOT, "public", "scratch", "libraries");
const OUT_DIR = path.join(ROOT, "public", "scratch", "assets");
const LIBRARIES = ["sprites", "costumes", "backdrops", "sounds"];
const DEFAULT_BASE = "https://assets.scratch.mit.edu";

function parseArgs() {
  const args = { concurrency: 8, force: false, base: DEFAULT_BASE, retries: 3 };
  for (const t of process.argv.slice(2)) {
    if (t.startsWith("--concurrency=")) args.concurrency = Number(t.split("=")[1]) || 8;
    else if (t === "--force") args.force = true;
    else if (t.startsWith("--base=")) args.base = t.split("=")[1].replace(/\/+$/, "");
    else if (t.startsWith("--retries=")) args.retries = Number(t.split("=")[1]) || 3;
  }
  return args;
}

function collectMd5ext(node, set) {
  if (Array.isArray(node)) {
    for (const item of node) collectMd5ext(item, set);
    return;
  }
  if (node && typeof node === "object") {
    if (typeof node.md5ext === "string") set.add(node.md5ext);
    for (const v of Object.values(node)) collectMd5ext(v, set);
  }
}

async function loadAllMd5ext() {
  const set = new Set();
  for (const name of LIBRARIES) {
    const file = path.join(LIB_DIR, `${name}.json`);
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    collectMd5ext(data, set);
  }
  return [...set].sort();
}

async function fetchOne(md5ext, { base, retries }) {
  const url = `${base}/${md5ext}`;
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return buf;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function runPool(items, worker, concurrency) {
  let cursor = 0;
  let done = 0;
  const total = items.length;
  const results = { ok: 0, skip: 0, fail: [] };
  const printProgress = () => {
    if (done % 25 === 0 || done === total) {
      process.stdout.write(
        `\r[${done}/${total}] ok=${results.ok} skip=${results.skip} fail=${results.fail.length}      `,
      );
    }
  };
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        const item = items[idx];
        try {
          const status = await worker(item);
          if (status === "ok") results.ok++;
          else if (status === "skip") results.skip++;
        } catch (e) {
          results.fail.push({ item, error: e.message || String(e) });
        }
        done++;
        printProgress();
      }
    }),
  );
  process.stdout.write("\n");
  return results;
}

async function main() {
  const args = parseArgs();
  await fs.mkdir(OUT_DIR, { recursive: true });
  const all = await loadAllMd5ext();
  console.log(`Found ${all.length} unique md5ext references in libraries/*.json`);
  console.log(`Downloading from ${args.base} → ${path.relative(ROOT, OUT_DIR)}`);
  console.log(`Concurrency=${args.concurrency}, force=${args.force}, retries=${args.retries}`);

  const results = await runPool(
    all,
    async (md5ext) => {
      const dest = path.join(OUT_DIR, md5ext);
      if (!args.force && existsSync(dest)) return "skip";
      const buf = await fetchOne(md5ext, args);
      await fs.writeFile(dest, buf);
      return "ok";
    },
    args.concurrency,
  );

  if (results.fail.length) {
    console.log(`\nFailures (${results.fail.length}):`);
    for (const f of results.fail.slice(0, 20)) {
      console.log(`  ${f.item}  ${f.error}`);
    }
    if (results.fail.length > 20) console.log(`  ... and ${results.fail.length - 20} more`);
    process.exitCode = 1;
  }
  console.log(`\nDone. ok=${results.ok} skip=${results.skip} fail=${results.fail.length}`);
}

await main();
