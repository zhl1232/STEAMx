import { describe, expect, it } from "vitest";

import { buildNatureSubmitHref } from "./nature-navigation";

describe("buildNatureSubmitHref", () => {
  it("keeps functional params but never adds a from= tracking param", () => {
    expect(buildNatureSubmitHref({})).toBe("/nature/submit");
    expect(buildNatureSubmitHref({ topic: "birds", speciesId: 12 })).toBe("/nature/submit?topic=birds&species=12");
    // Legacy callers passing `from` must not leak it into the URL.
    expect(buildNatureSubmitHref({ topic: "birds", from: "/nature" } as never)).not.toContain("from=");
  });
});
