import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { publicAnnouncement } from "./service";

describe("publicAnnouncement", () => {
  it("removes withdrawn content and action fields while preserving safe metadata", () => {
    expect(
      publicAnnouncement({
        id: 7,
        title: "secret",
        summary: "secret",
        body: "secret",
        level: "urgent",
        status: "withdrawn",
        action_label: "Open",
        action_href: "/secret",
        published_at: "2026-09-21T00:00:00Z",
        expires_at: null,
        created_at: "2026-09-21T00:00:00Z",
        updated_at: "2026-09-21T00:00:00Z",
      }),
    ).toEqual({
      id: 7,
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
  });
});
