/**
 * 压缩 public/projects 下的图片（PNG/JPG/JPEG/WebP）
 * 使用方式：pnpm run compress:images  或  node scripts/compress-project-images.mjs
 * 可选环境变量：COMPRESS_IMAGES_DIR=public/other 指定目录
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DEFAULT_DIR = process.env.COMPRESS_IMAGES_DIR || "public/projects";
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

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    const name = path.relative(ROOT, filePath);
    const before = fs.statSync(filePath).size;

    try {
      const input = fs.readFileSync(filePath);
      let pipeline = sharp.default(input);
      const meta = await pipeline.metadata();
      const w = meta.width || 1920;
      const h = meta.height || 1080;

      // 可选：限制最大边长，减少体积（例如 1920）
      const maxSide = 1920;
      if (w > maxSide || h > maxSide) {
        pipeline = pipeline.resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true });
      }

      if (ext === ".png") {
        pipeline = pipeline.png({ compressionLevel: 8, effort: 9 });
      } else if (ext === ".jpg" || ext === ".jpeg") {
        pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });
      } else if (ext === ".webp") {
        pipeline = pipeline.webp({ quality: 85 });
      }

      const buf = await pipeline.toBuffer();
      fs.writeFileSync(filePath, buf);
      const after = buf.length;
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
