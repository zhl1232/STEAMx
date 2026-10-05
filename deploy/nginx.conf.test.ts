import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const nginxConf = readFileSync(path.resolve(process.cwd(), "deploy/nginx.conf"), "utf8");

describe("deploy/nginx.conf", () => {
  it("keeps legacy steamx.cc hosts and permanently redirects them to steam.bj.cn", () => {
    expect(nginxConf).toContain("server_name steamx.cc www.steamx.cc;");
    expect(nginxConf).toContain('add_header X-Robots-Tag "noindex, nofollow" always;');
    expect(nginxConf).toContain("if ($host = www.steam.bj.cn)");
    expect(nginxConf).toContain("return 301 https://steam.bj.cn$request_uri;");
    expect(nginxConf).not.toContain("return 301 https://www.steamx.cc$request_uri;");
    expect(nginxConf).not.toMatch(/GPTBot/);
    expect(nginxConf).not.toContain("return 301 https://www.$host$request_uri");
  });

  it("does not attach X-Robots-Tag noindex to the primary steam.bj.cn proxy server", () => {
    const blocks = nginxConf.split(/\n(?=server \{)/);
    const primaryHttps = blocks.find(
      (block) =>
        block.includes("server_name __NGINX_SERVER_NAMES__;")
        && block.includes("listen 443")
        && block.includes("proxy_pass http://127.0.0.1:3000"),
    );
    expect(primaryHttps).toBeTruthy();
    expect(primaryHttps).not.toContain("X-Robots-Tag");
  });
});
