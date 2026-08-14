import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const nginxConf = readFileSync(path.resolve(process.cwd(), "deploy/nginx.conf"), "utf8");

describe("deploy/nginx.conf", () => {
  it("permanently redirects only steamx.cc to www and no longer blocks GPTBot", () => {
    expect(nginxConf).toContain("if ($host = steamx.cc)");
    expect(nginxConf).toContain("return 301 https://www.steamx.cc$request_uri;");
    expect(nginxConf).not.toMatch(/GPTBot/);
    expect(nginxConf).not.toContain("return 301 https://www.$host$request_uri");
  });
});
