#!/usr/bin/env node
// 把 PowerPoint 导出的幻灯片图片规范成 slide-01.png … slide-NN.png，
// 拷贝到课时的 public/courses/<lesson>/slides/ 目录，供「课件翻页器」读取。
//
// 用法：
//   node scripts/normalize-slides.mjs <源目录> [输出目录]
// 例：
//   node scripts/normalize-slides.mjs "/mnt/c/Users/Administrator/Desktop/埃菲铁塔授课PPT" \
//        public/courses/eiffel-tower/slides
//
// 源目录里放 PowerPoint「导出 → 更改文件类型 → PNG → 所有幻灯片」生成的图片
//（文件名通常是「幻灯片1.PNG / Slide1.PNG」等，本脚本按文件名里的数字自然排序）。

import { mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";

const [, , srcArg, outArg] = process.argv;
if (!srcArg) {
    console.error("用法: node scripts/normalize-slides.mjs <源目录> [输出目录=public/courses/eiffel-tower/slides]");
    process.exit(1);
}

const srcDir = resolve(srcArg);
const outDir = resolve(outArg ?? "public/courses/eiffel-tower/slides");

const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function naturalNum(name) {
    const m = name.match(/(\d+)/g);
    return m ? parseInt(m[m.length - 1], 10) : Number.MAX_SAFE_INTEGER;
}

let entries;
try {
    entries = readdirSync(srcDir).filter((f) => {
        try {
            return statSync(join(srcDir, f)).isFile() && IMG_EXT.has(extname(f).toLowerCase());
        } catch {
            return false;
        }
    });
} catch (err) {
    console.error(`无法读取源目录 ${srcDir}: ${err.message}`);
    process.exit(1);
}

if (entries.length === 0) {
    console.error(`源目录里没找到图片（支持 ${[...IMG_EXT].join(", ")}）：${srcDir}`);
    process.exit(1);
}

entries.sort((a, b) => naturalNum(a) - naturalNum(b) || a.localeCompare(b));

mkdirSync(outDir, { recursive: true });

const nonPng = entries.filter((f) => extname(f).toLowerCase() !== ".png");
if (nonPng.length) {
    console.warn(
        `⚠️ 有 ${nonPng.length} 个非 PNG 文件会被原样拷成 .png（建议在 PowerPoint 里按 PNG 导出，避免 MIME 不匹配）。`,
    );
}

const pad = (n) => String(n).padStart(2, "0");
entries.forEach((file, i) => {
    const target = `slide-${pad(i + 1)}.png`;
    copyFileSync(join(srcDir, file), join(outDir, target));
    console.log(`  ${file}  ->  ${target}`);
});

console.log(`\n✅ 已整理 ${entries.length} 页到 ${outDir}`);
console.log("   迁移里 slideImageUrls 已按 slide-01.png … 命名，刷新课时页「课件」Tab 即可看到。");
if (entries.length !== 16) {
    console.warn(`   注意：本课件应为 16 页，当前导出了 ${entries.length} 页，请核对。`);
}
