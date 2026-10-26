import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const compose = readFileSync(path.resolve(process.cwd(), "deploy/docker-compose.yml"), "utf8");

describe("deploy/docker-compose.yml memory limits", () => {
  it("caps steam-app at a hard 1g limit with swap disabled (memswap_limit == mem_limit)", () => {
    expect(compose).toContain('mem_limit: "${STEAM_APP_MEMORY_LIMIT:-1g}"');
    expect(compose).toContain('memswap_limit: "${STEAM_APP_MEMORY_LIMIT:-1g}"');
    expect(compose).toContain('NODE_OPTIONS: "${STEAM_APP_NODE_OPTIONS:---max-old-space-size=512}"');
  });

  it("caps workers at 128m with swap disabled and a ~96MB heap", () => {
    for (const prefix of ["AUTO_INTERACTION", "COMMUNICATIONS_WORKER", "COMMERCE_WORKER"]) {
      expect(compose).toContain(`mem_limit: "\${${prefix}_MEMORY_LIMIT:-128m}"`);
      expect(compose).toContain(`memswap_limit: "\${${prefix}_MEMORY_LIMIT:-128m}"`);
      expect(compose).toContain(`NODE_OPTIONS: "\${${prefix}_NODE_OPTIONS:---max-old-space-size=96}"`);
    }
    expect(compose).not.toContain("max-old-space-size=192");
    expect(compose).not.toContain(":-256m}");
  });

  it("sets memswap_limit for every service that sets mem_limit", () => {
    const memLimits = compose.match(/^\s+mem_limit:/gm) ?? [];
    const swapLimits = compose.match(/^\s+memswap_limit:/gm) ?? [];
    expect(memLimits.length).toBe(4);
    expect(swapLimits.length).toBe(memLimits.length);
  });
});
