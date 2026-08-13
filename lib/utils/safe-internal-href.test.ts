import { describe, expect, it } from "vitest"

import { isSafeInternalHref, sanitizeInternalHref } from "./safe-internal-href"

describe("isSafeInternalHref", () => {
  it("accepts the home path used by homepage observation cards", () => {
    expect(isSafeInternalHref("/")).toBe(true)
  })

  it("accepts in-app nature and query-bearing paths", () => {
    expect(isSafeInternalHref("/nature/observations")).toBe(true)
    expect(isSafeInternalHref("/nature/species/aythya-fuligula?topic=birds")).toBe(true)
    expect(isSafeInternalHref("/settings/security")).toBe(true)
  })

  it("rejects protocol-relative, traversal, and non-path values", () => {
    expect(isSafeInternalHref("//evil.com")).toBe(false)
    expect(isSafeInternalHref("/\\evil.com")).toBe(false)
    expect(isSafeInternalHref("/nature/../login")).toBe(false)
    expect(isSafeInternalHref("https://evil.com")).toBe(false)
    expect(isSafeInternalHref("/login?redirect=https://evil.com")).toBe(false)
    expect(isSafeInternalHref("")).toBe(false)
    expect(isSafeInternalHref(null)).toBe(false)
  })
})

describe("sanitizeInternalHref", () => {
  it("keeps safe from=/ instead of falling back to the nature list", () => {
    expect(sanitizeInternalHref("/", "/nature/observations")).toBe("/")
  })

  it("falls back when from tries to leave the intended path", () => {
    expect(sanitizeInternalHref("/nature/../login", "/nature/observations")).toBe(
      "/nature/observations",
    )
    expect(sanitizeInternalHref("//evil.com", "/")).toBe("/")
  })
})
