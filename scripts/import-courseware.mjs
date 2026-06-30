#!/usr/bin/env node
/**
 * 课件文件夹 → 线上课程「资源管线」（确定性部分）。
 *
 * 把一个课件文件夹（PPT + 视频 + 搭建说明 PDF + 成品图）一键转成课时工作区可直接用的素材：
 *   1. 扫描文件夹，按扩展名 + 关键词识别 pptx / 视频 / pdf / 成品图；
 *   2. PPT → 逐页图（复用 scripts/pptx-to-slides.mjs，需 LibreOffice + poppler + 中文字体），
 *      或用 --slides-dir 直接采用现成幻灯片图；
 *   3. 幻灯片图转 WebP 压缩（sharp，省 60-80% 体积）；
 *   4. 视频 / PDF / 成品图归一化拷到 public/courses/<slug>/；
 *   5. 可选 --upload 推到阿里云 OSS（courses/<slug>/...）；
 *   6. 产出 building3d 内容草稿 scripts/courseware/<slug>.json（含 slideImageUrls / videoUrl /
 *      videoSlideIndex / slidesPdfUrl / finishedImageUrl；steps/steps3d/ldrawModelUrl 留空待人工/LLM 补）。
 *   7. （有 --course/--lesson 时，默认）生成「作品墙」幂等迁移 supabase/migrations/<ts>_<slug>_works_project.sql：
 *      建/更新背书项目（打乐高/得宝标签）+ 用 jsonb_set 回填课时 content.building3d.worksProjectId。
 *
 * 注意：steps 教学文案与 LDraw 3D 模型不在本脚本职责内（需 LLM/人工创作 + 建模）。
 *
 * 用法：
 *   node scripts/import-courseware.mjs <课件文件夹> --slug=<slug> [选项]
 *
 * 选项：
 *   --slug=<slug>            必填，输出到 public/courses/<slug>/
 *   --course="课程标题"      可选，写进 manifest 便于入库
 *   --lesson="课时标题"      可选
 *   --slides-dir=<dir>       已有幻灯片图时直接采用（跳过 PPT 转换）
 *   --video-slide=<n>        视频所在课件页码(1 基)；缺省时尝试从 PPT 探测
 *   --dpi=150                PPT 切图分辨率
 *   --no-webp                关闭 WebP 转换（保留 PNG）
 *   --quality=82             WebP 质量
 *   --upload                 暂存后推到 OSS（需 ALIYUN_OSS_* 环境变量）
 *   --absolute               内容里用绝对 CDN URL（--upload 时自动开启）
 *   --base-url=<url>         覆盖 NEXT_PUBLIC_ASSETS_BASE_URL
 *   --concurrency=16         上传并发
 *   --no-works               不生成「作品墙」背书项目迁移
 *   --works-tags=乐高,得宝   背书项目标签（逗号分隔，默认 乐高,得宝,大颗粒,积木,作品展示）
 *   --works-title="我的XX"   背书项目标题（默认「我的<课时标题>」）
 *   --build-slides-from-source  优先尝试从 PPT 自动重建 slides（先生成到临时目录，成功后替换旧 slide-*）
 *   --dry-run                只打印计划，不写文件/不上传
 *
 * 例：
 *   node scripts/import-courseware.mjs "/mnt/c/Users/Administrator/Documents/3+课件100/3+埃菲尔铁塔" \
 *        --slug=eiffel-tower --course="小小积木工程师：学前大颗粒启蒙" --lesson="埃菲尔铁塔" --upload
 */

import { spawnSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    statSync,
    copyFileSync,
    rmSync,
    readFileSync,
    writeFileSync,
} from "node:fs";
import { join, resolve, extname, basename, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── 参数解析 ──────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = new Map();
const positional = [];
for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) flags.set(m[1], m[2] === undefined ? "true" : m[2]);
    else positional.push(a);
}
const flag = (k, d) => (flags.has(k) ? flags.get(k) : d);
const bool = (k) => flags.get(k) === "true" || flags.get(k) === "";

const sourceArg = positional[0];
const slug = flag("slug");
if (!sourceArg || !slug) {
    console.error("用法: node scripts/import-courseware.mjs <课件文件夹> --slug=<slug> [选项]");
    console.error("（详见脚本头部注释）");
    process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    console.error(`--slug 只能是小写字母/数字/连字符：${slug}`);
    process.exit(1);
}

const sourceDir = resolve(sourceArg);
const outDir = resolve(ROOT, "public/courses", slug);
const slidesOutDir = join(outDir, "slides");
const dpi = Number(flag("dpi", 150)) || 150;
const useWebp = !bool("no-webp");
const quality = Number(flag("quality", 82)) || 82;
const doUpload = bool("upload");
const dryRun = bool("dry-run");
const absolute = doUpload || bool("absolute");
const concurrency = Number(flag("concurrency", 16)) || 16;
const videoSlideOverride = flags.has("video-slide") ? Number(flag("video-slide")) : undefined;
const slidesDir = flag("slides-dir") ? resolve(flag("slides-dir")) : null;
const buildSlidesFromSource = bool("build-slides-from-source");
const makeWorks = !bool("no-works");
const worksTags = (flag("works-tags") || "乐高,得宝,大颗粒,积木,作品展示")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    console.error(`课件文件夹不存在或不是目录：${sourceDir}`);
    process.exit(1);
}

// ── 环境变量（与 db:push / migrate-public-to-oss 一致地从 .env.local 读） ──
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

const baseUrl = (flag("base-url") || process.env.NEXT_PUBLIC_ASSETS_BASE_URL || "").trim().replace(/\/+$/, "");

function which(cmd) {
    const r = spawnSync("bash", ["-lc", `command -v ${cmd} || true`], { encoding: "utf8" });
    return r.stdout.trim();
}

const SLIDE_FILE_RE = /^slide-(\d+)\.(png|jpe?g|webp)$/i;
const CLEAN_SLOT_RE = /^slide-\d+\.(png|jpe?g|webp)$/i;

function getSlideFiles(dir) {
    if (!existsSync(dir)) return [];
    const set = new Set();
    for (const f of readdirSync(dir)) {
        const m = f.match(SLIDE_FILE_RE);
        if (!m) continue;
        set.add(Number(m[1]));
    }
    return [...set].sort((a, b) => a - b);
}

function listSlideFilesWithNames(dir) {
    const nums = getSlideFiles(dir);
    return nums.map((n) => {
        const files = readdirSync(dir).filter((f) => SLIDE_FILE_RE.test(f) && Number(f.match(SLIDE_FILE_RE)[1]) === n);
        return files.find((f) => f.match(SLIDE_FILE_RE)?.[2]?.toLowerCase() === "png") || files[0];
    });
}

function clearSlideArtifacts(targetDir) {
    if (!existsSync(targetDir)) return;
    for (const f of readdirSync(targetDir)) {
        if (CLEAN_SLOT_RE.test(f)) {
            rmSync(join(targetDir, f));
        }
    }
}

function printManualSlideExportGuide(pptxPath) {
    const rawExportHint = join(sourceDir, "slides-export");
    const fromArg = `"${sourceDir}"`;
    console.log("\n❗ PPT 转换未能自动完成：请按下列清单进行人工导出。");
    console.log(`  1) 准备源文件：${pptxPath}`);
    console.log("  2) 在有图形界面的环境（PowerPoint / LibreOffice），把该课件导出为 PNG 全部幻灯片");
    console.log(`  3) 将导出图放到任意目录（建议：${rawExportHint}）并按页命名`);
    console.log("  4) 选择任一方案补齐并重跑 import：");
    console.log(`     - 方案 A：直接指定导出目录`);
    console.log(`       node scripts/import-courseware.mjs ${fromArg} --slug=${slug} --slides-dir=<导出目录>`);
    console.log("     - 方案 B：不改名，先规范化文件名");
    console.log(
        `       node scripts/normalize-slides.mjs <导出目录> ${slidesOutDir} && node scripts/import-courseware.mjs ${fromArg} --slug=${slug}`,
    );
    console.log(`  5) 命令返回后确保 public/courses/${slug}/slides 下是 slide-01.png / slide-02.png ...`);
}

function probeVideoSlideIndex(pptxPath) {
    if (!which("python3")) return undefined;
    const probe = spawnSync(
        "python3",
        [
            "-c",
            `
import sys, zipfile, re
try:
    z=zipfile.ZipFile(sys.argv[1])
except Exception:
    print("")
    raise SystemExit(0)
hits=[]
for n in z.namelist():
    m=re.match(r"ppt/slides/_rels/slide(\\d+)\\.xml\\.rels$", n)
    if not m:
        continue
    data=z.read(n).decode("utf-8","ignore")
    if re.search(r"\\.(mp4|mov|avi|wmv|m4v)", data, re.I) or "video" in data.lower():
        hits.append(int(m.group(1)))
print(",".join(str(x) for x in sorted(set(hits))))
`,
            pptxPath,
        ],
        { encoding: "utf8" },
    );
    const list = (probe.stdout || "").trim();
    if (!list) return undefined;
    return Number(list.split(",")[0]) || undefined;
}

// ── 1) 扫描分类（只看顶层，避免抓到 slides/ 子目录里的图） ──
const VIDEO_EXT = new Set([".mp4", ".mov", ".m4v", ".webm"]);
const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const FINISHED_HINT = /(成品|完成|效果|finished|result|done)/i;
const INSTRUCTION_HINT = /(说明|步骤|手册|instruction|manual|guide|step)/i;

function classify(dir) {
    const found = { pptx: [], video: [], pdf: [], image: [] };
    for (const name of readdirSync(dir)) {
        const abs = join(dir, name);
        let st;
        try {
            st = statSync(abs);
        } catch {
            continue;
        }
        if (!st.isFile()) continue;
        const ext = extname(name).toLowerCase();
        if (ext === ".pptx" || ext === ".ppt") found.pptx.push(abs);
        else if (VIDEO_EXT.has(ext)) found.video.push(abs);
        else if (ext === ".pdf") found.pdf.push(abs);
        else if (IMG_EXT.has(ext)) found.image.push(abs);
    }
    return found;
}
const found = classify(sourceDir);

function pickPreferred(list, hint) {
    if (list.length === 0) return null;
    const hinted = list.find((f) => hint.test(basename(f)));
    return hinted ?? list[0];
}
const pptx = found.pptx[0] ?? null;
const video = found.video[0] ?? null;
const pdf = pickPreferred(found.pdf, INSTRUCTION_HINT);
const finishedImg = pickPreferred(found.image, FINISHED_HINT);

console.log("# 识别结果");
console.log(`  课件 PPT : ${pptx ? basename(pptx) : (slidesDir ? "(用 --slides-dir)" : "—")}`);
console.log(`  视频     : ${video ? basename(video) : "—"}`);
console.log(`  搭建说明 : ${pdf ? basename(pdf) : "—"}`);
console.log(`  成品图   : ${finishedImg ? basename(finishedImg) : "—"}`);
if (found.pptx.length > 1) console.warn(`  ⚠️ 发现多个 PPT，取第一个：${basename(pptx)}`);
if (found.video.length > 1) console.warn(`  ⚠️ 发现多个视频，取第一个：${basename(video)}`);

if (dryRun) {
    console.log(`\n[dry-run] 将输出到 ${outDir}/，slug=${slug}，webp=${useWebp}，upload=${doUpload}`);
    console.log("[dry-run] 不写文件、不上传。去掉 --dry-run 实际执行。");
    process.exit(0);
}

mkdirSync(slidesOutDir, { recursive: true });

// ── 2) 生成/采用幻灯片图 ──
let detectedVideoSlide = videoSlideOverride;
if (detectedVideoSlide === undefined && pptx) {
    detectedVideoSlide = probeVideoSlideIndex(pptx);
}

if (slidesDir) {
    const imgs = readdirSync(slidesDir)
        .filter((f) => IMG_EXT.has(extname(f).toLowerCase()))
        .sort((a, b) => {
            const na = parseInt(a.match(/(\d+)/)?.[1] ?? "0", 10);
            const nb = parseInt(b.match(/(\d+)/)?.[1] ?? "0", 10);
            return na - nb;
        });
    if (imgs.length === 0) {
        console.error(`--slides-dir 里没有图片：${slidesDir}`);
        process.exit(1);
    }
    const width = Math.max(2, String(imgs.length).length);
    imgs.forEach((f, i) => {
        const ext = extname(f).toLowerCase();
        copyFileSync(join(slidesDir, f), join(slidesOutDir, `slide-${String(i + 1).padStart(width, "0")}${ext}`));
    });
    console.log(`\n→ 采用现成幻灯片 ${imgs.length} 张（来自 ${slidesDir}）`);
} else if (pptx) {
    const soffice = which("soffice") || which("libreoffice");
    const pdftoppm = which("pdftoppm");
    const existingSlideFiles = existsSync(slidesOutDir) ? readdirSync(slidesOutDir).filter((f) => CLEAN_SLOT_RE.test(f)) : [];
    const haveExisting = existingSlideFiles.length > 0;
    const isPlaceholderOnly = existingSlideFiles.length === 1;
    const slideBuildDir = buildSlidesFromSource
        ? mkdtempSync(join(tmpdir(), "courseware-slides-build-"))
        : slidesOutDir;
    if (buildSlidesFromSource) {
        mkdirSync(slideBuildDir, { recursive: true });
        if (haveExisting) {
            console.log("\n🧹 检测到 --build-slides-from-source，将新图先生成到临时目录…");
        }
    }

    if (!soffice || !pdftoppm) {
        if (buildSlidesFromSource) {
            rmSync(slideBuildDir, { recursive: true, force: true });
            console.error("\n当前环境缺少 LibreOffice/poppler，自动生成失败。");
            if (isPlaceholderOnly) {
                console.error("  现在 slides/ 里只检测到 1 张占位图，暂时无法补齐。");
            }
            printManualSlideExportGuide(pptx);
            process.exit(1);
        }
        if (haveExisting) {
            if (isPlaceholderOnly) {
                console.error("\n⚠️ 缺 LibreOffice/poppler，且 slides/ 里目前似乎只有 1 张占位图，导入会缺课件页。");
                printManualSlideExportGuide(pptx);
                process.exit(1);
            } else {
                console.warn("\n⚠️ 缺 LibreOffice/poppler，但 slides/ 已有图，沿用现有。");
            }
        } else {
            console.error("\n缺 LibreOffice/poppler，无法转换 PPT：");
            console.error("  sudo apt install -y libreoffice poppler-utils fonts-noto-cjk fonts-wqy-zenhei");
            process.exit(1);
        }
    } else {
        console.log("\n→ PPT 转逐页图…");
        const r = spawnSync(
            "node",
            [join(ROOT, "scripts/pptx-to-slides.mjs"), pptx, slideBuildDir, `--dpi=${dpi}`],
            { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] },
        );
        process.stdout.write(r.stdout || "");
        let useExistingSlidesAfterConversionFailure = false;
        if (r.status !== 0) {
            if (buildSlidesFromSource) {
                rmSync(slideBuildDir, { recursive: true, force: true });
                printManualSlideExportGuide(pptx);
                process.exit(1);
            }
            if (haveExisting && !isPlaceholderOnly) {
                console.warn("\n⚠️ PPT 自动转换失败，但 slides/ 已有图，沿用现有幻灯片。");
                console.warn("   如需强制重建，请在有图形后端的环境下加 --build-slides-from-source 重跑。");
                if (detectedVideoSlide === undefined) {
                    const m = (r.stdout || "").match(/videoSlideIndex=(\d+)/);
                    if (m) detectedVideoSlide = Number(m[1]);
                }
                useExistingSlidesAfterConversionFailure = true;
            } else {
                const existing = isPlaceholderOnly
                    ? "\n  已存在 1 张占位图，不能满足课件页导入：请提供 --slides-dir（PNG 图片）或在有 X11/图形环境下重跑。"
                    : "\n  建议先在有图形环境/WSL 下重跑脚本。";
                console.error(`PPT 转换失败。${existing}`);
                process.exit(1);
            }
        }
        if (!useExistingSlidesAfterConversionFailure) {
            if (buildSlidesFromSource) {
                clearSlideArtifacts(slidesOutDir);
                for (const f of readdirSync(slideBuildDir)) {
                    if (!CLEAN_SLOT_RE.test(f)) continue;
                    copyFileSync(join(slideBuildDir, f), join(slidesOutDir, f));
                }
                rmSync(slideBuildDir, { recursive: true, force: true });
            }
            if (detectedVideoSlide === undefined) {
                const m = (r.stdout || "").match(/videoSlideIndex=(\d+)/);
                if (m) detectedVideoSlide = Number(m[1]);
            }
        }
    }
} else {
    console.warn("\n⚠️ 没有 PPT 也没有 --slides-dir，课件页将为空。");
}

// ── 3) 幻灯片图转 WebP ──
let slideExt = "png";
let slideFiles = listSlideFilesWithNames(slidesOutDir);
if (slideFiles.length > 0) {
    const first = slideFiles[0]?.toLowerCase();
    if (first && first.endsWith(".webp")) {
        slideExt = "webp";
    }
}

if (useWebp && slideFiles.length > 0) {
    const rasterSlideFiles = slideFiles.filter((f) => /\.(png|jpe?g)$/i.test(f));
    if (rasterSlideFiles.length === 0) {
        console.warn("→ 该目录暂无 PNG slide，已是 WebP 输出，直接复用。");
        slideExt = "webp";
    } else {
        let sharp = null;
        try {
            sharp = (await import("sharp")).default;
        } catch {
            console.warn("→ 未找到 sharp，跳过 WebP，保留 PNG。");
        }
        if (sharp) {
            console.log(`→ 转 WebP（q=${quality}）…`);
            let before = 0;
            let after = 0;
            for (const f of rasterSlideFiles) {
                const src = join(slidesOutDir, f);
                const dst = src.replace(/\.(png|jpe?g)$/i, ".webp");
                before += statSync(src).size;
                await sharp(src).webp({ quality }).toFile(dst);
                after += statSync(dst).size;
                rmSync(src);
            }
            slideExt = "webp";
            slideFiles = slideFiles.map((f) => f.replace(/\.(png|jpe?g)$/i, ".webp"));
            const pct = before ? Math.round((1 - after / before) * 100) : 0;
            console.log(`  图片 ${(before / 1e6).toFixed(1)}MB → WebP ${(after / 1e6).toFixed(1)}MB（省 ${pct}%）`);
        }
    }
}

// ── 4) 视频 / PDF / 成品图归一化拷贝 ──
const assets = {};
if (video) {
    const ext = extname(video).toLowerCase();
    const name = `animation${ext === ".mp4" ? ".mp4" : ext}`;
    copyFileSync(video, join(outDir, name));
    assets.video = name;
}
if (pdf) {
    copyFileSync(pdf, join(outDir, "instructions.pdf"));
    assets.pdf = "instructions.pdf";
}
if (finishedImg) {
    const ext = extname(finishedImg).toLowerCase();
    if (useWebp) {
        try {
            const sharp = (await import("sharp")).default;
            await sharp(finishedImg).webp({ quality }).toFile(join(outDir, "finished.webp"));
            assets.finished = "finished.webp";
        } catch {
            copyFileSync(finishedImg, join(outDir, `finished${ext}`));
            assets.finished = `finished${ext}`;
        }
    } else {
        copyFileSync(finishedImg, join(outDir, `finished${ext}`));
        assets.finished = `finished${ext}`;
    }
}

// ── 5) 可选上传 OSS ──
if (doUpload) {
    if (!baseUrl) {
        console.error("--upload 需要 NEXT_PUBLIC_ASSETS_BASE_URL（或 --base-url）来生成线上 URL。");
        process.exit(1);
    }
    console.log("\n→ 上传到 OSS…");
    const oss = await import(join(ROOT, "lib/utils/oss-client.mjs"));
    const client = oss.createOssClient();
    await oss.uploadDirectory(client, {
        localDir: outDir,
        publicPathPrefix: `courses/${slug}`,
        concurrency,
    });
}

// ── 6) 产出 building3d 内容草稿 ──
const urlBase = absolute && baseUrl ? `${baseUrl}/courses/${slug}` : `/courses/${slug}`;
const slideImageUrls = slideFiles.map((f) => `${urlBase}/slides/${f}`);

const building3d = {
    ldrawModelUrl: `/courses/ldraw/${slug}.mpd`,
    ldrawColorUrl: "/courses/ldraw/LDConfig.ldr",
    attribution:
        "积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。课件素材版权归原作者所有。",
    ...(assets.video ? { videoUrl: `${urlBase}/${assets.video}` } : {}),
    ...(detectedVideoSlide ? { videoSlideIndex: detectedVideoSlide } : {}),
    ...(slideImageUrls.length ? { slideImageUrls } : {}),
    ...(assets.pdf ? { slidesPdfUrl: `${urlBase}/${assets.pdf}` } : {}),
    ...(assets.finished ? { finishedImageUrl: `${urlBase}/${assets.finished}` } : {}),
    parts: [],
    steps3d: [],
};

const manifest = {
    slug,
    courseTitle: flag("course") ?? null,
    lessonTitle: flag("lesson") ?? null,
    lessonType: "building_3d",
    durationMinutes: 40,
    source: sourceDir,
    generatedAt: new Date().toISOString(),
    assets: {
        slides: slideFiles.length,
        slideExt,
        ...assets,
        uploaded: doUpload,
    },
    // ↓↓↓ 待人工/LLM 补：搭建步骤文案 + steps3d 分步显隐 + LDraw 模型 ↓↓↓
    steps: [],
    content: {
        summary: flag("lesson") ? `${flag("lesson")}：跟着课件与图纸分步搭建。` : "",
        building3d,
    },
    _todo: [
        "撰写 steps（标题/描述/hint/checklist）与 building3d.steps3d（分步 partIds/cameraHint）",
        "用搭建说明做 LDraw 模型并放到 scripts/ldraw-models/<slug>.ldr，再 pack-ldraw-model.mjs 打包",
        "确认 videoSlideIndex 是否正确（动画所在课件页）",
        "用幂等 upsert 把 content 写入课程（不要每课写一条 migration）",
        "先让课时内容入库，再 db:push 自动生成的 *_works_project.sql（建作品墙 + 回填 worksProjectId）",
    ],
};

const manifestDir = join(ROOT, "scripts/courseware");
mkdirSync(manifestDir, { recursive: true });
const manifestPath = join(manifestDir, `${slug}.json`);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

// ── 7) 生成「作品墙」背书项目迁移（步骤 5 自动化） ──
const courseTitle = flag("course");
const lessonTitle = flag("lesson");
let worksMigrationPath = null;
if (makeWorks && courseTitle && lessonTitle) {
    const sqlLit = (s) => String(s).replace(/'/g, "''");
    const worksTitle = flag("works-title") || `我的${lessonTitle}`;
    const coverUrl = assets.finished ? `${urlBase}/${assets.finished}` : `/courses/${slug}/finished.png`;
    const description = `跟着「${courseTitle}」课程搭出你的${lessonTitle}后，拍下作品上传到这里，和小伙伴们比一比谁搭得更好！欢迎写下你搭建时的小发现或遇到的难题。`;
    const tagsSql = `ARRAY[${worksTags.map((t) => `'${sqlLit(t)}'`).join(", ")}]`;

    const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14); // YYYYMMDDHHMMSS
    const migName = `${ts}_${slug.replace(/-/g, "_")}_works_project.sql`;
    const sql = `-- 自动生成：${slug} 课时「作品墙」背书项目（import-courseware.mjs 步骤 5）。
-- 课程教学留在课程，作品上传复用项目侧能力：建背书项目当作品墙，并把它写回课时 worksProjectId。
-- 幂等：项目按标题查重；课时字段用 jsonb_set 合并。注意先让课时内容入库，再 db:push 本迁移。

DO $$
DECLARE
    v_author_id UUID;
    v_category_id INT;
    v_sub_id INT;
    v_project_id BIGINT;
    v_project_title TEXT := '${sqlLit(worksTitle)}';
BEGIN
    SELECT id INTO v_author_id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1;
    IF v_author_id IS NULL THEN
        SELECT id INTO v_author_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;
    END IF;
    IF v_author_id IS NULL THEN
        RAISE NOTICE '跳过：profiles 表暂无用户，无法创建背书项目';
        RETURN;
    END IF;

    SELECT id INTO v_category_id FROM public.categories WHERE name = '工程' LIMIT 1;
    IF v_category_id IS NULL THEN
        RAISE EXCEPTION '找不到分类: 工程';
    END IF;
    SELECT id INTO v_sub_id FROM public.sub_categories
     WHERE category_id = v_category_id AND name = '模型制作' LIMIT 1;
    IF v_sub_id IS NULL THEN
        RAISE EXCEPTION '找不到子分类: 模型制作';
    END IF;

    SELECT id INTO v_project_id FROM public.projects WHERE title = v_project_title LIMIT 1;

    IF v_project_id IS NULL THEN
        INSERT INTO public.projects (
            title, description, author_id, image_url,
            category, sub_category_id, difficulty, difficulty_stars,
            status, steam_weights, tags
        ) VALUES (
            v_project_title,
            '${sqlLit(description)}',
            v_author_id,
            '${sqlLit(coverUrl)}',
            '工程',
            v_sub_id,
            'easy',
            2,
            'approved',
            '{"S":5,"T":5,"E":40,"A":20,"M":10}'::jsonb,
            ${tagsSql}
        )
        RETURNING id INTO v_project_id;
    ELSE
        UPDATE public.projects
           SET description = '${sqlLit(description)}',
               image_url = '${sqlLit(coverUrl)}',
               category = '工程',
               sub_category_id = v_sub_id,
               status = 'approved',
               tags = ${tagsSql},
               updated_at = NOW()
         WHERE id = v_project_id;
    END IF;

    UPDATE public.course_lessons AS l
       SET content = jsonb_set(l.content, '{building3d,worksProjectId}', to_jsonb(v_project_id), true)
      FROM public.courses AS c
     WHERE l.course_id = c.id
       AND c.title = '${sqlLit(courseTitle)}'
       AND l.title = '${sqlLit(lessonTitle)}';

    RAISE NOTICE '作品墙项目 id=% 已就绪并写回课时「${sqlLit(lessonTitle)}」', v_project_id;
END $$;
`;
    worksMigrationPath = join(ROOT, "supabase/migrations", migName);
    writeFileSync(worksMigrationPath, sql, "utf8");
} else if (makeWorks) {
    console.warn("\n⚠️ 未提供 --course/--lesson，跳过作品墙迁移生成（无法回填 worksProjectId）。");
}

console.log("\n✅ 资源管线完成");
console.log(`   素材目录：public/courses/${slug}/（slides ${slideFiles.length} 张 .${slideExt}）`);
console.log(`   内容草稿：scripts/courseware/${slug}.json`);
if (worksMigrationPath) {
    console.log(`   作品墙迁移：supabase/migrations/${basename(worksMigrationPath)}（建背书项目 + 回填 worksProjectId）`);
}
if (detectedVideoSlide) console.log(`   视频页：第 ${detectedVideoSlide} 页`);
console.log("\n下一步（脚本搞不定，需创作）：");
console.log("   1) 补 steps / steps3d 教学文案（可让 LLM 读 PDF 起草，人审）");
console.log("   2) 按搭建说明做 LDraw 模型 → scripts/ldraw-models/" + slug + ".ldr → pack-ldraw-model.mjs");
console.log("   3) 幂等 upsert 入库（迁移只管 schema，内容走 manifest）");
if (worksMigrationPath) {
    console.log("   4) 课时内容入库后，db:push 作品墙迁移（搭完即可上传作品）");
}
