import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg"]);
const DEFAULT_QUALITY = 82;

function isCourseRasterImage(filePath) {
  return IMAGE_EXT.has(extname(filePath).toLowerCase());
}

export function listCourseRasterImages(rootDir, { recursive = true, filter = null } = {}) {
  const files = [];
  if (!existsSync(rootDir)) return files;

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) walk(absPath);
      } else if (entry.isFile() && isCourseRasterImage(absPath) && (!filter || filter(absPath))) {
        files.push(absPath);
      }
    }
  }

  walk(rootDir);
  return files.sort((a, b) => a.localeCompare(b));
}

export function toWebpPath(filePath) {
  return filePath.replace(/\.(png|jpe?g)$/i, ".webp");
}

export async function convertCourseImagesToWebp(rootDir, options = {}) {
  const quality = Number(options.quality ?? DEFAULT_QUALITY) || DEFAULT_QUALITY;
  const recursive = options.recursive ?? true;
  const filter = options.filter ?? null;
  const removeOriginal = options.removeOriginal ?? true;
  const dryRun = options.dryRun ?? false;
  const log = options.log ?? (() => {});
  const sharpModule = options.sharpModule ?? (await import("sharp").catch(() => null));
  const sharp = sharpModule?.default ?? sharpModule;

  if (!sharp && !dryRun) {
    throw new Error("sharp is required to convert course images to WebP");
  }

  const files = listCourseRasterImages(rootDir, { recursive, filter });
  const result = {
    scanned: files.length,
    converted: 0,
    removed: 0,
    beforeBytes: 0,
    afterBytes: 0,
    files: [],
  };

  for (const filePath of files) {
    const targetPath = toWebpPath(filePath);
    const before = statSync(filePath).size;
    result.beforeBytes += before;

    if (dryRun) {
      result.files.push({ source: filePath, target: targetPath, beforeBytes: before, afterBytes: 0 });
      continue;
    }

    await sharp(filePath).webp({ quality }).toFile(targetPath);
    const after = statSync(targetPath).size;
    result.afterBytes += after;
    result.converted += 1;

    if (removeOriginal) {
      rmSync(filePath);
      result.removed += 1;
    }

    result.files.push({ source: filePath, target: targetPath, beforeBytes: before, afterBytes: after });
    if (options.verbose) {
      const saved = before > 0 ? Math.round((1 - after / before) * 100) : 0;
      log(`  ${relative(rootDir, filePath)} -> ${relative(rootDir, targetPath)} (${saved}% saved)`);
    }
  }

  return result;
}

export function webpFileNamesFromSlideFiles(files) {
  return files.map((file) => file.replace(/\.(png|jpe?g)$/i, ".webp"));
}

export function rewriteCourseImageUrlToWebp(url) {
  if (typeof url !== "string") return url;
  return url.replace(/\.(png|jpe?g)(?=([?#]|$))/gi, ".webp");
}
