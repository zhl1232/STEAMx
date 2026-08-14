import { describe, expect, it } from "vitest"

import { collectHeroGalleryImages } from "./hero-gallery"

describe("collectHeroGalleryImages", () => {
  it("puts the cover first and keeps unique step photos in order", () => {
    expect(
      collectHeroGalleryImages("/cover.webp", [
        { title: "装沙", image_url: "/step-1.webp" },
        { title: "加水", image_url: "/step-2.webp" },
        { title: "观察", image_url: "/step-1.webp" },
      ], { coverCaption: "水循环" }),
    ).toEqual([
      { url: "/cover.webp", caption: "水循环" },
      { url: "/step-1.webp", caption: "装沙" },
      { url: "/step-2.webp", caption: "加水" },
    ])
  })

  it("skips a cover that is reused as a step photo", () => {
    expect(
      collectHeroGalleryImages("/cover.webp", [
        { title: "封面同图", image_url: "/cover.webp" },
        { title: "下一步", image_url: "/step-2.webp" },
      ]),
    ).toEqual([
      { url: "/cover.webp" },
      { url: "/step-2.webp", caption: "下一步" },
    ])
  })

  it("falls back to step photos when the cover is empty", () => {
    expect(
      collectHeroGalleryImages("  ", [
        { title: "第一步", image_url: "/step-1.webp" },
      ]),
    ).toEqual([{ url: "/step-1.webp", caption: "第一步" }])
  })
})
