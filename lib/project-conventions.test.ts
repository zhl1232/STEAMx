import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("project conventions", () => {
  it("uses Next.js proxy instead of deprecated middleware convention", async () => {
    expect(existsSync(join(projectRoot, "middleware.ts"))).toBe(false);
    expect(existsSync(join(projectRoot, "proxy.ts"))).toBe(true);

    const proxySource = await readFile(join(projectRoot, "proxy.ts"), "utf8");
    expect(proxySource).toContain("export function proxy");
    expect(proxySource).not.toContain("export function middleware");
  });
});
