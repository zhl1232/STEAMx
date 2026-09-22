#!/usr/bin/env node

/**
 * 将规范 URL 主动提交给百度搜索资源平台。
 *
 * 默认模式（高价值小批量，≤10 条）：推送站点首页与核心栏目，不扫全量 sitemap。
 * 全量 sitemap 推送需显式开启其一：
 *   BAIDU_PUSH_MODE=sitemap
 *   BAIDU_PUSH_ALL=1
 *
 * 用法：
 *   BAIDU_PUSH_TOKEN=... pnpm seo:baidu-push
 *   BAIDU_PUSH_TOKEN=... BAIDU_PUSH_MODE=sitemap pnpm seo:baidu-push
 *   BAIDU_PUSH_DRY_RUN=1 pnpm seo:baidu-push   # 只打印将提交的 URL，不调用接口
 *
 * 百度主动推送接口目前使用官方的 HTTP endpoint；不要把 token 写入仓库或日志。
 * 未配置 token 时安全跳过（dry-run 除外），方便本地开发和没有百度站长平台权限的环境继续发布。
 * 每次成功响应后会尊重 remain：remain 为 0 则停止；下一批大于 remain 时先截断再 POST。
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SITE = "https://steam.bj.cn";
const DEFAULT_PUSH_ENDPOINT = "http://data.zz.baidu.com/urls";
const DEFAULT_CHUNK_SIZE = 10;

/** 默认高价值 URL（与 docs/seo-indexing-checklist.md 对齐，保持 ≤10） */
const HIGH_VALUE_URLS = [
  "https://steam.bj.cn/",
  "https://steam.bj.cn/about",
  "https://steam.bj.cn/courses",
  "https://steam.bj.cn/explore",
  "https://steam.bj.cn/nature",
  "https://steam.bj.cn/nature/birds",
  "https://steam.bj.cn/nature/insects",
  "https://steam.bj.cn/nature/plants",
  "https://steam.bj.cn/playground",
];

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isSitemapMode() {
  const mode = (process.env.BAIDU_PUSH_MODE || "").trim().toLowerCase();
  if (mode === "sitemap" || mode === "all") return true;
  const all = (process.env.BAIDU_PUSH_ALL || "").trim();
  return all === "1" || all.toLowerCase() === "true" || all.toLowerCase() === "yes";
}

function isDryRun() {
  const value = (process.env.BAIDU_PUSH_DRY_RUN || "").trim();
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

function getSite() {
  const site = (process.env.BAIDU_PUSH_SITE || DEFAULT_SITE).trim();
  const url = new URL(site);
  url.pathname = "/";
  url.search = "";
  url.hash = "";

  if (url.protocol !== "https:" || url.hostname !== "steam.bj.cn") {
    throw new Error("BAIDU_PUSH_SITE 必须是 https://steam.bj.cn");
  }

  return url;
}

function parseSitemapLocations(xml, site) {
  const locations = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);

  const unique = [...new Set(locations)];
  for (const location of unique) {
    const url = new URL(location);
    if (url.origin !== site.origin || url.protocol !== "https:" || url.hash) {
      throw new Error(`sitemap 包含非规范站内 URL: ${location}`);
    }
  }

  return unique;
}

async function loadSitemap(site) {
  const sitemapUrl = new URL("/sitemap.xml", site);
  const response = await fetch(sitemapUrl, {
    headers: {
      "user-agent": "STEAMX-BaiduPush/1.0",
      accept: "application/xml,text/xml;q=0.9,*/*;q=0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`读取 sitemap 失败: HTTP ${response.status}`);
  }

  const xml = await response.text();
  const urls = parseSitemapLocations(xml, site);
  if (urls.length === 0) {
    throw new Error("sitemap 没有可提交的 <loc>");
  }

  return urls;
}

function loadHighValueUrls(site) {
  const unique = [...new Set(HIGH_VALUE_URLS)];
  for (const location of unique) {
    const url = new URL(location);
    if (url.origin !== site.origin || url.protocol !== "https:" || url.hash) {
      throw new Error(`高价值列表包含非规范站内 URL: ${location}`);
    }
  }
  return unique;
}

async function resolveUrls(site) {
  if (isSitemapMode()) {
    const urls = await loadSitemap(site);
    console.log(`百度推送模式: sitemap（全量 ${urls.length} 条）`);
    return urls;
  }

  const urls = loadHighValueUrls(site);
  console.log(`百度推送模式: high-value（默认 ${urls.length} 条）`);
  return urls;
}

/**
 * 组装百度主动推送接口 URL。
 * 不可用 URLSearchParams / URL.searchParams：会把 site 编成 https%3A%2F%2F...，
 * 百度接口要求 query 里字面 `site=https://steam.bj.cn`，否则固定 400 site init fail。
 */
export function buildBaiduPushUrl(endpointBase, siteOrigin, token) {
  const base = String(endpointBase || "").trim().replace(/\?.*$/, "").replace(/\/$/, "");
  if (!base) throw new Error("BAIDU_PUSH_ENDPOINT 不能为空");
  if (!siteOrigin || !String(siteOrigin).includes("://")) {
    throw new Error("siteOrigin 必须是带协议的 origin，例如 https://steam.bj.cn");
  }
  if (!token) throw new Error("token 不能为空");
  return `${base}?site=${siteOrigin}&token=${token}`;
}

async function pushChunk(urls, token, site) {
  const endpoint = buildBaiduPushUrl(
    process.env.BAIDU_PUSH_ENDPOINT || DEFAULT_PUSH_ENDPOINT,
    site.origin,
    token,
  );

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      "user-agent": "STEAMX-BaiduPush/1.0",
    },
    body: `${urls.join("\n")}\n`,
  });
  const body = await response.text();

  let result;
  try {
    result = JSON.parse(body);
  } catch {
    result = { raw: body };
  }

  if (!response.ok || result.error) {
    throw new Error(`百度主动推送失败: HTTP ${response.status} ${body}`);
  }

  return result;
}

function chunkUrls(urls, chunkSize) {
  const chunks = [];
  for (let index = 0; index < urls.length; index += chunkSize) {
    chunks.push(urls.slice(index, index + chunkSize));
  }
  return chunks;
}

async function main() {
  const dryRun = isDryRun();
  const token = process.env.BAIDU_PUSH_TOKEN?.trim();
  if (!token && !dryRun) {
    console.warn("未配置 BAIDU_PUSH_TOKEN，跳过百度主动推送。");
    return;
  }

  const site = getSite();
  const urls = await resolveUrls(site);
  const chunkSize = Math.min(
    readPositiveInteger(process.env.BAIDU_PUSH_CHUNK_SIZE, DEFAULT_CHUNK_SIZE),
    10000,
  );
  const chunks = chunkUrls(urls, chunkSize);

  if (dryRun) {
    console.log(`DRY_RUN: 将提交 ${urls.length} 条 URL（chunkSize=${chunkSize}，批次数=${chunks.length}）`);
    for (const [index, url] of urls.entries()) {
      console.log(`  ${index + 1}. ${url}`);
    }
    return;
  }

  let accepted = 0;
  let submitted = 0;
  /** @type {number | null} */
  let remainQuota = null;

  for (let index = 0; index < chunks.length; index += 1) {
    if (remainQuota === 0) {
      console.log("百度 remain=0，停止后续推送。");
      break;
    }

    let chunk = chunks[index];
    if (remainQuota !== null && chunk.length > remainQuota) {
      chunk = chunk.slice(0, remainQuota);
      console.log(`下一批超过 remain=${remainQuota}，截断为 ${chunk.length} 条后再 POST。`);
    }

    if (chunk.length === 0) {
      break;
    }

    const result = await pushChunk(chunk, token, site);
    submitted += chunk.length;
    accepted += Number(result.success) || 0;

    if (typeof result.remain === "number" && Number.isFinite(result.remain)) {
      remainQuota = result.remain;
    }

    console.log(
      `百度主动推送 ${index + 1}/${chunks.length}: submitted=${chunk.length}`
      + ` success=${result.success ?? "unknown"}`
      + ` remain=${result.remain ?? "unknown"}`,
    );

    if (remainQuota === 0) {
      console.log("百度 remain=0，停止后续推送。");
      break;
    }
  }

  console.log(`百度主动推送完成: ${accepted}/${urls.length} 条被接口接受（实际提交 ${submitted} 条）。`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
