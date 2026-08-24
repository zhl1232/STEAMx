#!/usr/bin/env node

/**
 * 将公开 sitemap 中的规范 URL 主动提交给百度搜索资源平台。
 *
 * 用法：
 *   BAIDU_PUSH_TOKEN=... pnpm seo:baidu-push
 *
 * 百度主动推送接口目前使用官方的 HTTP endpoint；不要把 token 写入仓库或日志。
 * 未配置 token 时安全跳过，方便本地开发和没有百度站长平台权限的环境继续发布。
 */

const DEFAULT_SITE = "https://www.steamx.cc";
const DEFAULT_PUSH_ENDPOINT = "http://data.zz.baidu.com/urls";
const DEFAULT_CHUNK_SIZE = 1000;

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getSite() {
  const site = (process.env.BAIDU_PUSH_SITE || DEFAULT_SITE).trim();
  const url = new URL(site);
  url.pathname = "/";
  url.search = "";
  url.hash = "";

  if (url.protocol !== "https:" || url.hostname !== "www.steamx.cc") {
    throw new Error("BAIDU_PUSH_SITE 必须是 https://www.steamx.cc");
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

async function pushChunk(urls, token, site) {
  const endpoint = new URL(process.env.BAIDU_PUSH_ENDPOINT || DEFAULT_PUSH_ENDPOINT);
  endpoint.searchParams.set("site", site.origin);
  endpoint.searchParams.set("token", token);

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

async function main() {
  const token = process.env.BAIDU_PUSH_TOKEN?.trim();
  if (!token) {
    console.warn("未配置 BAIDU_PUSH_TOKEN，跳过百度主动推送。");
    return;
  }

  const site = getSite();
  const urls = await loadSitemap(site);
  const chunkSize = Math.min(
    readPositiveInteger(process.env.BAIDU_PUSH_CHUNK_SIZE, DEFAULT_CHUNK_SIZE),
    10000,
  );
  const chunks = [];

  for (let index = 0; index < urls.length; index += chunkSize) {
    chunks.push(urls.slice(index, index + chunkSize));
  }

  let accepted = 0;
  for (const [index, chunk] of chunks.entries()) {
    const result = await pushChunk(chunk, token, site);
    accepted += Number(result.success) || 0;
    console.log(
      `百度主动推送 ${index + 1}/${chunks.length}: submitted=${chunk.length}`
      + ` success=${result.success ?? "unknown"}`
      + ` remain=${result.remain ?? "unknown"}`,
    );
  }

  console.log(`百度主动推送完成: ${accepted}/${urls.length} 条被接口接受。`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
