import { describe, expect, it, vi } from "vitest";

const { listAnnouncements } = vi.hoisted(() => ({
  listAnnouncements: vi.fn(),
}));
vi.mock("@/lib/communications/service", () => ({ listAnnouncements }));

import { GET } from "./route";

describe("GET /api/announcements", () => {
  it("tombstones withdrawn announcements without exposing body or action", async () => {
    listAnnouncements.mockResolvedValueOnce([
      {
        id: 1,
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
      {
        id: 2,
        title: "public",
        summary: "",
        body: "body",
        level: "normal",
        status: "published",
        action_label: null,
        action_href: null,
        published_at: "2026-09-21T00:00:00Z",
        expires_at: null,
        created_at: "2026-09-21T00:00:00Z",
        updated_at: "2026-09-21T00:00:00Z",
      },
    ]);
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      announcements: [
        {
          id: 1,
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
        {
          id: 2,
          title: "public",
          summary: "",
          body: "body",
          level: "normal",
          status: "published",
          action_label: null,
          action_href: null,
          published_at: "2026-09-21T00:00:00Z",
          expires_at: null,
          created_at: "2026-09-21T00:00:00Z",
          updated_at: "2026-09-21T00:00:00Z",
        },
      ],
    });
  });
});
