import assert from "node:assert/strict";
import test from "node:test";
import { buildBaiduPushUrl } from "./submit-baidu-urls.mjs";

const ENDPOINT = "http://data.zz.baidu.com/urls";
const SITE = "https://steam.bj.cn";
const TOKEN = "abc123tokenXYZ";

test("buildBaiduPushUrl keeps literal https:// in site= (no URLSearchParams encoding)", () => {
  const url = buildBaiduPushUrl(ENDPOINT, SITE, TOKEN);
  assert.equal(url, `${ENDPOINT}?site=${SITE}&token=${TOKEN}`);
  assert.match(url, /[?&]site=https:\/\/steam\.bj\.cn(?:&|$)/);
  assert.doesNotMatch(url, /%3A%2F%2F/i);
  assert.doesNotMatch(url, /site=https%3A/i);
});

test("buildBaiduPushUrl strips trailing slash and existing query on endpoint base", () => {
  const url = buildBaiduPushUrl(`${ENDPOINT}/?x=1`, SITE, TOKEN);
  assert.equal(url, `${ENDPOINT}?site=${SITE}&token=${TOKEN}`);
  assert.doesNotMatch(url, /%3A%2F%2F/i);
});

test("buildBaiduPushUrl rejects empty token or site without scheme", () => {
  assert.throws(() => buildBaiduPushUrl(ENDPOINT, SITE, ""), /token/);
  assert.throws(() => buildBaiduPushUrl(ENDPOINT, "steam.bj.cn", TOKEN), /siteOrigin|协议/);
  assert.throws(() => buildBaiduPushUrl("", SITE, TOKEN), /ENDPOINT|空/);
});
