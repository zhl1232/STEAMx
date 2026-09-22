import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const { getAnnouncement } = vi.hoisted(() => ({ getAnnouncement: vi.fn() }));
vi.mock("@/lib/communications/service", () => ({ getAnnouncement }));

import { GET } from "./route";

describe("GET /api/announcements/[id]", () => {
  it("does not expose withdrawn content", async () => {
    getAnnouncement.mockResolvedValueOnce({
      id: 4,
      title: "公告已撤下",
      summary: "",
      body: "",
      level: "urgent",
      status: "withdrawn",
      action_label: null,
      action_href: null,
      published_at: "2026-09-21T00:00:00Z",
      expires_at: null,
      created_at: "2026-09-21T00:00:00Z",
      updated_at: "2026-09-21T00:00:00Z",
    });
    const response = await GET(
      new NextRequest("http://localhost/api/announcements/4"),
      { params: Promise.resolve({ id: "4" }) },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      announcement: {
        id: 4,
        title: "公告已撤下",
        summary: "",
        body: "",
        level: "urgent",
        status: "withdrawn",
        action_label: null,
        action_href: null,
        published_at: "2026-09-21T00:00:00Z",
        expires_at: null,
        created_at: "2026-09-21T00:00:00Z",
        updated_at: "2026-09-21T00:00:00Z",
      },
    });
  });

  it("returns 404 for drafts", async () => {
    getAnnouncement.mockResolvedValueOnce(null);
    const response = await GET(
      new NextRequest("http://localhost/api/announcements/5"),
      { params: Promise.resolve({ id: "5" }) },
    );
    expect(response.status).toBe(404);
  });
});
