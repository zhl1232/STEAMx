#!/usr/bin/env node
/**
 * Batch export courseware PPTX files to public/courses/<slug>/slides.
 *
 * Defaults target the Windows Documents courseware dump mounted in WSL:
 *   node scripts/export-courseware-slides.mjs --dry-run
 *   node scripts/export-courseware-slides.mjs
 *   node scripts/export-courseware-slides.mjs --upload
 *
 * The script is resumable: it counts real PPTX slides from the package first,
 * skips complete outputs, renders into a temporary directory, then replaces only
 * slide-*.png/webp in the target slides directory after a successful full render.
 */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { pinyin } from "pinyin-pro";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_SOURCE = "/mnt/c/Users/Administrator/Documents";
const DEFAULT_OUT = path.join(ROOT, "public/courses");
const DEFAULT_REPORT = path.join(ROOT, "scripts/courseware/batch-slide-export-report.json");

const argv = process.argv.slice(2);
const flags = new Map();
const positional = [];
for (const token of argv) {
  const match = token.match(/^--([^=]+)(?:=(.*))?$/);
  if (match) flags.set(match[1], match[2] === undefined ? "true" : match[2]);
  else positional.push(token);
}

const flag = (name, fallback) => (flags.has(name) ? flags.get(name) : fallback);
const bool = (name) => flags.get(name) === "true" || flags.get(name) === "";

const sourceRoot = path.resolve(positional[0] || flag("source", DEFAULT_SOURCE));
const outputRoot = path.resolve(flag("out", DEFAULT_OUT));
const reportPath = path.resolve(flag("report", DEFAULT_REPORT));
const dpi = Number(flag("dpi", 150)) || 150;
const limit = flags.has("limit") ? Math.max(0, Number(flag("limit"))) : null;
const dryRun = bool("dry-run");
const force = bool("force");
const stopOnError = bool("stop-on-error");
const updateJson = !bool("no-update-json");
const doUpload = bool("upload");
const uploadConcurrency = Number(flag("upload-concurrency", flag("concurrency", 16))) || 16;
const skipExistingUpload = bool("skip-existing-upload");
const onlyMatchers = (flag("only", "") || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

function loadEnv() {
  for (const filename of [".env.local", ".env"]) {
    const envPath = path.join(ROOT, filename);
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

function printUsageAndExit() {
  console.error("用法: node scripts/export-courseware-slides.mjs [sourceRoot] [选项]");
  console.error("");
  console.error("常用选项:");
  console.error("  --dry-run                  只统计，不导出/上传");
  console.error("  --force                    即使页数已完整也重导");
  console.error("  --only=<slug/title/path>   逗号分隔筛选");
  console.error("  --limit=<n>                只处理前 n 个匹配课件");
  console.error("  --upload                   导出后上传 slides 到 OSS");
  console.error("  --skip-existing-upload     上传时跳过 OSS 已有对象（默认覆盖，修复旧 slide-01）");
  console.error("  --no-update-json           不刷新 scripts/courseware/<slug>.json 的 slideImageUrls");
  process.exit(1);
}

if (bool("help") || bool("h")) printUsageAndExit();

function walkPpts(dir, out = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPpts(abs, out);
    } else if (entry.isFile() && /\.pptx?$/i.test(entry.name) && !entry.name.startsWith("~$")) {
      out.push(abs);
    }
  }
  return out;
}

function slugifyText(text) {
  const raw = pinyin(text, { toneType: "none", type: "array" })
    .join("-")
    .toLowerCase();
  return raw
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function lessonInfoForPpt(pptPath) {
  const lessonFolder = path.basename(path.dirname(pptPath));
  const courseFolder = path.basename(path.dirname(path.dirname(pptPath)));
  const match = lessonFolder.match(/^(\d+)\s*[+＋]\s*(.+)$/);
  const grade = match?.[1] || null;
  const lessonTitle = (match?.[2] || lessonFolder).trim();
  const slugBase = slugifyText(lessonTitle || path.basename(pptPath, path.extname(pptPath)));
  const slug = grade ? `${grade}-${slugBase}` : slugBase;
  return { slug, grade, lessonTitle, courseTitle: courseFolder, lessonFolder };
}

function expectedSlideCount(pptPath) {
  if (!/\.pptx$/i.test(pptPath)) return null;
  const zip = unzipSync(new Uint8Array(readFileSync(pptPath)));
  return Object.keys(zip).filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name)).length;
}

const SLIDE_RE = /^slide-(\d+)\.(png|webp)$/i;
function slideFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => SLIDE_RE.test(name))
    .sort((a, b) => {
      const left = Number(a.match(SLIDE_RE)?.[1] || 0);
      const right = Number(b.match(SLIDE_RE)?.[1] || 0);
      return left - right || a.localeCompare(b);
    });
}

function clearSlideFiles(dir) {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    if (SLIDE_RE.test(file)) rmSync(path.join(dir, file), { force: true });
  }
}

function matchesOnly(item) {
  if (onlyMatchers.length === 0) return true;
  const haystack = [
    item.slug,
    item.lessonTitle,
    item.courseTitle,
    item.lessonFolder,
    item.pptPath,
  ].join("\n").toLowerCase();
  return onlyMatchers.some((matcher) => haystack.includes(matcher));
}

function inferUrlBase(existingJson, slug) {
  const urls = existingJson?.content?.building3d?.slideImageUrls;
  const first = Array.isArray(urls) ? urls.find((value) => typeof value === "string") : null;
  const match = first?.match(/^(.*)\/slides\/slide-\d+\.(?:png|webp)$/i);
  return match?.[1] || `/courses/${slug}`;
}

function updateCoursewareJson(item, files) {
  if (!updateJson) return false;

  const manifestPath = path.join(ROOT, "scripts/courseware", `${item.slug}.json`);
  if (!existsSync(manifestPath)) return false;

  let json;
  try {
    json = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    console.warn(`  ! 跳过 JSON 更新，解析失败: ${path.relative(ROOT, manifestPath)} (${err.message})`);
    return false;
  }

  const urlBase = inferUrlBase(json, item.slug);
  json.generatedAt = new Date().toISOString();
  json.assets = {
    ...(json.assets || {}),
    slides: files.length,
    slideExt: "png",
  };
  json.content = json.content || {};
  json.content.building3d = json.content.building3d || {};
  json.content.building3d.slideImageUrls = files.map((file) => `${urlBase}/slides/${file}`);

  writeFileSync(manifestPath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  return true;
}

function writeReport(report) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function buildItems() {
  if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) {
    throw new Error(`sourceRoot 不存在或不是目录: ${sourceRoot}`);
  }

  const raw = walkPpts(sourceRoot)
    .sort((a, b) => a.localeCompare(b, "zh-CN"))
    .map((pptPath) => {
      const info = lessonInfoForPpt(pptPath);
      const slidesDir = path.join(outputRoot, info.slug, "slides");
      let expectedSlides = null;
      let expectedError = null;
      try {
        expectedSlides = expectedSlideCount(pptPath);
      } catch (err) {
        expectedError = err.message;
      }
      const actualSlides = slideFiles(slidesDir).length;
      return {
        ...info,
        pptPath,
        slidesDir,
        expectedSlides,
        expectedError,
        actualSlides,
      };
    })
    .filter(matchesOnly);

  return limit === null ? raw : raw.slice(0, limit);
}

function summarize(items) {
  const collisions = new Map();
  for (const item of items) {
    if (!collisions.has(item.slug)) collisions.set(item.slug, []);
    collisions.get(item.slug).push(item.pptPath);
  }
  const collisionRows = [...collisions.entries()].filter(([, values]) => values.length > 1);
  const complete = items.filter((item) => item.expectedSlides !== null && item.actualSlides >= item.expectedSlides);
  const needsExport = items.filter((item) => force || item.expectedSlides === null || item.actualSlides < item.expectedSlides);
  return {
    total: items.length,
    complete: complete.length,
    needsExport: needsExport.length,
    collisions: collisionRows,
    expectedSlides: items.reduce((sum, item) => sum + (item.expectedSlides || 0), 0),
    actualSlides: items.reduce((sum, item) => sum + item.actualSlides, 0),
  };
}

function exportItem(item, index, total) {
  const before = Date.now();
  const expectedLabel = item.expectedSlides ?? "?";
  console.log(`\n[${index}/${total}] ${item.slug} (${item.lessonTitle}) expected=${expectedLabel} actual=${item.actualSlides}`);

  if (!force && item.expectedSlides !== null && item.actualSlides >= item.expectedSlides) {
    console.log("  = skip: slides 已完整");
    const files = slideFiles(item.slidesDir);
    const jsonUpdated = updateCoursewareJson(item, files);
    return {
      status: "skipped",
      reason: "complete",
      exportedSlides: files.length,
      jsonUpdated,
      durationMs: Date.now() - before,
    };
  }

  const tempDir = mkdtempSync(path.join(tmpdir(), "courseware-slides-"));
  try {
    const result = spawnSync(
      "node",
      [path.join(ROOT, "scripts/pptx-to-slides.mjs"), item.pptPath, tempDir, `--dpi=${dpi}`],
      {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 30 * 1024 * 1024,
      },
    );

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);

    if (result.status !== 0) {
      return {
        status: "failed",
        reason: `pptx-to-slides exited ${result.status}`,
        exportedSlides: 0,
        durationMs: Date.now() - before,
      };
    }

    const files = slideFiles(tempDir);
    if (files.length === 0) {
      return {
        status: "failed",
        reason: "no slide images generated",
        exportedSlides: 0,
        durationMs: Date.now() - before,
      };
    }
    if (item.expectedSlides !== null && files.length < item.expectedSlides) {
      return {
        status: "failed",
        reason: `generated ${files.length}/${item.expectedSlides} slides; target not replaced`,
        exportedSlides: files.length,
        durationMs: Date.now() - before,
      };
    }

    mkdirSync(item.slidesDir, { recursive: true });
    clearSlideFiles(item.slidesDir);
    for (const file of files) {
      copyFileSync(path.join(tempDir, file), path.join(item.slidesDir, file));
    }

    const finalFiles = slideFiles(item.slidesDir);
    const jsonUpdated = updateCoursewareJson(item, finalFiles);
    console.log(`  ✓ replaced ${path.relative(ROOT, item.slidesDir)} (${finalFiles.length} slides)`);
    return {
      status: "exported",
      reason: force ? "force" : "short",
      exportedSlides: finalFiles.length,
      jsonUpdated,
      durationMs: Date.now() - before,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function uploadSlides(item) {
  const files = slideFiles(item.slidesDir);
  if (files.length === 0) {
    return { status: "skipped", reason: "no local slides", uploadedFiles: 0 };
  }

  const oss = await import(path.join(ROOT, "lib/utils/oss-client.mjs"));
  const client = oss.createOssClient();
  const uploadedFiles = await oss.uploadDirectory(client, {
    localDir: item.slidesDir,
    publicPathPrefix: `courses/${item.slug}/slides`,
    concurrency: uploadConcurrency,
    skipExisting: skipExistingUpload,
    recursive: false,
  });
  return { status: "uploaded", uploadedFiles };
}

async function main() {
  if (doUpload) loadEnv();

  const items = buildItems();
  const summary = summarize(items);
  console.log("# Courseware slide export");
  console.log(`source : ${sourceRoot}`);
  console.log(`output : ${outputRoot}`);
  console.log(`report : ${reportPath}`);
  console.log(`items  : ${summary.total}`);
  console.log(`slides : expected=${summary.expectedSlides} local=${summary.actualSlides}`);
  console.log(`state  : complete=${summary.complete} needsExport=${summary.needsExport} force=${force}`);

  if (summary.collisions.length > 0) {
    console.error("\nSlug collisions:");
    for (const [slug, paths] of summary.collisions) {
      console.error(`  ${slug}`);
      for (const pptPath of paths) console.error(`    - ${pptPath}`);
    }
    process.exit(1);
  }

  if (dryRun) {
    const needs = items.filter((item) => force || item.expectedSlides === null || item.actualSlides < item.expectedSlides);
    console.log("\n[dry-run] first items needing export:");
    for (const item of needs.slice(0, 30)) {
      console.log(`  ${item.slug}: expected=${item.expectedSlides ?? "?"} actual=${item.actualSlides} ${item.pptPath}`);
    }
    return;
  }

  const report = {
    sourceRoot,
    outputRoot,
    dpi,
    force,
    upload: doUpload,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    summary: {
      total: items.length,
      exported: 0,
      skipped: 0,
      failed: 0,
      uploaded: 0,
      uploadFailed: 0,
    },
    items: [],
  };
  writeReport(report);

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const result = exportItem(item, i + 1, items.length);
    const row = {
      slug: item.slug,
      lessonTitle: item.lessonTitle,
      courseTitle: item.courseTitle,
      source: item.pptPath,
      slidesDir: item.slidesDir,
      expectedSlides: item.expectedSlides,
      actualSlidesBefore: item.actualSlides,
      ...result,
    };

    if (result.status === "exported") report.summary.exported += 1;
    else if (result.status === "skipped") report.summary.skipped += 1;
    else report.summary.failed += 1;

    if (doUpload && result.status !== "failed") {
      try {
        const uploadResult = await uploadSlides(item);
        row.upload = uploadResult;
        if (uploadResult.status === "uploaded") report.summary.uploaded += 1;
      } catch (err) {
        row.upload = { status: "failed", reason: err.message };
        report.summary.uploadFailed += 1;
        console.error(`  ! upload failed: ${err.message}`);
        if (stopOnError) {
          report.items.push(row);
          writeReport(report);
          process.exit(1);
        }
      }
    }

    report.items.push(row);
    writeReport(report);

    if (result.status === "failed" && stopOnError) {
      console.error(`Stop on error: ${item.slug}`);
      process.exit(1);
    }
  }

  report.finishedAt = new Date().toISOString();
  writeReport(report);
  console.log("\nDone.");
  console.log(`exported=${report.summary.exported} skipped=${report.summary.skipped} failed=${report.summary.failed}`);
  if (doUpload) {
    console.log(`uploaded=${report.summary.uploaded} uploadFailed=${report.summary.uploadFailed}`);
  }
  console.log(`report: ${path.relative(ROOT, reportPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
