import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { getUserWorks } = vi.hoisted(() => ({ getUserWorks: vi.fn() }))

vi.mock("@/lib/works/data", () => ({ getUserWorks }))

import { GET } from "./route"

function get(id: string, search = "") {
  return GET(new NextRequest(`http://localhost/api/users/x/works${search}`), {
    params: Promise.resolve({ id }),
  })
}

describe("GET /api/users/[id]/works", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(["not-a-uuid", "1", " ", "", "11111111-1111-1111-1111-11111111111"])(
    "returns 404 for the non-UUID id %j instead of surfacing a Postgres 22P02 as a 500",
    async (id) => {
      const response = await get(id)

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toEqual({ error: "User not found" })
      expect(getUserWorks).not.toHaveBeenCalled()
    },
  )

  it("queries works for a valid UUID", async () => {
    getUserWorks.mockResolvedValue({ works: [], hasMore: false })

    const response = await get("11111111-1111-1111-1111-111111111111", "?page=2")

    expect(response.status).toBe(200)
    expect(getUserWorks).toHaveBeenCalledWith({
      userId: "11111111-1111-1111-1111-111111111111",
      page: 2,
      pageSize: 12,
      publicOnly: true,
    })
  })
})
