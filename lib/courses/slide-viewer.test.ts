import { describe, expect, it } from "vitest"
import {
  clampPan,
  clampZoom,
  pinchScale,
  shouldAutoEnterImmersive,
  shouldShowRotateHint,
  tapZoneAction,
  keyboardPageDelta,
  swipePageDelta,
} from "./slide-viewer"

describe("slide-viewer", () => {
  it("clamps zoom between 1 and 4", () => {
    expect(clampZoom(0.5)).toBe(1)
    expect(clampZoom(9)).toBe(4)
    expect(clampZoom(Number.NaN)).toBe(1)
    expect(pinchScale(1, 100, 250)).toBe(2.5)
  })

  it("clamps pan to the zoomed image bounds", () => {
    expect(clampPan({ x: 500, y: -500 }, 2, { width: 200, height: 100 })).toEqual({ x: 100, y: -50 })
    expect(clampPan({ x: 30, y: 30 }, 1, { width: 200, height: 100 })).toEqual({ x: 0, y: 0 })
  })

  it("swipes pages only when not zoomed and mostly horizontal", () => {
    expect(swipePageDelta({ x: 200, y: 0 }, { x: 100, y: 10 }, 1)).toBe(1)
    expect(swipePageDelta({ x: 100, y: 0 }, { x: 200, y: 10 }, 1)).toBe(-1)
    expect(swipePageDelta({ x: 100, y: 0 }, { x: 130, y: 0 }, 1)).toBe(0)
    expect(swipePageDelta({ x: 100, y: 0 }, { x: 200, y: 90 }, 1)).toBe(0)
    expect(swipePageDelta({ x: 200, y: 0 }, { x: 0, y: 0 }, 2)).toBe(0)
  })

  it("shows the rotate hint only on portrait phones viewing slides", () => {
    const base = { isPortraitPhone: true, isImmersive: false, isSlidePage: true, dismissed: false }
    expect(shouldShowRotateHint(base)).toBe(true)
    expect(shouldShowRotateHint({ ...base, dismissed: true })).toBe(false)
    expect(shouldShowRotateHint({ ...base, isImmersive: true })).toBe(false)
    expect(shouldShowRotateHint({ ...base, isSlidePage: false })).toBe(false)
  })

  it("auto enters fullscreen when a phone rotates to landscape on a slide", () => {
    const base = { wasPortrait: true, isLandscapePhone: true, isImmersive: false, isSlidePage: true }
    expect(shouldAutoEnterImmersive(base)).toBe(true)
    expect(shouldAutoEnterImmersive({ ...base, wasPortrait: false })).toBe(false)
    expect(shouldAutoEnterImmersive({ ...base, isSlidePage: false })).toBe(false)
  })

  it("maps taps to prev / next / toggle, and never pages while zoomed", () => {
    expect(tapZoneAction(0.1, false)).toBe("prev")
    expect(tapZoneAction(0.9, false)).toBe("next")
    expect(tapZoneAction(0.5, false)).toBe("toggle")
    expect(tapZoneAction(0.1, true)).toBe("toggle")
    expect(tapZoneAction(0.9, true)).toBe("toggle")
  })

  it("pages with arrow keys but not while typing or with modifiers", () => {
    expect(keyboardPageDelta({ key: "ArrowLeft" })).toBe(-1)
    expect(keyboardPageDelta({ key: "ArrowRight" })).toBe(1)
    expect(keyboardPageDelta({ key: "ArrowUp" })).toBe(0)
    expect(keyboardPageDelta({ key: "ArrowRight", target: { tagName: "INPUT" } as unknown as EventTarget })).toBe(0)
    expect(keyboardPageDelta({ key: "ArrowRight", target: { tagName: "DIV", isContentEditable: true } as unknown as EventTarget })).toBe(0)
    expect(keyboardPageDelta({ key: "ArrowRight", metaKey: true })).toBe(0)
  })
})
