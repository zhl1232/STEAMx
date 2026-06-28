#!/usr/bin/env node
// PPTX → 逐页 PNG 导出工具：把授课 PPT 转成「课件翻页器」用的 slide-01.png … slide-NN.png。
//
// 管线：LibreOffice(soffice) 把 .pptx 渲染成 PDF（最忠实），再用 poppler 的 pdftoppm
// 把 PDF 每页栅格成 PNG，最后按页码规范命名拷到课时目录。顺带探测内嵌视频在第几页，
// 提示你在迁移里设置 building3d.videoSlideIndex。
//
// 前置依赖（一次性，标准 apt 包）：
//   sudo apt update && sudo apt install -y libreoffice poppler-utils fonts-noto-cjk fonts-wqy-zenhei
//   （fonts-* 中文字体必装，否则 LibreOffice 会把中文渲染成「□」豆腐块）
//
// 用法：
//   node scripts/pptx-to-slides.mjs <input.pptx> [输出目录] [--dpi=150]
// 例：
//   node scripts/pptx-to-slides.mjs public/courses/eiffel-tower/slides.pptx \
//        public/courses/eiffel-tower/slides --dpi=150

import { spawnSync } from "node:child_process";
import {
    mkdirSync,
    mkdtempSync,
    readdirSync,
    copyFileSync,
    rmSync,
    existsSync,
    statSync,
} from "node:fs";
import { join, resolve, extname, basename } from "node:path";
import { tmpdir } from "node:os";

const args = process.argv.slice(2);
const flags = new Map();
const positional = [];
for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) flags.set(m[1], m[2]);
    else if (a.startsWith("--")) flags.set(a.slice(2), "true");
    else positional.push(a);
}

const [inputArg, outArg] = positional;
if (!inputArg) {
    console.error("用法: node scripts/pptx-to-slides.mjs <input.pptx> [输出目录=public/courses/eiffel-tower/slides] [--dpi=150]");
    process.exit(1);
}

const inputPath = resolve(inputArg);
const outDir = resolve(outArg ?? "public/courses/eiffel-tower/slides");
const dpi = Number(flags.get("dpi") ?? 150) || 150;

if (!existsSync(inputPath)) {
    console.error(`找不到输入文件: ${inputPath}`);
    process.exit(1);
}

function which(cmd) {
    const r = spawnSync("bash", ["-lc", `command -v ${cmd} || true`], { encoding: "utf8" });
    return r.stdout.trim();
}

const soffice = which("soffice") || which("libreoffice");
const pdftoppm = which("pdftoppm");

if (!soffice || !pdftoppm) {
    console.error("缺少必要工具：");
    if (!soffice) console.error("  - LibreOffice (soffice)");
    if (!pdftoppm) console.error("  - poppler-utils (pdftoppm)");
    console.error("\n安装（Debian/Ubuntu/WSL）：");
    console.error("  sudo apt update && sudo apt install -y libreoffice poppler-utils fonts-noto-cjk fonts-wqy-zenhei");
    console.error("\nmacOS（Homebrew）：");
    console.error("  brew install --cask libreoffice && brew install poppler");
    process.exit(1);
}

// 预警：LibreOffice 无头渲染缺中文字体时，中文文本框会变成「□□□」豆腐块。
const fcList = which("fc-list");
if (fcList) {
    const zh = spawnSync("bash", ["-lc", "fc-list :lang=zh | head -1"], { encoding: "utf8" });
    if (!zh.stdout.trim()) {
        console.warn("⚠️ 未检测到中文字体——LibreOffice 会把 PPT 里的中文渲染成「□」豆腐块！");
        console.warn("   先安装中文字体再导出：sudo apt install -y fonts-noto-cjk fonts-wqy-zenhei");
        console.warn("   （已装则忽略本提示，继续导出）\n");
    }
}

const tmp = mkdtempSync(join(tmpdir(), "pptx2slides-"));

function makeSofficeEnv(workingDir) {
    const homeDir = join(workingDir, "home");
    const configDir = join(homeDir, ".config");
    const cacheDir = join(homeDir, ".cache");
    const runtimeDir = join(workingDir, "runtime");

    mkdirSync(homeDir, { recursive: true });
    mkdirSync(configDir, { recursive: true });
    mkdirSync(cacheDir, { recursive: true });
    mkdirSync(runtimeDir, { recursive: true });

    return {
        ...process.env,
        HOME: homeDir,
        XDG_CONFIG_HOME: configDir,
        XDG_CACHE_HOME: cacheDir,
        XDG_RUNTIME_DIR: runtimeDir,
    };
}
try {
    // 1) pptx -> pdf（独立 profile 目录，避免与已开的 LibreOffice 实例冲突）
    console.log("→ LibreOffice 转换 PDF 中…");
    const sofficeArgs = [
        `-env:UserInstallation=file://${join(tmp, "lo-profile")}`,
        "--headless",
        "--norestore",
        "--convert-to",
        "pdf",
        "--outdir",
        tmp,
        inputPath,
    ];

    const altArgs = [
        "--headless",
        "--nologo",
        "--nocrashreport",
        "--norestore",
        "--nolockcheck",
        "-env:UserInstallation=file://" + join(tmp, "lo-profile"),
        "--convert-to",
        "pdf",
        "--outdir",
        tmp,
        inputPath,
    ];

    const tryConvert = (args, label) => {
        const proc = spawnSync(soffice, args, {
            encoding: "utf8",
            env: makeSofficeEnv(tmp),
            timeout: 120000,
            maxBuffer: 10 * 1024 * 1024,
        });
        if (proc.status !== 0) {
            console.warn(`  ${label} 失败（status=${proc.status}）：`);
            if (proc.stdout) console.warn(`  stdout: ${proc.stdout.trim()}`);
            if (proc.stderr) console.warn(`  stderr: ${proc.stderr.trim()}`);
            return false;
        }
        return true;
    };

    let converted = tryConvert(sofficeArgs, "主路径");
    if (!converted) {
        converted = tryConvert(altArgs, "备选路径");
    }

    if (!converted) {
        console.error(
            "LibreOffice 转换失败：当前环境缺少可用显示/图形后端，无法在该环境直接完成 pptx 转 pdf。",
        );
        console.error(
            "建议：在有图形桌面的环境执行（或用 WSL/容器补装 Xvfb）。\n"
            + "可临时用：Xvfb -screen 0 1280x720x24 :99 &，然后 DISPLAY=:99 node scripts/pptx-to-slides.mjs ...",
        );
        process.exit(1);
    }
    const pdfName = basename(inputPath, extname(inputPath)) + ".pdf";
    let pdfPath = join(tmp, pdfName);
    if (!existsSync(pdfPath)) {
        const anyPdf = readdirSync(tmp).find((f) => f.toLowerCase().endsWith(".pdf"));
        if (!anyPdf) {
            console.error("未生成 PDF，转换可能失败。");
            process.exit(1);
        }
        pdfPath = join(tmp, anyPdf);
    }

    // 2) pdf -> 每页 png
    console.log(`→ pdftoppm 切页中（${dpi} DPI）…`);
    const rasterPrefix = join(tmp, "page");
    const rast = spawnSync(pdftoppm, ["-png", "-r", String(dpi), pdfPath, rasterPrefix], {
        encoding: "utf8",
    });
    if (rast.status !== 0) {
        console.error("pdftoppm 切页失败：\n" + (rast.stderr || rast.stdout));
        process.exit(1);
    }

    // 3) 自然排序后规范命名 slide-01.png …
    const pages = readdirSync(tmp)
        .filter((f) => /^page-?\d+\.png$/i.test(f))
        .sort((a, b) => {
            const na = parseInt(a.match(/(\d+)/)[1], 10);
            const nb = parseInt(b.match(/(\d+)/)[1], 10);
            return na - nb;
        });
    if (pages.length === 0) {
        console.error("没有生成任何页图片。");
        process.exit(1);
    }

    mkdirSync(outDir, { recursive: true });
    const width = Math.max(2, String(pages.length).length);
    const pad = (n) => String(n).padStart(width, "0");
    pages.forEach((p, i) => {
        copyFileSync(join(tmp, p), join(outDir, `slide-${pad(i + 1)}.png`));
    });
    console.log(`✅ 导出 ${pages.length} 页到 ${outDir}（slide-${pad(1)}.png … slide-${pad(pages.length)}.png）`);

    // 4) 探测内嵌视频在第几页（best-effort，需要 python3）
    if (which("python3")) {
        const probe = spawnSync(
            "python3",
            [
                "-c",
                `
import sys, zipfile, re
z=zipfile.ZipFile(sys.argv[1])
def slide_no(n):
    m=re.search(r"slide(\\d+)\\.xml", n)
    return int(m.group(1)) if m else 0
hits=[]
for n in z.namelist():
    m=re.match(r"ppt/slides/_rels/slide(\\d+)\\.xml\\.rels$", n)
    if m:
        data=z.read(n).decode("utf-8","ignore")
        if re.search(r"\\.(mp4|mov|avi|wmv|m4v)", data, re.I) or "video" in data.lower():
            hits.append(int(m.group(1)))
print(",".join(str(x) for x in sorted(set(hits))))
`,
                inputPath,
            ],
            { encoding: "utf8" },
        );
        const list = (probe.stdout || "").trim();
        if (list) {
            console.log(`🎬 检测到内嵌视频的幻灯片页：第 ${list} 页 → 在迁移里设 building3d.videoSlideIndex=${list.split(",")[0]}`);
        } else {
            console.log("ℹ️ 未检测到内嵌视频（或无法解析），如有动画请手动确认 videoSlideIndex。");
        }
    }

} finally {
    rmSync(tmp, { recursive: true, force: true });
}
