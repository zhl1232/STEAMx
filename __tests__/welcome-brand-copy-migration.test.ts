import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DEFAULT_WELCOME_SETTINGS } from "@/lib/communications/types";

const read = (name: string) =>
  readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

const historical = read("20260922120000_platform_communications.sql");
const refresh = read("20261004100000_refresh_welcome_brand_copy.sql");
const historicalBody = historical.match(/body text NOT NULL DEFAULT '([^']+)'/)?.[1];

describe("welcome brand copy migration", () => {
  it("targets exactly the body seeded by the historical migration", () => {
    expect(historicalBody).toContain("从兴趣出发，在动手中成长");
    expect(refresh).toContain(`WHERE body = '${historicalBody}';`);
    expect(refresh).toContain(`quote_literal('${historicalBody}') || '::text'`);
  });

  it("writes the same text as the code fallback", () => {
    const newBody = DEFAULT_WELCOME_SETTINGS.body;
    expect(refresh).toContain(`SET body = '${newBody}'`);
    expect(refresh).toContain(`ALTER COLUMN body SET DEFAULT '${newBody}'`);
    expect(newBody).not.toContain("'");
  });

  it("never rewrites admin-customized rows unconditionally", () => {
    const updates = refresh.match(/UPDATE public\.platform_welcome_settings[\s\S]*?;/g) ?? [];
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatch(/WHERE body = '/);
    const statements = refresh.replace(/^--.*$/gm, "");
    expect(statements).not.toMatch(/\b(activated_after|DELETE|TRUNCATE|INSERT)\b/i);
  });
});
