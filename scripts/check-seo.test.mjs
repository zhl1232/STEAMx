import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";
import { runSeoChecks } from "./check-seo.mjs";

const servers = [];
afterEach(async () => { for (const server of servers.splice(0)) await new Promise((resolve) => server.close(resolve)); });

const execFileAsync = promisify(execFile);

function page(url, { noindex = false, malformed = false, image = "/api/assets/social.webp?v=1" } = {}) {
  return `<!doctype html><html><head><title>创探空间 · 测试</title><meta name="description" content="测试页面"><link rel="canonical" href="${url}">${noindex ? '<meta name="robots" content="noindex">' : ""}<meta property="og:image" content="${image}"><script type="application/ld+json">${malformed ? "{" : '{"@context":"https://schema.org","@type":"WebPage"}'}</script></head><body><h1>创探空间</h1></body></html>`;
}

async function fixture(options = {}) {
  const server = createServer((request, response) => {
    const origin = `http://${request.headers.host}`;
    if (request.url === "/robots.txt") {
      response.setHeader("content-type", "text/plain");
      const rules = options.robotRules ?? `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /api/assets/\n${options.blockImage ? "" : "Allow: /api/assets/*.webp?*\nAllow: /api/assets/*.webp$\n"}`;
      return response.end(`${rules}\nSitemap: ${origin}/sitemap.xml\n`);
    }
    if (request.url === "/sitemap.xml") {
      const paths = options.missingDynamic ? ["/", "/courses", "/learn/blocks", "/learn/scratch", "/learn/science"] : ["/", "/courses", "/learn/blocks", "/learn/scratch", "/learn/science", "/project/p1", "/courses/c1", "/courses/c1/lessons/l1"];
      if (options.largeSitemap) paths.unshift(...Array.from({ length: 2100 }, (_, index) => `/species/${index}`));
      response.setHeader("content-type", "application/xml"); return response.end(`<urlset>${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`);
    }
    if (request.url === "/api/assets/social.webp?v=1" && options.redirectImage) {
      response.writeHead(302, { location: "/api/assets/final.webp" }); return response.end();
    }
    if (["/api/assets/social.webp?v=1", "/api/assets/final.webp"].includes(request.url)) { response.setHeader("content-type", "image/webp"); return response.end("image"); }
    if (request.url === "/api/private") return response.end("private");
    if (options.timeoutPath === request.url) { response.writeHead(200, { "content-type": "text/html" }); response.write("<html>"); return; }
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(page(`${origin}${request.url}`, options));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

describe("check-seo", () => {
  it("passes a healthy local site and reports bounded counters", async () => {
    const baseUrl = await fixture();
    const report = await runSeoChecks({ baseUrl, timeoutMs: 200, retries: 1 });
    assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
    assert.equal(report.counters.sitemapUrls, 8);
    assert.equal(report.counters.imageUrls, 1);
  });

  it("catches noindex, missing dynamic sitemap URLs, blocked image, and malformed JSON-LD", async () => {
    const baseUrl = await fixture({ noindex: true, missingDynamic: true, malformed: true, blockImage: true });
    const report = await runSeoChecks({ baseUrl, timeoutMs: 200, retries: 0 });
    const text = report.errors.map((item) => item.message).join(" ");
    assert.match(text, /noindex/);
    assert.match(text, /dynamic project/);
    assert.match(text, /malformed JSON-LD/);
    assert.match(text, /og:image verification failed|blocked from public image/);
  });

  it("reports unavailable and timed out routes without throwing", async () => {
    const baseUrl = await fixture({ timeoutPath: "/learn/science" });
    const report = await runSeoChecks({ baseUrl, timeoutMs: 10, retries: 1 });
    assert.ok(report.errors.some((item) => /timed out|unavailable/.test(item.message)));
  });

  it("samples dynamic URLs after a large sitemap and validates every location", async () => {
    const baseUrl = await fixture({ largeSitemap: true });
    const report = await runSeoChecks({ baseUrl, timeoutMs: 200, retries: 0 });
    assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
    assert.equal(report.counters.sitemapUrls, 2108);
  });

  it("accepts an image redirect to a successful image and checks its final robots path", async () => {
    const baseUrl = await fixture({ redirectImage: true });
    const report = await runSeoChecks({ baseUrl, timeoutMs: 200, retries: 0 });
    assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
    assert.ok(report.warnings.some((item) => /redirected/.test(item.message)));
  });

  it("uses and merges named crawler groups before wildcard rules", async () => {
    const baseUrl = await fixture({ robotRules: [
      "User-agent: *", "Allow: /", "Disallow: /api/", "Allow: /api/assets/*.webp?*",
      "User-agent: Googlebot", "Disallow: /api/", "Disallow: /learn/scratch",
      "User-agent: Googlebot", "Allow: /api/assets/*.webp?*",
    ].join("\n") });
    const report = await runSeoChecks({ baseUrl, timeoutMs: 200, retries: 0 });
    assert.equal(report.errors.length, 1, JSON.stringify(report.errors));
    assert.match(report.errors[0].message, /Googlebot is blocked from public route/);
    assert.equal(new URL(report.errors[0].url).pathname, "/learn/scratch");
  });

  it("writes nested CLI reports and rejects unknown arguments", async () => {
    const baseUrl = await fixture();
    const dir = mkdtempSync(`${tmpdir()}/check-seo-`);
    const reportPath = `${dir}/nested/seo-report.json`;
    const script = fileURLToPath(new URL("./check-seo.mjs", import.meta.url));
    const result = await execFileAsync(process.execPath, [script, "--base-url", baseUrl, "--report", reportPath]);
    assert.match(result.stdout, /"tool": "check-seo"/);
    assert.equal(JSON.parse(readFileSync(reportPath, "utf8")).tool, "check-seo");
    await assert.rejects(execFileAsync(process.execPath, [script, "--wat"]));
    rmSync(dir, { recursive: true, force: true });
  });
});
