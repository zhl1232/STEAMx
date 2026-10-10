import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ProjectSectionNav } from "./project-section-nav"

function makeVisible(element: HTMLElement) {
  Object.defineProperty(element, "getClientRects", { configurable: true, value: () => [{ top: 0, bottom: 20 }] })
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ top: 40, bottom: 60, left: 0, right: 100, width: 100, height: 20 }),
  })
}

describe("ProjectSectionNav", () => {
  afterEach(() => {
    document.querySelectorAll('section[id^="project-"]').forEach((element) => element.remove())
  })

  it("keeps a long step section active and respects its anchor offset", async () => {
    let stepsTop = 144
    const positions = [() => -500, () => stepsTop, () => 900]
    for (const [index, id] of ["project-materials", "project-steps", "project-exploration-records"].entries()) {
      const target = document.createElement("section")
      target.id = id
      target.style.scrollMarginTop = "144px"
      makeVisible(target)
      Object.defineProperty(target, "getBoundingClientRect", {
        value: () => ({ top: positions[index](), bottom: positions[index]() + 1800 }),
      })
      document.body.append(target)
    }

    render(<ProjectSectionNav />)
    await waitFor(() => expect(screen.getByRole("link", { name: "步骤" })).toHaveAttribute("aria-current", "location"))
    stepsTop = -600
    window.dispatchEvent(new Event("scroll"))
    await waitFor(() => expect(screen.getByRole("link", { name: "步骤" })).toHaveAttribute("aria-current", "location"))
    expect(screen.getByRole("link", { name: "探索记录" })).not.toHaveAttribute("aria-current")
  })

  it("maps desktop chapter links to desktop targets", async () => {
    const materials = document.createElement("section")
    materials.id = "project-materials"
    const steps = document.createElement("section")
    steps.id = "project-steps"
    makeVisible(materials)
    makeVisible(steps)
    document.body.append(materials, steps)

    render(<ProjectSectionNav />)

    await waitFor(() => expect(screen.getByRole("link", { name: "材料" })).toHaveAttribute("href", "#project-materials"))
    expect(screen.getByRole("link", { name: "步骤" })).toHaveAttribute("href", "#project-steps")
    expect(screen.getByRole("link", { name: "探索记录" })).toHaveAttribute("href", "#project-exploration-records")
  })

  it("maps mobile chapter links to mobile targets", async () => {
    for (const id of ["project-materials-mobile", "project-steps-mobile", "project-exploration-records-mobile"]) {
      const target = document.createElement("section")
      target.id = id
      makeVisible(target)
      document.body.append(target)
    }

    render(<ProjectSectionNav mobile />)

    await waitFor(() => expect(screen.getByRole("link", { name: "材料" })).toHaveAttribute("href", "#project-materials-mobile"))
    expect(screen.getByRole("link", { name: "步骤" })).toHaveAttribute("href", "#project-steps-mobile")
    expect(screen.getByRole("link", { name: "探索记录" })).toHaveAttribute("href", "#project-exploration-records-mobile")
  })
})

it.each([false, true])("uses viewing chapter labels with responsive anchors (mobile=%s)", (mobile) => {
  render(<ProjectSectionNav mobile={mobile} viewingGuide />)
  const suffix = mobile ? "-mobile" : ""
  expect(screen.getByRole("link", { name: "观看准备" })).toHaveAttribute("href", "#project-materials" + suffix)
  expect(screen.getByRole("link", { name: "观看要点" })).toHaveAttribute("href", "#project-steps" + suffix)
  expect(screen.queryByRole("link", { name: "材料" })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "步骤" })).not.toBeInTheDocument()
})
