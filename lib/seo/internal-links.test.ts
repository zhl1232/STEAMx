import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const SCAN_DIRS = ["app", "components", "lib"];
// Tracking params that used to be appended to internal links and produced
// "Alternate page with proper canonical tag" duplicates in Search Console.
const TRACKING_LINK_RE = /\/(?:project|nature)\/[^\s"'`]*[?&](?:from|sourceIndex)=|set\(\s*['"](?:from|sourceIndex)['"]/;

describe("internal links", () => {
  it("never append ?from= / ?sourceIndex= to project or nature links", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
          const source = fs.readFileSync(full, "utf8");
          source.split("\n").forEach((line, index) => {
            if (TRACKING_LINK_RE.test(line)) offenders.push(`${path.relative(ROOT, full)}:${index + 1}`);
          });
        }
      }
    };
    SCAN_DIRS.forEach((dir) => walk(path.join(ROOT, dir)));
    expect(offenders).toEqual([]);
  });
});
