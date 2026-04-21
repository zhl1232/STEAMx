#!/usr/bin/env node
/**
 * Fetch bird images/audio from Wikimedia for species records.
 *
 * Usage:
 *   node scripts/fetch-bird-media-from-wikimedia.mjs
 *   node scripts/fetch-bird-media-from-wikimedia.mjs --source=file --input=birds2.fixed.json
 *   node scripts/fetch-bird-media-from-wikimedia.mjs --limit=20 --force
 *
 * Output:
 *   public/birds/images/<slug>.<ext>
 *   public/birds/audio/<slug>.<ext>
 *   public/birds/media-manifest.json
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "public", "birds");
const IMAGE_DIR = path.join(OUTPUT_DIR, "images");
const AUDIO_DIR = path.join(OUTPUT_DIR, "audio");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "media-manifest.json");

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const INAT_API = "https://api.inaturalist.org/v1";
const XENO_CANTO_API = "https://xeno-canto.org/api/3/recordings";
const DEFAULT_HTTP_HEADERS = {
  "User-Agent": "steam-explore-share-bird-media-bot/1.0 (research script; contact: local-project)",
  Accept: "application/json",
};

const AUDIO_EXTS = new Set([".ogg", ".oga", ".wav", ".flac", ".mp3", ".opus"]);

function parseArgs(argv) {
  const args = {
    source: "db",
    input: null,
    limit: null,
    force: false,
    withImage: true,
    withAudio: true,
    delayMs: 300,
    timeoutMs: 15000,
    maxRetries: 5,
    resume: true,
    imageSource: "wikimedia",
    audioSource: "wikimedia",
  };

  for (const token of argv) {
    if (token.startsWith("--source=")) args.source = token.split("=")[1];
    else if (token.startsWith("--input=")) args.input = token.split("=")[1];
    else if (token.startsWith("--limit=")) args.limit = Number(token.split("=")[1] || 0) || null;
    else if (token === "--force") args.force = true;
    else if (token === "--no-image") args.withImage = false;
    else if (token === "--no-audio") args.withAudio = false;
    else if (token.startsWith("--delay-ms=")) args.delayMs = Number(token.split("=")[1] || 300) || 300;
    else if (token.startsWith("--timeout-ms=")) args.timeoutMs = Number(token.split("=")[1] || 15000) || 15000;
    else if (token.startsWith("--max-retries=")) args.maxRetries = Number(token.split("=")[1] || 5) || 5;
    else if (token === "--no-resume") args.resume = false;
    else if (token.startsWith("--image-source=")) args.imageSource = token.split("=")[1];
    else if (token.startsWith("--audio-source=")) args.audioSource = token.split("=")[1];
    else if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!["db", "file"].includes(args.source)) {
    throw new Error(`Unsupported --source: ${args.source}`);
  }
  if (!["wikimedia", "inaturalist"].includes(args.imageSource)) {
    throw new Error(`Unsupported --image-source: ${args.imageSource}`);
  }
  if (!["wikimedia", "xenocanto"].includes(args.audioSource)) {
    throw new Error(`Unsupported --audio-source: ${args.audioSource}`);
  }
  return args;
}

function printHelp() {
  console.log(`Wikimedia bird media fetcher

Options:
  --source=db|file       Data source (default: db)
  --input=<path>         Source json path when --source=file
  --limit=<n>            Only process first n species
  --force                Re-download even if local files exist
  --no-image             Skip image downloading
  --no-audio             Skip audio downloading
  --delay-ms=<ms>        Delay between species (default: 300)
  --timeout-ms=<ms>      HTTP timeout per request (default: 15000)
  --max-retries=<n>      Retries per request (default: 5)
  --no-resume            Do not reuse existing manifest progress
  --image-source=<name>  wikimedia | inaturalist
  --audio-source=<name>  wikimedia | xenocanto
  --help                 Show help
`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  try {
    const content = await fs.readFile(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ignore missing .env.local
  }
}

async function fetchJson(url, options = {}) {
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? 15000;
  let lastErr = null;
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        headers: DEFAULT_HTTP_HEADERS,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.status === 429) {
        const retryAfterHeader = Number(resp.headers.get("retry-after") || 0);
        const retryAfterMs =
          Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
            ? retryAfterHeader * 1000
            : 12000 * (i + 1);
        lastErr = new Error(`HTTP 429: ${await resp.text()}`);
        if (i < retries - 1) {
          await sleep(retryAfterMs + Math.floor(Math.random() * 500));
          continue;
        }
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
      return await resp.json();
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      const jitter = Math.floor(Math.random() * 300);
      await sleep(700 * (i + 1) + jitter);
    }
  }
  throw lastErr;
}

async function postJson(url, body, headers = {}, options = {}) {
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? 15000;
  let lastErr = null;
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { ...DEFAULT_HTTP_HEADERS, "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.status === 429) {
        const retryAfterHeader = Number(resp.headers.get("retry-after") || 0);
        const retryAfterMs =
          Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
            ? retryAfterHeader * 1000
            : 12000 * (i + 1);
        lastErr = new Error(`HTTP 429: ${await resp.text()}`);
        if (i < retries - 1) {
          await sleep(retryAfterMs + Math.floor(Math.random() * 500));
          continue;
        }
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
      return await resp.json();
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      const jitter = Math.floor(Math.random() * 300);
      await sleep(900 * (i + 1) + jitter);
    }
  }
  throw lastErr;
}

async function loadSpeciesFromDb(requestOptions) {
  await loadEnvLocal();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const data = await postJson(
    `${supabaseUrl}/pg/query`,
    {
      query: `
        SELECT slug, common_name, scientific_name
        FROM public.species
        WHERE is_active = TRUE
        ORDER BY id;
      `,
    },
    {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    requestOptions
  );
  return (data || []).filter((row) => row.slug && row.scientific_name);
}

async function loadSpeciesFromFile(inputPath) {
  if (!inputPath) throw new Error("--source=file requires --input=<path>");
  const abs = path.isAbsolute(inputPath) ? inputPath : path.join(ROOT, inputPath);
  const content = await fs.readFile(abs, "utf8");
  const data = JSON.parse(content);
  if (!Array.isArray(data)) {
    throw new Error(`Input json is not an array: ${abs}`);
  }
  return data.filter((row) => row.slug && row.scientific_name);
}

async function searchWikidataEntity(scientificName, requestOptions) {
  const url = `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(
    scientificName
  )}&language=en&type=item&limit=5&format=json&origin=*`;
  const data = await fetchJson(url, requestOptions);
  const list = data?.search || [];
  if (!list.length) return null;

  const exact = list.find((it) => {
    const label = (it.label || "").toLowerCase();
    return label === scientificName.toLowerCase();
  });
  return exact || list[0];
}

async function getWikidataEntity(qid, requestOptions) {
  const url = `${WIKIDATA_API}?action=wbgetentities&ids=${encodeURIComponent(
    qid
  )}&props=claims|labels&format=json&origin=*`;
  const data = await fetchJson(url, requestOptions);
  return data?.entities?.[qid] || null;
}

function getClaimMediaFileName(entity, property) {
  const claim = entity?.claims?.[property]?.[0];
  const value = claim?.mainsnak?.datavalue?.value;
  return typeof value === "string" ? value : null;
}

async function searchCommonsAudio(scientificName, requestOptions) {
  const queries = [
    `${scientificName} bird call filetype:ogg`,
    `${scientificName} bird song filetype:ogg`,
    `${scientificName} filetype:ogg`,
  ];

  for (const q of queries) {
    const url = `${COMMONS_API}?action=query&list=search&srnamespace=6&srlimit=8&format=json&origin=*&srsearch=${encodeURIComponent(
      q
    )}`;
    const data = await fetchJson(url, requestOptions);
    const hits = data?.query?.search || [];
    const fileHit = hits.find((h) => {
      const title = h.title || "";
      const ext = path.extname(title).toLowerCase();
      return AUDIO_EXTS.has(ext);
    });
    if (fileHit) return fileHit.title.replace(/^File:/i, "");
  }
  return null;
}

async function getInaturalistImage(scientificName, requestOptions) {
  const url = `${INAT_API}/taxa?q=${encodeURIComponent(scientificName)}&rank=species&per_page=3`;
  const data = await fetchJson(url, requestOptions);
  const list = data?.results || [];
  const exact =
    list.find((x) => String(x.name || "").toLowerCase() === scientificName.toLowerCase()) || list[0];
  if (!exact) return null;

  const photo = exact.default_photo;
  if (!photo?.medium_url) return null;

  const direct = photo.medium_url.replace("/medium.", "/original.");
  return {
    source: direct,
    mime: "image/jpeg",
    license: photo.license_code || null,
    licenseUrl: null,
    artist: photo.attribution_name || null,
    credit: photo.attribution || null,
    fileName: `iNaturalist-${photo.id || exact.id}.jpg`,
  };
}

function toAbsoluteUrl(urlLike) {
  if (!urlLike) return null;
  if (urlLike.startsWith("//")) return `https:${urlLike}`;
  if (urlLike.startsWith("http://") || urlLike.startsWith("https://")) return urlLike;
  return null;
}

async function getXenoCantoAudio(scientificName, requestOptions) {
  const key = process.env.XENO_CANTO_API_KEY;
  if (!key) {
    throw new Error("Missing XENO_CANTO_API_KEY for --audio-source=xenocanto");
  }

  const parts = String(scientificName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) return null;
  const genus = parts[0];
  const species = parts[1];
  const query = `gen:${genus} sp:${species}`;
  const url = `${XENO_CANTO_API}?query=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}&page=1`;
  const data = await fetchJson(url, requestOptions);
  const list = data?.recordings || [];
  if (!list.length) return null;

  const first = list.find((r) => toAbsoluteUrl(r.file)) || list[0];
  const source = toAbsoluteUrl(first.file);
  if (!source) return null;

  const ext = path.extname(source).toLowerCase();
  const mime = ext === ".mp3" ? "audio/mpeg" : ext === ".wav" ? "audio/wav" : "audio/ogg";
  const licenseUrl = first.lic || null;
  let license = null;
  if (licenseUrl?.includes("by-nc-sa")) license = "CC BY-NC-SA";
  else if (licenseUrl?.includes("by-sa")) license = "CC BY-SA";
  else if (licenseUrl?.includes("by-nc")) license = "CC BY-NC";
  else if (licenseUrl?.includes("by")) license = "CC BY";

  return {
    source,
    mime,
    license,
    licenseUrl,
    artist: first.rec || null,
    credit: first.cnt ? `${first.cnt} · xeno-canto` : "xeno-canto",
    fileName: first["file-name"] || path.basename(source),
  };
}

async function getCommonsFileInfo(fileName, requestOptions) {
  const title = `File:${fileName}`;
  const url = `${COMMONS_API}?action=query&titles=${encodeURIComponent(
    title
  )}&prop=imageinfo&iiprop=url|mime|size|extmetadata&format=json&origin=*`;
  const data = await fetchJson(url, requestOptions);
  const pages = data?.query?.pages || {};
  const first = pages[Object.keys(pages)[0]];
  const info = first?.imageinfo?.[0];
  if (!info) return null;

  const md = info.extmetadata || {};
  return {
    title,
    fileName,
    directUrl: info.url || null,
    mime: info.mime || null,
    size: info.size || null,
    license: md.LicenseShortName?.value || null,
    licenseUrl: md.LicenseUrl?.value || null,
    artist: md.Artist?.value || null,
    credit: md.Credit?.value || null,
  };
}

function extFromMime(mime) {
  if (!mime) return null;
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/tiff") return ".tif";
  if (mime === "audio/ogg") return ".ogg";
  if (mime === "audio/mpeg") return ".mp3";
  if (mime === "audio/wav" || mime === "audio/x-wav") return ".wav";
  if (mime === "audio/flac") return ".flac";
  if (mime === "audio/opus") return ".opus";
  return null;
}

async function downloadFile(url, outputPath, requestOptions = {}) {
  const timeoutMs = requestOptions.timeoutMs ?? 15000;
  const retries = requestOptions.retries ?? 5;

  let lastErr = null;
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { headers: DEFAULT_HTTP_HEADERS, signal: controller.signal });
      clearTimeout(timeout);

      if (resp.status === 429) {
        const retryAfterHeader = Number(resp.headers.get("retry-after") || 0);
        const retryAfterMs =
          Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
            ? retryAfterHeader * 1000
            : 12000 * (i + 1);
        lastErr = new Error(`Download rate limited: HTTP 429`);
        if (i < retries - 1) {
          await sleep(retryAfterMs + Math.floor(Math.random() * 500));
          continue;
        }
      }

      if (!resp.ok) {
        throw new Error(`Download failed: HTTP ${resp.status}`);
      }

      const arrayBuffer = await resp.arrayBuffer();
      await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
      return;
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      if (i < retries - 1) {
        await sleep(1000 * (i + 1) + Math.floor(Math.random() * 500));
      }
    }
  }
  throw lastErr;
}

function escapeHtml(input) {
  return String(input || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchMediaForSpecies(species, options) {
  const result = {
    slug: species.slug,
    commonName: species.common_name || null,
    scientificName: species.scientific_name,
    wikidataQid: null,
    image: { status: "skipped", file: null, source: null, meta: null, error: null },
    audio: { status: "skipped", file: null, source: null, meta: null, error: null },
  };

  const requestOptions = { retries: options.maxRetries, timeoutMs: options.timeoutMs };
  const needsWikidata =
    (options.withAudio && options.audioSource === "wikimedia") ||
    (options.withImage && options.imageSource === "wikimedia");
  let entity = null;

  if (needsWikidata) {
    const searchHit = await searchWikidataEntity(species.scientific_name, requestOptions);
    if (!searchHit) {
      const err = "No Wikidata entity matched";
      if (options.withImage && options.imageSource === "wikimedia") {
        result.image = { ...result.image, status: "error", error: err };
      }
      if (options.withAudio) result.audio = { ...result.audio, status: "error", error: err };
      return result;
    }
    result.wikidataQid = searchHit.id;
    entity = await getWikidataEntity(searchHit.id, requestOptions);
  }

  if (options.withImage) {
    try {
      let info = null;
      if (options.imageSource === "inaturalist") {
        info = await getInaturalistImage(species.scientific_name, requestOptions);
      } else {
        const imageFile = getClaimMediaFileName(entity, "P18");
        if (imageFile) info = await getCommonsFileInfo(imageFile, requestOptions);
      }

      if (!info?.source && !info?.directUrl) {
        result.image = { ...result.image, status: "not_found" };
      } else {
        const imageUrl = info.directUrl || info.source;
        const ext = extFromMime(info.mime) || path.extname(info.fileName || "").toLowerCase() || ".jpg";
        const outName = `${species.slug}${ext}`;
        const outPath = path.join(IMAGE_DIR, outName);
        const exists = await fs
          .access(outPath)
          .then(() => true)
          .catch(() => false);
        if (!exists || options.force) {
          await downloadFile(imageUrl, outPath, requestOptions);
          result.image.status = "downloaded";
        } else {
          result.image.status = "exists";
        }
        result.image.file = path.relative(ROOT, outPath).replaceAll(path.sep, "/");
        result.image.source = imageUrl;
        result.image.meta = {
          mime: info.mime,
          license: info.license,
          licenseUrl: info.licenseUrl,
          artist: escapeHtml(info.artist),
          credit: escapeHtml(info.credit),
          fileName: info.fileName,
        };
      }
    } catch (err) {
      result.image = { ...result.image, status: "error", error: String(err.message || err) };
    }
  }

  if (options.withAudio) {
    try {
      if (options.audioSource === "xenocanto") {
        const info = await getXenoCantoAudio(species.scientific_name, requestOptions);
        if (!info?.source) {
          result.audio = { ...result.audio, status: "not_found" };
        } else {
          const ext = extFromMime(info.mime) || path.extname(info.fileName || "").toLowerCase() || ".mp3";
          const outName = `${species.slug}${ext}`;
          const outPath = path.join(AUDIO_DIR, outName);
          const exists = await fs
            .access(outPath)
            .then(() => true)
            .catch(() => false);
          if (!exists || options.force) {
            await downloadFile(info.source, outPath, requestOptions);
            result.audio.status = "downloaded";
          } else {
            result.audio.status = "exists";
          }
          result.audio.file = path.relative(ROOT, outPath).replaceAll(path.sep, "/");
          result.audio.source = info.source;
          result.audio.meta = {
            mime: info.mime,
            license: info.license,
            licenseUrl: info.licenseUrl,
            artist: escapeHtml(info.artist),
            credit: escapeHtml(info.credit),
            fileName: info.fileName,
          };
        }
      } else {
        let audioFile = getClaimMediaFileName(entity, "P443") || getClaimMediaFileName(entity, "P51");
        if (!audioFile) {
          audioFile = await searchCommonsAudio(species.scientific_name, requestOptions);
        }

        if (!audioFile) {
          result.audio = { ...result.audio, status: "not_found" };
        } else {
          const info = await getCommonsFileInfo(audioFile, requestOptions);
          if (!info?.directUrl) {
            result.audio = { ...result.audio, status: "error", error: "Audio metadata unavailable" };
          } else {
            const ext = extFromMime(info.mime) || path.extname(audioFile).toLowerCase() || ".ogg";
            const outName = `${species.slug}${ext}`;
            const outPath = path.join(AUDIO_DIR, outName);
            const exists = await fs
              .access(outPath)
              .then(() => true)
              .catch(() => false);
            if (!exists || options.force) {
              await downloadFile(info.directUrl, outPath, requestOptions);
              result.audio.status = "downloaded";
            } else {
              result.audio.status = "exists";
            }
            result.audio.file = path.relative(ROOT, outPath).replaceAll(path.sep, "/");
            result.audio.source = info.directUrl;
            result.audio.meta = {
              mime: info.mime,
              license: info.license,
              licenseUrl: info.licenseUrl,
              artist: escapeHtml(info.artist),
              credit: escapeHtml(info.credit),
              fileName: info.fileName,
            };
          }
        }
      }
    } catch (err) {
      result.audio = { ...result.audio, status: "error", error: String(err.message || err) };
    }
  }

  return result;
}

function summarize(results) {
  const summary = {
    total: results.length,
    image: { downloaded: 0, exists: 0, not_found: 0, error: 0, skipped: 0 },
    audio: { downloaded: 0, exists: 0, not_found: 0, error: 0, skipped: 0 },
  };
  for (const item of results) {
    summary.image[item.image.status] = (summary.image[item.image.status] || 0) + 1;
    summary.audio[item.audio.status] = (summary.audio[item.audio.status] || 0) + 1;
  }
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  await ensureDir(OUTPUT_DIR);
  await ensureDir(IMAGE_DIR);
  await ensureDir(AUDIO_DIR);

  const requestOptions = { retries: args.maxRetries, timeoutMs: args.timeoutMs };
  const species =
    args.source === "db" ? await loadSpeciesFromDb(requestOptions) : await loadSpeciesFromFile(args.input);
  const list = args.limit ? species.slice(0, args.limit) : species;

  let previousManifest = null;
  if (args.resume) {
    previousManifest = await fs
      .readFile(MANIFEST_PATH, "utf8")
      .then((s) => JSON.parse(s))
      .catch(() => null);
  }
  const previousBySlug = new Map((previousManifest?.results || []).map((r) => [r.slug, r]));

  console.log(`Species loaded: ${species.length}`);
  console.log(`Processing: ${list.length}`);
  console.log(
    `Image: ${args.withImage ? `on(${args.imageSource})` : "off"} | Audio: ${
      args.withAudio ? `on(${args.audioSource})` : "off"
    }`
  );

  const resultsBySlug = new Map((previousManifest?.results || []).map((r) => [r.slug, r]));
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const previous = previousBySlug.get(item.slug);
    const imageDone =
      !args.withImage ||
      (previous && ["downloaded", "exists", "not_found"].includes(previous.image?.status));
    const audioDone =
      !args.withAudio ||
      (previous && ["downloaded", "exists", "not_found"].includes(previous.audio?.status));

    process.stdout.write(`[${i + 1}/${list.length}] ${item.slug} (${item.scientific_name}) ... `);

    if (!args.force && args.resume && imageDone && audioDone) {
      resultsBySlug.set(item.slug, previous);
      console.log("skipped(resume)");
      continue;
    }

    try {
      const row = await fetchMediaForSpecies(item, args);
      resultsBySlug.set(item.slug, row);
      const imageStatus = row.image.status;
      const audioStatus = row.audio.status;
      console.log(`image=${imageStatus}, audio=${audioStatus}`);
    } catch (err) {
      console.log(`error=${String(err.message || err)}`);
      resultsBySlug.set(item.slug, {
        slug: item.slug,
        commonName: item.common_name || null,
        scientificName: item.scientific_name,
        wikidataQid: null,
        image: { status: "error", file: null, source: null, meta: null, error: String(err.message || err) },
        audio: { status: "error", file: null, source: null, meta: null, error: String(err.message || err) },
      });
    }

    const partialResults = list
      .map((s) => resultsBySlug.get(s.slug))
      .filter(Boolean);
    const partialPayload = {
      generatedAt: new Date().toISOString(),
      source: args.source,
      totalSpecies: list.length,
      summary: summarize(partialResults),
      results: partialResults,
    };
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(partialPayload, null, 2), "utf8");

    if (i < list.length - 1) await sleep(args.delayMs);
  }

  const results = list
    .map((s) => resultsBySlug.get(s.slug))
    .filter(Boolean);
  const payload = {
    generatedAt: new Date().toISOString(),
    source: args.source,
    totalSpecies: list.length,
    summary: summarize(results),
    results,
  };
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(payload, null, 2), "utf8");

  console.log(`\nManifest written: ${path.relative(ROOT, MANIFEST_PATH)}`);
  console.log(JSON.stringify(payload.summary, null, 2));
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message || err}`);
  process.exit(1);
});
