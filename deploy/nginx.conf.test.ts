import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const nginxConf = readFileSync(path.resolve(process.cwd(), "deploy/nginx.conf"), "utf8");

describe("deploy/nginx.conf", () => {
  it("keeps legacy steamx.cc hosts and permanently redirects them to steam.bj.cn", () => {
    expect(nginxConf).toContain("if ($host = steamx.cc)");
    expect(nginxConf).toContain("if ($host = www.steamx.cc)");
    expect(nginxConf).toContain("if ($host = www.steam.bj.cn)");
    expect(nginxConf).toContain("return 301 https://steam.bj.cn$request_uri;");
    expect(nginxConf).not.toContain("return 301 https://www.steamx.cc$request_uri;");
    expect(nginxConf).not.toMatch(/GPTBot/);
    expect(nginxConf).not.toContain("return 301 https://www.$host$request_uri");
  });
});
