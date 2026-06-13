/**
 * 压缩目录下的图片（PNG/JPG/JPEG/WebP）
 * 使用方式：
 *   pnpm run compress:images
 *   COMPRESS_IMAGES_DIR=public/fruits/images node scripts/compress-project-images.mjs
 * 可选环境变量：
 *   COMPRESS_IMAGES_DIR   目标目录（默认 public/projects）
 *   COMPRESS_MAX_SIDE     最大边长（默认 1920；物种图建议 1280）
 *   COMPRESS_JPEG_QUALITY JPEG 质量（默认 85；物种图建议 80）
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compressSpeciesImageFile } from "./lib/compress-species-image.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DEFAULT_DIR = process.env.COMPRESS_IMAGES_DIR || "public/projects";
const MAX_SIDE = Number(process.env.COMPRESS_MAX_SIDE || 1920);
const JPEG_QUALITY = Number(process.env.COMPRESS_JPEG_QUALITY || 85);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function getAllImageFiles(dir, list = []) {
  if (!fs.existsSync(dir)) {
    console.warn("目录不存在:", dir);
    return list;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      getAllImageFiles(full, list);
    } else if (IMAGE_EXT.has(path.extname(e.name).toLowerCase())) {
      list.push(full);
    }
  }
  return list;
}

async function main() {
  const sharp = await import("sharp").catch(() => null);
  if (!sharp?.default) {
    console.error("请先安装 sharp: pnpm add -D sharp");
    process.exit(1);
  }

  const dir = path.join(ROOT, DEFAULT_DIR);
  const files = getAllImageFiles(dir);
  if (files.length === 0) {
    console.log("未在", DEFAULT_DIR, "下找到图片文件");
    return;
  }

  console.log("找到", files.length, "个图片，开始压缩…\n");

  let totalBefore = 0;
  let totalAfter = 0;

  console.log(`maxSide=${MAX_SIDE}, jpegQuality=${JPEG_QUALITY}\n`);

  for (const filePath of files) {
    const name = path.relative(ROOT, filePath);
    const before = fs.statSync(filePath).size;

    try {
      const after = await compressSpeciesImageFile(filePath, sharp, {
        maxSide: MAX_SIDE,
        jpegQuality: JPEG_QUALITY,
        webpQuality: JPEG_QUALITY,
      });
      totalBefore += before;
      totalAfter += after;
      const pct = before > 0 ? ((1 - after / before) * 100).toFixed(1) : "0";
      console.log(name, ":", (before / 1024).toFixed(1), "KB ->", (after / 1024).toFixed(1), "KB ( -" + pct + "% )");
    } catch (err) {
      console.error("处理失败:", name, err.message);
    }
  }

  const saved = totalBefore - totalAfter;
  const pct = totalBefore > 0 ? ((saved / totalBefore) * 100).toFixed(1) : "0";
  console.log("\n合计:", (totalBefore / 1024).toFixed(1), "KB ->", (totalAfter / 1024).toFixed(1), "KB, 节省", (saved / 1024).toFixed(1), "KB ( -" + pct + "% )");
}

main();
