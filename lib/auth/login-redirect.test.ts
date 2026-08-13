import { describe, expect, it } from "vitest"

import {
  STEAM_PATHNAME_HEADER,
  STEAM_SEARCH_HEADER,
  buildLoginRedirect,
  buildLoginRedirectFromRequestHeaders,
  isPublicSettingsPath,
} from "@/lib/auth/login-redirect"

describe("isPublicSettingsPath", () => {
  it("allows the footer about/help page without login", () => {
    expect(isPublicSettingsPath("/settings/about")).toBe(true)
  })

  it("keeps account settings private", () => {
    expect(isPublicSettingsPath("/settings")).toBe(false)
    expect(isPublicSettingsPath("/settings/profile")).toBe(false)
  })
})

describe("buildLoginRedirect", () => {
  it("omits next when the destination is already home", () => {
    expect(buildLoginRedirect("/")).toBe("/login")
    expect(buildLoginRedirect(null)).toBe("/login")
  })

  it("keeps settings and shop destinations so login can return", () => {
    expect(buildLoginRedirect("/settings")).toBe("/login?next=%2Fsettings")
    expect(buildLoginRedirect("/shop")).toBe("/login?next=%2Fshop")
    expect(buildLoginRedirect("/settings/profile")).toBe("/login?next=%2Fsettings%2Fprofile")
  })

  it("rejects protocol-relative next values", () => {
    expect(buildLoginRedirect("//evil.com")).toBe("/login")
  })
})

describe("buildLoginRedirectFromRequestHeaders", () => {
  it("rehydrates pathname and query from proxy headers", () => {
    const headers = new Headers({
      [STEAM_PATHNAME_HEADER]: "/settings/xiaodi",
      [STEAM_SEARCH_HEADER]: "?section=voice",
    })
    expect(buildLoginRedirectFromRequestHeaders(headers)).toBe(
      "/login?next=%2Fsettings%2Fxiaodi%3Fsection%3Dvoice",
    )
  })
})
