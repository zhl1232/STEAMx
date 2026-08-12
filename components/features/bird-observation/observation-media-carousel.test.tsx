import { fireEvent, render, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ObservationMediaCarousel } from "./observation-media-carousel"

describe("ObservationMediaCarousel", () => {
  it("eager-loads only the active thumbnail", async () => {
    const { container } = render(
      <ObservationMediaCarousel
        mediaUrls={["/photos/one.jpg", "/photos/two.jpg", "/photos/three.jpg"]}
        alt="观察照片"
      />,
    )

    const thumbnailImages = () => Array.from(container.querySelectorAll("button img"))

    expect(thumbnailImages()).toHaveLength(3)
    expect(thumbnailImages().map((image) => image.getAttribute("loading"))).toEqual([
      "eager",
      "lazy",
      "lazy",
    ])

    fireEvent.click(thumbnailImages()[2]!.closest("button")!)

    await waitFor(() => {
      expect(thumbnailImages().map((image) => image.getAttribute("loading"))).toEqual([
        "lazy",
        "lazy",
        "eager",
      ])
    })
  })
})
