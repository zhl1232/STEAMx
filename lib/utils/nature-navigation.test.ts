import { describe, expect, it } from "vitest";

import { appendNatureFrom, normalizeNatureFrom } from "./nature-navigation";

describe("normalizeNatureFrom", () => {
  it("returns homepage from=/ so observation back does not dump users on the list", () => {
    expect(normalizeNatureFrom("/", "/nature/observations")).toBe("/");
  });

  it("keeps nature paths and rejects traversal", () => {
    expect(normalizeNatureFrom("/nature/submit", "/nature")).toBe("/nature/submit");
    expect(normalizeNatureFrom("/nature/../login", "/nature/observations")).toBe(
      "/nature/observations",
    );
  });
});

describe("appendNatureFrom", () => {
  it("preserves homepage origin on observation links", () => {
    expect(appendNatureFrom("/nature/observations/13", "/")).toBe(
      "/nature/observations/13?from=%2F",
    );
  });
});
