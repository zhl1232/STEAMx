/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { NextRequest } from "next/server"

import { PATCH } from "@/app/api/admin/observations/[id]/route"
import { requireRole } from "@/lib/api/auth"
import { buildObservationRewardSummary } from "@/lib/api/observation-gamification"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

vi.mock("@/lib/api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth")>()
  return {
    ...actual,
    requireRole: vi.fn(),
  }
})

vi.mock("@/lib/api/observation-gamification", () => ({
  buildObservationRewardSummary: vi.fn(),
  rollbackObservationGamification: vi.fn(),
}))

vi.mock("@/lib/auto-interactions", () => ({
  enqueueAutoInteractionsForTarget: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe("PATCH /api/admin/observations/[id]", () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireRoleMock = requireRole as Mock<typeof requireRole>
  const rewardMock = buildObservationRewardSummary as Mock<typeof buildObservationRewardSummary>
  const adminFromMock = supabaseAdmin.from as Mock<typeof supabaseAdmin.from>

  beforeEach(() => {
    vi.clearAllMocks()
    requireRoleMock.mockResolvedValue(undefined as never)
    rewardMock.mockResolvedValue({} as never)
  })

  function mockExistingObservation(status = "pending") {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 14, user_id: "author-1", status },
      error: null,
    })
    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    } as never)
  }

  function reviewRequest(status: "approved" | "rejected") {
    return new NextRequest("http://localhost/api/admin/observations/14", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    })
  }

  it("updates review and moderation states together with the server client", async () => {
    mockExistingObservation()
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 14, status: "approved", moderation_state: "approved" },
      error: null,
    })
    const select = vi.fn(() => ({ maybeSingle }))
    const eq = vi.fn(() => ({ select }))
    const update = vi.fn(() => ({ eq }))
    adminFromMock.mockReturnValue({ update } as never)

    const response = await PATCH(reviewRequest("approved"), {
      params: Promise.resolve({ id: "14" }),
    })

    expect(response.status).toBe(200)
    expect(adminFromMock).toHaveBeenCalledWith("observation_events")
    expect(update).toHaveBeenCalledWith({
      status: "approved",
      moderation_state: "approved",
    })
    expect(eq).toHaveBeenCalledWith("id", 14)
    expect(rewardMock).toHaveBeenCalledWith("author-1", 14)
  })

  it("does not report success when no observation was actually updated", async () => {
    mockExistingObservation()
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    adminFromMock.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    } as never)

    const response = await PATCH(reviewRequest("approved"), {
      params: Promise.resolve({ id: "14" }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Observation not found" })
    expect(rewardMock).not.toHaveBeenCalled()
  })
})
