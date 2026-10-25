// @vitest-environment happy-dom
import { useLayoutEffect } from "react"
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"

import { useFunctionWarsImmersive } from "./use-function-wars-immersive"

let landscape = false
let media: EventTarget
let root: HTMLElement
let fullscreenElement: Element | null
let requestFullscreen: Mock<HTMLElement["requestFullscreen"]>
let exitFullscreen: ReturnType<typeof vi.fn>
let scrollTo: ReturnType<typeof vi.fn>
let viewport: EventTarget & { height: number; offsetTop: number }
let frames: Map<number, FrameRequestCallback>
let nextFrame: number

function flushFrames() {
    act(() => {
        const queued = [...frames.values()]
        frames.clear()
        queued.forEach((callback) => callback(0))
    })
}

function mount() {
    return renderHook(() => {
        const hook = useFunctionWarsImmersive()
        hook.rootRef.current = root
        useLayoutEffect(() => {
            root.style.position = hook.isImmersive ? "fixed" : ""
        }, [hook.isImmersive])
        return hook
    })
}

function rotate(next: boolean, realRotation = false) {
    act(() => {
        landscape = next
        media.dispatchEvent(new Event("change"))
        if (realRotation) window.dispatchEvent(new Event("orientationchange"))
    })
}

beforeEach(() => {
    landscape = false
    frames = new Map()
    nextFrame = 0
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        const id = ++nextFrame
        frames.set(id, callback)
        return id
    })
    vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id) })
    media = new EventTarget()
    root = document.createElement("main")
    document.body.append(root)
    document.body.style.overflow = "auto"
    fullscreenElement = null
    requestFullscreen = vi.fn<HTMLElement["requestFullscreen"]>().mockResolvedValue(undefined)
    root.requestFullscreen = requestFullscreen
    exitFullscreen = vi.fn().mockImplementation(async () => { fullscreenElement = null })
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement })
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen })
    Object.defineProperty(media, "matches", { configurable: true, get: () => landscape })
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: vi.fn(() => media as MediaQueryList),
    })
    scrollTo = vi.fn()
    vi.stubGlobal("scrollTo", scrollTo)
    Object.defineProperty(window, "scrollY", { configurable: true, value: 240 })
    viewport = Object.assign(new EventTarget(), { height: 320, offsetTop: 12 })
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport })
})

afterEach(() => {
    cleanup()
    document.body.replaceChildren()
    document.body.style.overflow = ""
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe("useFunctionWarsImmersive", () => {
    it("automatically enters short landscape, exits portrait, and can enter again on rotation", () => {
        const { result } = mount()
        rotate(true)
        expect(result.current.isImmersive).toBe(true)
        expect(requestFullscreen).not.toHaveBeenCalled()
        rotate(false)
        expect(result.current.isImmersive).toBe(false)
        rotate(true)
        expect(result.current.isImmersive).toBe(true)
    })

    it("enters on initial landscape and respects exit until the next rotation", () => {
        landscape = true
        const { result } = mount()
        expect(result.current.isImmersive).toBe(true)
        act(() => result.current.exit())
        rotate(true)
        act(() => window.dispatchEvent(new Event("resize")))
        expect(result.current.isImmersive).toBe(false)
        rotate(false)
        rotate(true)
        expect(result.current.isImmersive).toBe(true)
    })

    it("retains immediate CSS immersion if native fullscreen fails, including in portrait", async () => {
        requestFullscreen.mockRejectedValue(new Error("unsupported"))
        const { result } = mount()
        let entering: Promise<void>
        act(() => { entering = result.current.enter() })
        expect(result.current.isImmersive).toBe(true)
        await act(async () => { await entering })
        expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: "hide" })
        rotate(false)
        expect(result.current.isImmersive).toBe(true)
    })

    it("restores scroll, overflow and viewport variables on Escape", async () => {
        const { result } = mount()
        await act(() => result.current.enter())
        expect(document.body.style.overflow).toBe("hidden")
        expect(root.style.getPropertyValue("--function-wars-viewport-height")).toBe("320px")
        viewport.height = 180
        viewport.offsetTop = 30
        act(() => viewport.dispatchEvent(new Event("resize")))
        expect(root.style.getPropertyValue("--function-wars-viewport-height")).toBe("180px")
        expect(root.style.getPropertyValue("--function-wars-viewport-top")).toBe("30px")
        act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })))
        expect(result.current.isImmersive).toBe(false)
        expect(document.body.style.overflow).toBe("auto")
        expect(root.style.getPropertyValue("--function-wars-viewport-height")).toBe("")
        expect(scrollTo).not.toHaveBeenCalled()
        flushFrames()
        expect(root.style.position).toBe("")
        expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 240, behavior: "instant" })
    })

    it("waits for native fullscreen exit before restoring scroll after layout commits", async () => {
        let finishExit!: () => void
        exitFullscreen.mockImplementation(() => new Promise<void>((resolve) => { finishExit = resolve }))
        requestFullscreen.mockImplementation(async () => { fullscreenElement = root })
        const { result } = mount()
        await act(() => result.current.enter())
        act(() => result.current.exit())
        flushFrames()
        expect(scrollTo).not.toHaveBeenCalled()
        await act(async () => {
            fullscreenElement = null
            finishExit()
        })
        expect(scrollTo).not.toHaveBeenCalled()
        scrollTo.mockImplementation(() => { expect(root.style.position).toBe("") })
        flushFrames()
        expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 240, behavior: "instant" })
    })

    it("cancels an old scroll restoration when a new session starts", async () => {
        const { result } = mount()
        await act(() => result.current.enter())
        act(() => result.current.exit())
        await act(() => result.current.enter())
        flushFrames()
        expect(result.current.isImmersive).toBe(true)
        expect(scrollTo).not.toHaveBeenCalled()
    })

    it("cancels pending scroll restoration on unmount to preserve navigation scrolling", async () => {
        const { result, unmount } = mount()
        await act(() => result.current.enter())
        act(() => result.current.exit())
        unmount()
        flushFrames()
        expect(scrollTo).not.toHaveBeenCalled()
        expect(document.body.style.overflow).toBe("auto")
    })

    it("allows a drawer to consume Escape", async () => {
        const { result } = mount()
        await act(() => result.current.enter())
        const event = new KeyboardEvent("keydown", { key: "Escape", cancelable: true })
        event.preventDefault()
        act(() => document.dispatchEvent(event))
        expect(result.current.isImmersive).toBe(true)
    })

    it("does not mistake portrait keyboard geometry for a rotation", () => {
        const { result } = mount()
        const input = document.createElement("input")
        root.append(input)
        input.focus()
        rotate(true)
        expect(result.current.isImmersive).toBe(false)
        rotate(true, true)
        expect(result.current.isImmersive).toBe(true)
    })

    it("exits an automatic session on portrait resize while an input is focused", () => {
        landscape = true
        const { result } = mount()
        const input = document.createElement("input")
        root.append(input)
        input.focus()
        rotate(false)
        expect(result.current.isImmersive).toBe(false)
        expect(document.body.style.overflow).toBe("auto")
    })

    it("accepts real rotation arriving before the viewport updates while typing", () => {
        const { result } = mount()
        const input = document.createElement("input")
        root.append(input)
        input.focus()
        act(() => window.dispatchEvent(new Event("orientationchange")))
        rotate(true)
        expect(result.current.isImmersive).toBe(true)
    })

    it("updates the height fallback on resize without visualViewport", async () => {
        Object.defineProperty(window, "visualViewport", { configurable: true, value: null })
        const { result } = mount()
        await act(() => result.current.enter())
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 360 })
        act(() => window.dispatchEvent(new Event("resize")))
        expect(root.style.getPropertyValue("--function-wars-viewport-height")).toBe("360px")
    })

    it("closes a native request that succeeds after exit without reentering", async () => {
        let resolve!: () => void
        requestFullscreen.mockImplementation(() => new Promise<void>((done) => { resolve = done }))
        const { result } = mount()
        let entering!: Promise<void>
        act(() => { entering = result.current.enter() })
        act(() => result.current.exit())
        await act(async () => {
            fullscreenElement = root
            document.dispatchEvent(new Event("fullscreenchange"))
            resolve()
            await entering
        })
        expect(result.current.isImmersive).toBe(false)
        expect(fullscreenElement).toBeNull()
        expect(document.body.style.overflow).toBe("auto")
    })

    it("restores CSS state when native fullscreen ends", async () => {
        requestFullscreen.mockImplementation(async () => {
            fullscreenElement = root
            document.dispatchEvent(new Event("fullscreenchange"))
        })
        const { result } = mount()
        await act(() => result.current.enter())
        act(() => {
            fullscreenElement = null
            document.dispatchEvent(new Event("fullscreenchange"))
        })
        expect(result.current.isImmersive).toBe(false)
        expect(document.body.style.overflow).toBe("auto")
    })

    it("does not exit somebody else's fullscreen", async () => {
        fullscreenElement = document.createElement("aside")
        const { result } = mount()
        await act(() => result.current.enter())
        act(() => result.current.exit())
        expect(exitFullscreen).not.toHaveBeenCalled()
        expect(requestFullscreen).not.toHaveBeenCalled()
    })

    it("cleans up a pending request and viewport listeners on unmount", async () => {
        let resolve!: () => void
        requestFullscreen.mockImplementation(() => new Promise<void>((done) => { resolve = done }))
        const { result, unmount } = mount()
        let entering!: Promise<void>
        act(() => { entering = result.current.enter() })
        unmount()
        expect(document.body.style.overflow).toBe("auto")
        viewport.dispatchEvent(new Event("resize"))
        expect(root.style.getPropertyValue("--function-wars-viewport-height")).toBe("")
        fullscreenElement = root
        resolve()
        await entering
        expect(exitFullscreen).toHaveBeenCalledOnce()
    })
})
