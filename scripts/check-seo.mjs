#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Small, read-only production SEO smoke checker. Node 22 built-ins only. */

const DEFAULT_BASE_URL = "https://steam.bj.cn";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 1;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const CORE_PATHS = ["/robots.txt", "/sitemap.xml", "/", "/courses", "/learn/blocks", "/learn/scratch", "/learn/science"];
const USER_AGENTS = ["Googlebot", "Baiduspider", "bingbot"];

function cleanBase(value) {
  const url = new URL(value || DEFAULT_BASE_URL);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  if (!/^https?:$/.test(url.protocol)) throw new Error("base URL must use http or https");
  return url;
}

function add(report, severity, message, url) {
  report[severity].push(url ? { message, url } : { message });
}

function contentType(response) {
  return (response.headers.get("content-type") || "").toLowerCase();
}

async function readBody(response, maxBytes = MAX_BODY_BYTES) {
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("response body exceeds configured limit");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

async function request(url, options = {}) {
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const read = options.readBody !== false;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await (options.fetchImpl || fetch)(url, { signal: controller.signal, redirect: "follow" });
      if (response.status >= 500 && attempt < retries) {
        await response.body?.cancel();
        throw new Error(`transient HTTP ${response.status}`);
      }
      const body = read ? await readBody(response) : undefined;
      clearTimeout(timer);
      return { response, body };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
    }
  }
  throw lastError || new Error("request failed");
}

function decodeXml(value) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function decodeHtml(value) { return decodeXml(value).replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16))); }

function isCanonicalCourseSelection(url) {
  return url.pathname === "/courses" && /^\?course=[1-9]\d*$/.test(url.search) && Number.isSafeInteger(Number(url.searchParams.get("course")));
}

function parseSitemap(xml, base, report) {
  if (!/<urlset\b[^>]*[\s>]/i.test(xml) || !/<\/urlset>/i.test(xml)) {
    add(report, "errors", "sitemap is not a complete <urlset>");
    return [];
  }
  const locations = [...xml.matchAll(/<loc\b[^>]*>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => decodeXml(m[1].trim()));
  if (!locations.length) add(report, "errors", "sitemap has no URLs");
  const uniqueUrls = new Set();
  for (const location of locations) {
    try {
      const url = new URL(location);
      if (url.origin !== base.origin || url.protocol !== base.protocol || url.hash || (url.search && !isCanonicalCourseSelection(url))) {
        add(report, "errors", "sitemap URL is not an absolute canonical same-origin URL", location);
      } else if (/^\/courses\/[^/]+\/?$/.test(url.pathname)) {
        add(report, "errors", "sitemap contains a retired course overview URL", location);
      } else uniqueUrls.add(url.href);
    } catch {
      add(report, "errors", "sitemap contains an invalid URL", location);
    }
  }
  const urls = [...uniqueUrls];
  const paths = new Set(urls.map((value) => { const url = new URL(value); return url.pathname + url.search; }));
  for (const path of ["/", "/courses", "/learn/blocks", "/learn/scratch", "/learn/science"]) {
    if (!paths.has(path)) add(report, "errors", `sitemap is missing required topic ${path}`);
  }
  const dynamic = {
    project: urls.filter((value) => /^\/project\/[^/]+\/?$/.test(new URL(value).pathname)),
    course: urls.filter((value) => isCanonicalCourseSelection(new URL(value))),
    lesson: urls.filter((value) => /^\/courses\/[^/]+\/lessons\/[^/]+\/?$/.test(new URL(value).pathname)),
  };
  for (const [kind, values] of Object.entries(dynamic)) {
    if (!values.length) add(report, "errors", `sitemap has no dynamic ${kind} URL`);
  }
  report.counters.sitemapUrls = urls.length;
  const core = CORE_PATHS.filter((path) => !["/robots.txt", "/sitemap.xml"].includes(path)).map((path) => new URL(path, base).href);
  const samples = [dynamic.project[0], dynamic.course[0], dynamic.lesson[0]].filter(Boolean);
  return [...new Set([...core, ...samples])];
}

function metaContent(html, name) {
  const match = html.match(new RegExp(`<meta\\b[^>]*\\b(?:name|property)=["']${name}["'][^>]*\\bcontent=["']([^"']*)["']`, "i")) || html.match(new RegExp(`<meta\\b[^>]*\\bcontent=["']([^"']*)["'][^>]*\\b(?:name|property)=["']${name}["']`, "i"));
  return decodeHtml(match?.[1]?.trim() || "");
}

function stripInvisible(html) {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");
}

function stripTags(html) { return decodeHtml(stripInvisible(html).replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim()); }

function parseRobots(text) {
  const groups = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^user-agent$/i.test(key)) {
      if (!current || current.rules.length) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
    } else if (/^(allow|disallow)$/i.test(key) && current) current.rules.push({ allow: /^allow$/i.test(key), path: value });
  }
  return groups;
}

function robotsPattern(pattern, target) {
  const end = pattern.endsWith("$");
  const source = (end ? pattern.slice(0, -1) : pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${source}${end ? "$" : ""}`).test(target);
}

function robotsAllowed(text, pathname, agent) {
  const groups = parseRobots(text);
  const matching = groups.filter((group) => group.agents.includes(agent.toLowerCase()) || group.agents.includes("*"));
  if (!matching.length) return true;
  const specific = matching.filter((group) => group.agents.includes(agent.toLowerCase()));
  const rules = (specific.length ? specific : matching).flatMap((group) => group.rules).filter((rule) => rule.path && robotsPattern(rule.path, pathname));
  if (!rules.length) return true;
  const score = (rule) => rule.path.replace(/\*/g, "").replace(/\$$/, "").length;
  const best = rules.reduce((a, b) => score(b) > score(a) || (score(b) === score(a) && b.allow && !a.allow) ? b : a);
  return best.allow;
}

async function inspectHtml(url, response, body, report, imageUrls) {
  if (response.status !== 200) { add(report, "errors", `expected HTTP 200, got ${response.status}`, url); return; }
  if (!contentType(response).includes("text/html")) { add(report, "errors", "response is not HTML", url); return; }
  if (/\/(?:login|sign-in)(?:[/?]|$)/i.test(new URL(response.url).pathname)) add(report, "errors", "page redirected to login", url);
  const html = body;
  const title = (html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  if (!title.includes("创探空间")) add(report, "errors", "title does not contain 创探空间", url);
  if (!metaContent(html, "description")) add(report, "errors", "missing meta description", url);
  const canonical = decodeHtml(html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i)?.[1] || html.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["']/i)?.[1] || "");
  if (canonical !== url) add(report, "errors", "canonical does not exactly match requested URL", url);
  if (/\b(?:noindex|none)\b/i.test(metaContent(html, "robots")) || /\b(?:noindex|none)\b/i.test(response.headers.get("x-robots-tag") || "")) add(report, "errors", "page is marked noindex/none", url);
  const visible = stripTags(html);
  if (!visible.includes("创探空间")) add(report, "warnings", "page text has no visible brand text", url);
  const h1Count = (stripInvisible(html).match(/<h1\b[^>]*>/gi) || []).length;
  if (!h1Count) add(report, "errors", "page must have at least one h1", url);
  else if (h1Count > 1) add(report, "warnings", "page has multiple h1 elements; CSS visibility cannot be proven from HTML", url);
  for (const block of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(block[1].trim()); } catch { add(report, "errors", "malformed JSON-LD", url); }
  }
  const image = metaContent(html, "og:image");
  if (!image) add(report, "errors", "missing og:image", url);
  else { try { const parsed = new URL(image, url); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); imageUrls.add(parsed.href); } catch { add(report, "errors", "og:image is not an HTTP(S) URL", url); } }
}

export async function runSeoChecks(options = {}) {
  const base = cleanBase(options.baseUrl || DEFAULT_BASE_URL);
  const report = { tool: "check-seo", version: "1.0.0", timestamp: new Date().toISOString(), baseUrl: base.href, errors: [], warnings: [], findings: [], counters: { requests: 0, sitemapUrls: 0, imageUrls: 0 }, caveats: ["Checks use bounded GET requests and inspect response headers/HTML without crawling or logging response bodies.", "Robots matching implements standard wildcard/end-marker paths, longest match, and Allow ties; named UA groups take precedence over *."] };
  const fetchImpl = options.fetchImpl || fetch;
  const get = async (url, { allowRedirect = false, ...requestOptions } = {}) => {
    report.counters.requests += 1;
    const result = await request(url, { ...options, ...requestOptions, fetchImpl });
    if (result.response.url !== url.href) {
      add(report, allowRedirect ? "warnings" : "errors", "request redirected to a different final URL", url.href);
    }
    return result;
  };
  let robots = "";
  let sitemap = "";
  try { const result = await get(new URL("/robots.txt", base)); const { response, body } = result; if (response.status !== 200) add(report, "errors", `robots.txt expected HTTP 200, got ${response.status}`, response.url); else { if (contentType(response).includes("html")) add(report, "errors", "robots.txt returned HTML"); robots = body; if (![...robots.matchAll(/^sitemap:\s*(\S+)/gim)].some((match) => { try { return new URL(match[1]).href === new URL("/sitemap.xml", base).href; } catch { return false; } })) add(report, "errors", "robots.txt has no matching Sitemap directive"); } } catch { add(report, "errors", "robots.txt unavailable or timed out"); }
  try { const result = await get(new URL("/sitemap.xml", base)); const { response, body } = result; if (response.status !== 200) add(report, "errors", `sitemap expected HTTP 200, got ${response.status}`, response.url); else sitemap = body; } catch { add(report, "errors", "sitemap unavailable or timed out"); }
  const htmlUrls = sitemap ? parseSitemap(sitemap, base, report) : CORE_PATHS.filter((path) => !["/robots.txt", "/sitemap.xml"].includes(path)).map((path) => new URL(path, base).href);
  const imageUrls = new Set();
  for (const url of htmlUrls) {
    try { const result = await get(new URL(url)); await inspectHtml(url, result.response, result.body, report, imageUrls); } catch { add(report, "errors", "HTML route unavailable or timed out", url); }
  }
  report.counters.imageUrls = imageUrls.size;
  const imageRobotUrls = new Set(imageUrls);
  for (const image of imageUrls) {
    try {
      const { response } = await get(new URL(image), { readBody: false, allowRedirect: true });
      imageRobotUrls.add(response.url);
      if (response.status !== 200 || !contentType(response).startsWith("image/")) add(report, "errors", "og:image verification failed", image);
      await response.body?.cancel();
    } catch { add(report, "errors", "og:image unavailable or timed out", image); }
  }
  for (const image of imageRobotUrls) {
    if (new URL(image).origin !== base.origin) add(report, "warnings", "external image robots policy was not checked", image);
  }
  for (const agent of USER_AGENTS) {
    for (const url of htmlUrls) if (robots && !robotsAllowed(robots, new URL(url).pathname + new URL(url).search, agent)) add(report, "errors", `${agent} is blocked from public route`, url);
    for (const image of imageRobotUrls) {
      const parsed = new URL(image);
      if (parsed.origin === base.origin && robots && !robotsAllowed(robots, parsed.pathname + parsed.search, agent)) {
        add(report, "errors", `${agent} is blocked from public image`, image);
      }
    }
    if (robots && robotsAllowed(robots, "/api/private", agent)) add(report, "errors", `${agent} can crawl /api/private`, "/api/private");
  }
  report.findings = [...report.errors, ...report.warnings];
  return report;
}

function printReport(report) { console.info(JSON.stringify(report, null, 2)); }

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2); const allowed = new Set(["--base-url", "--report"]); const values = {};
  let parseError = "";
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!allowed.has(flag)) { parseError = `unknown argument: ${flag}`; break; }
    if (!args[index + 1] || args[index + 1].startsWith("--")) { parseError = `${flag} requires a value`; break; }
    values[flag] = args[++index];
  }
  if (parseError) { console.error(parseError); process.exitCode = 1; }
  else runSeoChecks({ baseUrl: values["--base-url"] || DEFAULT_BASE_URL }).then((result) => { printReport(result); if (values["--report"]) { mkdirSync(dirname(resolve(values["--report"])), { recursive: true }); writeFileSync(values["--report"], JSON.stringify(result, null, 2)); } process.exitCode = result.errors.length ? 1 : 0; }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
