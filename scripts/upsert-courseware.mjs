#!/usr/bin/env node
/**
 * 批量课件最小可上线（跳过 LDraw）：prepare JSON → 补传 OSS → 幂等 upsert 入库。
 *
 * 用法:
 *   node scripts/upsert-courseware.mjs --prepare              # 改 JSON：OSS 绝对 URL、占位 steps、去 LDraw
 *   node scripts/upsert-courseware.mjs --upload-assets        # 补传 PDF/视频/成品图（slides 已有则 skip）
 *   node scripts/upsert-courseware.mjs                        # 写入小/中/大班 3 门课 + 300 课时
 *   node scripts/upsert-courseware.mjs --dry-run              # 预览，不写库
 *   node scripts/upsert-courseware.mjs --only=3-bao-jian      # 只处理指定 slug
 *
 * 环境变量（.env.local）：NEXT_PUBLIC_ASSETS_BASE_URL、ALIYUN_OSS_*、
 *   NEXT_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { convertCourseImagesToWebp, rewriteCourseImageUrlToWebp } from "./lib/course-image-webp.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const COURSEWARE_DIR = join(ROOT, "scripts/courseware");
const PUBLIC_COURSES = join(ROOT, "public/courses");
const LDRAW_DIR = join(PUBLIC_COURSES, "ldraw");

const argv = process.argv.slice(2);
const flags = new Map();
for (const token of argv) {
  const m = token.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags.set(m[1], m[2] === undefined ? "true" : m[2]);
}
const flag = (name, fallback) => (flags.has(name) ? flags.get(name) : fallback);
const bool = (name) => flags.get(name) === "true" || flags.get(name) === "";
const dryRun = bool("dry-run");
const doPrepare = bool("prepare");
const doUpload = bool("upload-assets");
const doUpsert = !doPrepare && !doUpload && !bool("help") && !bool("h");
const onlyMatchers = (flag("only", "") || "")
  .split(",")
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);

const COURSE_META = {
  "3+课件100": {
    title: "小班大颗粒积木",
    sort_order: 30,
    difficulty_stars: 2,
    tags: ["乐高", "得宝", "大颗粒积木", "3+"],
    description:
      "适合 3 岁以上的大颗粒积木创意搭建课：100 个主题，结合课件、动画与分步引导，边学边搭完成作品。",
    gradePrefix: "3-",
  },
  "4+课件100": {
    title: "中班大颗粒积木",
    sort_order: 31,
    difficulty_stars: 3,
    tags: ["乐高", "得宝", "大颗粒积木", "4+"],
    description:
      "适合 4 岁以上的大颗粒积木创意搭建课：100 个主题，结合课件、动画与分步引导，边学边搭完成作品。",
    gradePrefix: "4-",
  },
  "5+课件100": {
    title: "大班大颗粒积木",
    sort_order: 32,
    difficulty_stars: 4,
    tags: ["乐高", "得宝", "大颗粒积木", "5+"],
    description:
      "适合 5 岁以上的大颗粒积木创意搭建课：100 个主题，结合课件、动画与分步引导，边学边搭完成作品。",
    gradePrefix: "5-",
  },
};

const SKIP_SLUGS = new Set(["eiffel-tower"]);

function loadEnv() {
  for (const filename of [".env.local", ".env"]) {
    const envPath = join(ROOT, filename);
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

function getAssetsBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_ASSETS_BASE_URL?.trim().replace(/\/+$/, "");
  if (!raw) throw new Error("缺少 NEXT_PUBLIC_ASSETS_BASE_URL");
  return raw;
}

function escapeSqlLiteral(str) {
  return String(str).replace(/'/g, "''");
}

function sqlJsonb(value) {
  const json = JSON.stringify(value);
  let tag = "j";
  while (json.includes(`$${tag}$`)) tag += "x";
  return `$${tag}$${json}$${tag}$::jsonb`;
}

function listManifests() {
  return readdirSync(COURSEWARE_DIR)
    .filter((f) => f.endsWith(".json") && f !== "batch-slide-export-report.json")
    .map((f) => {
      const path = join(COURSEWARE_DIR, f);
      const json = JSON.parse(readFileSync(path, "utf8"));
      return { path, json, slug: json.slug || f.replace(/\.json$/, "") };
    })
    .filter(({ slug, json }) => {
      if (SKIP_SLUGS.has(slug)) return false;
      if (!json.courseTitle || !COURSE_META[json.courseTitle]) return false;
      if (onlyMatchers.length === 0) return true;
      const hay = [slug, json.lessonTitle, json.courseTitle].join("\n").toLowerCase();
      return onlyMatchers.some((m) => hay.includes(m));
    })
    .sort((a, b) => a.slug.localeCompare(b.slug, "zh-CN"));
}

function findPptx(sourceDir) {
  if (!sourceDir || !existsSync(sourceDir)) return null;
  const hit = readdirSync(sourceDir).find(
    (name) => /\.pptx?$/i.test(name) && !name.startsWith("~$"),
  );
  return hit ? join(sourceDir, hit) : null;
}

function detectVideoSlideIndex(pptxPath) {
  if (!pptxPath || !existsSync(pptxPath)) return null;
  const probe = spawnSync(
    "python3",
    [
      "-c",
      `
import sys, zipfile, re
z=zipfile.ZipFile(sys.argv[1])
hits=[]
for n in z.namelist():
    m=re.match(r"ppt/slides/_rels/slide(\\d+)\\.xml\\.rels$", n)
    if m:
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
  if (!list) return null;
  const first = Number(list.split(",")[0]);
  return Number.isFinite(first) && first > 0 ? first : null;
}

function toAbsoluteUrl(url, assetsBase) {
  if (!url || typeof url !== "string") return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/courses/")) return `${assetsBase}${url}`;
  return url;
}

function hasLocalFile(slug, filename) {
  return existsSync(join(PUBLIC_COURSES, slug, filename));
}

function hasLdrawModel(slug) {
  return existsSync(join(LDRAW_DIR, `${slug}.mpd`));
}

function buildPlaceholderSteps(slideCount, lessonTitle) {
  if (slideCount <= 0) {
    return [
      {
        title: "跟着搭建说明完成",
        description: `阅读搭建说明 PDF，完成 ${lessonTitle} 的搭建。`,
        hint: "对照成品图检查结构是否稳固。",
        checklist: ["对照 PDF 逐步完成", "和成品图一致"],
      },
    ];
  }
  const steps = [];
  for (let i = 1; i <= slideCount; i++) {
    const isLast = i === slideCount;
    steps.push({
      title: isLast ? "完成！" : `课件第 ${i} 页`,
      description: isLast
        ? `${lessonTitle} 搭建完成，对照成品图检查一遍。`
        : `打开课件第 ${i} 页，阅读讲解并按图纸继续搭建。`,
      hint: "可对照搭建说明 PDF 与课件动画。",
      checklist: isLast ? ["和成品图一致", "结构稳固"] : [`完成第 ${i} 页内容`],
    });
  }
  return steps;
}

function buildPlaceholderSteps3d(steps) {
  return steps.map((step) => ({
    title: step.title,
    description: step.description,
    partIds: [],
    cameraHint: "isometric",
  }));
}

function prepareManifest(manifest, assetsBase) {
  const slug = manifest.slug;
  const lessonTitle = manifest.lessonTitle || slug;
  const b3d = manifest.content?.building3d || {};
  const slideUrls = Array.isArray(b3d.slideImageUrls) ? b3d.slideImageUrls : [];
  const slideCount = slideUrls.length;

  const urlBase = `${assetsBase}/courses/${slug}`;
  const slideImageUrls = slideUrls.map((u) => {
    const name = u.split("/slides/")[1] || u.split("/").pop();
    return rewriteCourseImageUrlToWebp(`${urlBase}/slides/${name}`);
  });

  const building3d = {
    attribution:
      b3d.attribution ||
      "积木模型基于 LDraw 零件库（CC BY 4.0 / CCAL 2.0）。LDraw™ 由 James Jessiman 创建。课件素材版权归原作者所有。",
    ...(slideImageUrls.length ? { slideImageUrls } : {}),
    ...(hasLocalFile(slug, "instructions.pdf")
      ? { slidesPdfUrl: `${urlBase}/instructions.pdf` }
      : {}),
    ...(hasLocalFile(slug, "finished.webp")
        ? { finishedImageUrl: `${urlBase}/finished.webp` }
      : hasLocalFile(slug, "finished.png")
        ? { finishedImageUrl: `${urlBase}/finished.png` }
        : {}),
  };

  if (hasLocalFile(slug, "animation.mp4")) {
    building3d.videoUrl = `${urlBase}/animation.mp4`;
    const pptx = findPptx(manifest.source);
    const videoSlide = detectVideoSlideIndex(pptx);
    if (videoSlide) building3d.videoSlideIndex = videoSlide;
  }

  if (hasLdrawModel(slug)) {
    building3d.ldrawModelUrl = `${assetsBase}/courses/ldraw/${slug}.mpd`;
    building3d.ldrawColorUrl = `${assetsBase}/courses/ldraw/LDConfig.ldr`;
  }

  building3d.parts = [];
  building3d.steps3d = [];

  const steps = buildPlaceholderSteps(slideCount, lessonTitle);
  building3d.steps3d = buildPlaceholderSteps3d(steps);

  manifest.generatedAt = new Date().toISOString();
  manifest.assets = {
    ...(manifest.assets || {}),
    slides: slideCount,
    slideExt: slideImageUrls.length ? "webp" : (manifest.assets?.slideExt || "png"),
    ...(hasLocalFile(slug, "instructions.pdf") ? { pdf: "instructions.pdf" } : {}),
    ...(hasLocalFile(slug, "finished.webp")
      ? { finished: "finished.webp" }
      : hasLocalFile(slug, "finished.png")
        ? { finished: "finished.png" }
        : {}),
    ...(hasLocalFile(slug, "animation.mp4") ? { video: "animation.mp4" } : {}),
    uploaded: true,
    mvp: true,
  };
  manifest.steps = steps;
  manifest.content = {
    summary: manifest.content?.summary || `${lessonTitle}：跟着课件与图纸分步搭建。`,
    building3d,
  };
  manifest._todo = [
    "（MVP 已上线）后续补：精细 steps 文案、LDraw 模型、steps3d/partIds、worksProjectId",
  ];
  return manifest;
}

async function execSQL(sql) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");

  const resp = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  if (data && !Array.isArray(data) && data.error) throw new Error(data.error);
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item?.error) throw new Error(item.error);
    }
  }
  return data;
}

function upsertLessonSql(courseTitle, lesson, sortOrder, assetsBase) {
  const meta = COURSE_META[courseTitle];
  const displayTitle = meta.title;
  const b3d = lesson.content.building3d;
  const coverForCourse = b3d.finishedImageUrl || `${assetsBase}/courses/${lesson.slug}/finished.png`;
  const stepsSql = sqlJsonb(lesson.steps);
  const contentSql = sqlJsonb(lesson.content);

  return `
DO $$
DECLARE
  v_course_id bigint;
  v_lesson_id bigint;
BEGIN
  SELECT id INTO v_course_id
    FROM public.courses
   WHERE title IN (
     '${escapeSqlLiteral(courseTitle)}',
     '${escapeSqlLiteral(displayTitle)}'
   )
   ORDER BY CASE WHEN title = '${escapeSqlLiteral(displayTitle)}' THEN 0 ELSE 1 END
   LIMIT 1;
  IF v_course_id IS NULL THEN
    INSERT INTO public.courses (
      title, description, image_url, tags, difficulty_stars, status, sort_order, steam_weights
    ) VALUES (
      '${escapeSqlLiteral(displayTitle)}',
      '${escapeSqlLiteral(meta.description)}',
      '${escapeSqlLiteral(coverForCourse)}',
      ARRAY[${meta.tags.map((t) => `'${escapeSqlLiteral(t)}'`).join(", ")}],
      ${meta.difficulty_stars},
      'approved',
      ${meta.sort_order},
      '{"S":5,"T":15,"E":35,"A":25,"M":20}'::jsonb
    )
    RETURNING id INTO v_course_id;
  ELSE
    UPDATE public.courses
       SET title = '${escapeSqlLiteral(displayTitle)}',
           description = '${escapeSqlLiteral(meta.description)}',
           tags = ARRAY[${meta.tags.map((t) => `'${escapeSqlLiteral(t)}'`).join(", ")}],
           difficulty_stars = ${meta.difficulty_stars},
           status = 'approved',
           sort_order = ${meta.sort_order},
           updated_at = NOW()
     WHERE id = v_course_id;
  END IF;

  SELECT id INTO v_lesson_id
    FROM public.course_lessons
   WHERE course_id = v_course_id
     AND title = '${escapeSqlLiteral(lesson.lessonTitle)}'
   LIMIT 1;

  IF v_lesson_id IS NULL THEN
    INSERT INTO public.course_lessons (
      course_id, title, lesson_type, sort_order, duration_minutes, steps, resources, content
    ) VALUES (
      v_course_id,
      '${escapeSqlLiteral(lesson.lessonTitle)}',
      'building_3d',
      ${sortOrder},
      ${lesson.durationMinutes || 40},
      ${stepsSql},
      '[]'::jsonb,
      ${contentSql}
    );
  ELSE
    UPDATE public.course_lessons
       SET lesson_type = 'building_3d',
           sort_order = ${sortOrder},
           duration_minutes = ${lesson.durationMinutes || 40},
           steps = ${stepsSql},
           resources = '[]'::jsonb,
           content = ${contentSql},
           updated_at = NOW()
     WHERE id = v_lesson_id;
  END IF;
END $$;
`;
}

async function runPrepare(manifests, assetsBase) {
  let videoDetected = 0;
  let noVideo = 0;
  for (const { path, json } of manifests) {
    const prepared = prepareManifest(structuredClone(json), assetsBase);
    if (prepared.content.building3d.videoSlideIndex) videoDetected += 1;
    else if (prepared.content.building3d.videoUrl) noVideo += 1;
    writeFileSync(path, `${JSON.stringify(prepared, null, 2)}\n`, "utf8");
  }
  console.log(`✓ prepare ${manifests.length} manifests`);
  console.log(`  videoSlideIndex detected: ${videoDetected}, video without index: ${noVideo}`);
}

const EXTRA_ASSETS = ["instructions.pdf", "animation.mp4", "finished.png", "finished.webp"];

async function runUpload(manifests) {
  const oss = await import(join(ROOT, "lib/utils/oss-client.mjs"));
  const client = oss.createOssClient();
  let uploaded = 0;
  let skipped = 0;

  for (const { slug } of manifests) {
    const localDir = join(PUBLIC_COURSES, slug);
    if (!existsSync(localDir)) {
      console.warn(`  skip upload (no dir): ${slug}`);
      continue;
    }

    await convertCourseImagesToWebp(localDir, { recursive: false });

    const files = EXTRA_ASSETS.filter((name) => existsSync(join(localDir, name)));
    if (files.length === 0) continue;

    let slugUploaded = 0;
    for (const name of files) {
      const objectKey = `courses/${slug}/${name}`;
      try {
        await client.head(objectKey);
        skipped += 1;
        continue;
      } catch (err) {
        if (err?.code !== "NoSuchKey") throw err;
      }

      const localPath = join(localDir, name);
      const headers = { "Cache-Control": "public, max-age=31536000, immutable" };
      const ext = name.slice(name.lastIndexOf("."));
      const types = {
        ".pdf": "application/pdf",
        ".mp4": "video/mp4",
        ".png": "image/png",
        ".webp": "image/webp",
      };
      if (types[ext]) headers["Content-Type"] = types[ext];

      await client.put(objectKey, localPath, { headers, timeout: 300_000 });
      uploaded += 1;
      slugUploaded += 1;
    }

    if (slugUploaded > 0) {
      console.log(`→ ${slug}: uploaded ${slugUploaded} file(s)`);
    }
  }

  console.log(`✓ upload done · new=${uploaded} skipped(existing)=${skipped} · ${manifests.length} lessons scanned`);
}

async function runUpsert(manifests, assetsBase) {
  const byCourse = new Map();
  for (const { json } of manifests) {
    const list = byCourse.get(json.courseTitle) || [];
    list.push(json);
    byCourse.set(json.courseTitle, list);
  }

  let done = 0;
  for (const [courseTitle, lessons] of byCourse) {
    lessons.sort((a, b) => a.slug.localeCompare(b.slug, "zh-CN"));
    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      const sql = upsertLessonSql(courseTitle, lesson, i + 1, assetsBase);
      if (dryRun) {
        console.log(`[dry-run] ${courseTitle} / ${lesson.lessonTitle} (#${i + 1})`);
      } else {
        await execSQL(sql);
        done += 1;
        if (done % 20 === 0) console.log(`  upserted ${done}/${manifests.length}`);
      }
    }
  }
  if (!dryRun) console.log(`✓ upserted ${done} lessons into ${byCourse.size} courses`);
}

function printUsage() {
  console.log(`用法:
  node scripts/upsert-courseware.mjs --prepare
  node scripts/upsert-courseware.mjs --upload-assets
  node scripts/upsert-courseware.mjs [--dry-run] [--only=slug]`);
}

async function main() {
  if (bool("help") || bool("h")) {
    printUsage();
    return;
  }

  loadEnv();
  const manifests = listManifests();
  if (manifests.length === 0) {
    console.error("没有匹配的课件 JSON");
    process.exit(1);
  }

  const assetsBase = getAssetsBaseUrl();
  console.log(`courseware MVP · ${manifests.length} lessons · assets=${assetsBase}`);

  if (doPrepare) {
    await runPrepare(manifests, assetsBase);
    return;
  }

  if (doUpload) {
    await runUpload(manifests);
    return;
  }

  if (doUpsert) {
    const unprepared = manifests.filter(({ json }) => !json.assets?.mvp);
    if (unprepared.length > 0) {
      console.log(`→ auto-prepare ${unprepared.length} manifests first`);
      await runPrepare(
        unprepared.map(({ path, json }) => ({ path, json: structuredClone(json) })),
        assetsBase,
      );
      for (const item of manifests) {
        item.json = JSON.parse(readFileSync(item.path, "utf8"));
      }
    }
    await runUpsert(manifests, assetsBase);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
