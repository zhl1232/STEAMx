"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

const SHORT_LANDSCAPE = "(min-width: 640px) and (max-width: 1023px) and (max-height: 520px) and (orientation: landscape)"
const HEIGHT = "--function-wars-viewport-height"
const TOP = "--function-wars-viewport-top"

type Session = {
    automatic: boolean
    restore: () => void
    scroll: { left: number; top: number }
}

/** CSS immersion works even when the browser cannot grant native fullscreen. */
export function useFunctionWarsImmersive(): {
    rootRef: RefObject<HTMLElement | null>
    isImmersive: boolean
    enter: () => Promise<void>
    exit: () => void
} {
    const rootRef = useRef<HTMLElement | null>(null)
    const [isImmersive, setIsImmersive] = useState(false)
    const session = useRef<Session | null>(null)
    const epoch = useRef(0)
    const nativeOwned = useRef(false)
    const mounted = useRef(false)
    const committedImmersive = useRef(false)
    const restoreFrame = useRef(0)
    const pendingScroll = useRef<{ left: number; top: number; nativeExits: number } | null>(null)

    const scheduleScrollRestore = useCallback(() => {
        cancelAnimationFrame(restoreFrame.current)
        const pending = pendingScroll.current
        if (!pending || pending.nativeExits || !mounted.current || session.current || committedImmersive.current) return
        restoreFrame.current = requestAnimationFrame(() => {
            if (pendingScroll.current !== pending || pending.nativeExits || !mounted.current || session.current || committedImmersive.current) return
            window.scrollTo({ left: pending.left, top: pending.top, behavior: "instant" })
        })
    }, [])

    const leaveNativeFullscreen = useCallback(async (root: HTMLElement | null) => {
        if (!root || document.fullscreenElement !== root) return
        const pending = pendingScroll.current
        if (pending) pending.nativeExits += 1
        try {
            await document.exitFullscreen?.()
        } catch {
            // CSS layout restoration must also work if the browser rejects exit.
        } finally {
            if (pending) pending.nativeExits -= 1
            scheduleScrollRestore()
        }
    }, [scheduleScrollRestore])

    useEffect(() => {
        committedImmersive.current = isImmersive
        if (!isImmersive) scheduleScrollRestore()
    }, [isImmersive, scheduleScrollRestore])

    const updateViewport = useCallback(() => {
        if (!session.current || !rootRef.current) return
        const viewport = window.visualViewport
        rootRef.current.style.setProperty(HEIGHT, `${viewport?.height ?? window.innerHeight}px`)
        rootRef.current.style.setProperty(TOP, `${viewport?.offsetTop ?? 0}px`)
    }, [])

    const start = useCallback((automatic: boolean) => {
        if (session.current) {
            if (!automatic) session.current.automatic = false
            return
        }
        cancelAnimationFrame(restoreFrame.current)
        pendingScroll.current = null
        const root = rootRef.current
        const overflow = document.body.style.overflow
        const x = window.scrollX
        const y = window.scrollY
        const height = root?.style.getPropertyValue(HEIGHT) ?? ""
        const top = root?.style.getPropertyValue(TOP) ?? ""
        session.current = {
            automatic,
            scroll: { left: x, top: y },
            restore: () => {
                // Do not overwrite an overflow value another owner changed meanwhile.
                if (document.body.style.overflow === "hidden") document.body.style.overflow = overflow
                for (const [property, value] of [[HEIGHT, height], [TOP, top]]) {
                    if (value) root?.style.setProperty(property, value)
                    else root?.style.removeProperty(property)
                }
            },
        }
        document.body.style.overflow = "hidden"
        setIsImmersive(true)
        updateViewport()
    }, [updateViewport])

    const clear = useCallback((restoreScroll = true) => {
        epoch.current += 1
        const previous = session.current
        session.current = null
        nativeOwned.current = false
        cancelAnimationFrame(restoreFrame.current)
        previous?.restore()
        if (!restoreScroll) pendingScroll.current = null
        else if (previous) pendingScroll.current = { ...previous.scroll, nativeExits: 0 }
    }, [])

    const exit = useCallback(() => {
        const root = rootRef.current
        clear()
        setIsImmersive(false)
        void leaveNativeFullscreen(root)
    }, [clear, leaveNativeFullscreen])

    const enter = useCallback(async () => {
        start(false)
        const requestEpoch = ++epoch.current
        const root = rootRef.current
        if (!root || document.fullscreenElement || !root.requestFullscreen) return
        try {
            await root.requestFullscreen({ navigationUI: "hide" })
            if (requestEpoch !== epoch.current) {
                if (!session.current && document.fullscreenElement === root) {
                    await leaveNativeFullscreen(root)
                }
                return
            }
            nativeOwned.current = document.fullscreenElement === root
        } catch {
            // CSS immersion remains usable when native fullscreen is unavailable.
        }
    }, [leaveNativeFullscreen, start])

    useEffect(() => {
        mounted.current = true
        const mountedRoot = rootRef.current
        const query = window.matchMedia(SHORT_LANDSCAPE)
        let wasLandscape = false
        let rotationPending = false
        let rotationFrame = 0
        const evaluate = (rotation = false) => {
            const focused = document.activeElement
            const editing = focused instanceof HTMLElement && (
                focused.isContentEditable || focused.matches("input, textarea, [contenteditable='true']")
            )
            // A portrait keyboard can make the layout viewport look landscape.
            const landscape = query.matches
            if (landscape && !wasLandscape) {
                if (editing && !rotation && !session.current) return
                start(true)
            }
            if (!landscape && session.current?.automatic) exit()
            wasLandscape = landscape
        }
        const onGeometryChange = () => {
            updateViewport()
            evaluate(rotationPending)
        }
        const onRotation = () => {
            rotationPending = true
            evaluate(true)
            cancelAnimationFrame(rotationFrame)
            // Some browsers report orientation before updating their media queries.
            rotationFrame = requestAnimationFrame(() => {
                updateViewport()
                evaluate(true)
                rotationPending = false
            })
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !event.defaultPrevented && session.current) exit()
        }
        const onFullscreenChange = () => {
            if (rootRef.current && document.fullscreenElement === rootRef.current) {
                if (session.current) nativeOwned.current = true
                else void leaveNativeFullscreen(rootRef.current)
            } else if (nativeOwned.current) exit()
        }
        evaluate()
        query.addEventListener("change", onGeometryChange)
        window.addEventListener("resize", onGeometryChange)
        window.addEventListener("orientationchange", onRotation)
        window.screen.orientation?.addEventListener("change", onRotation)
        window.visualViewport?.addEventListener("resize", updateViewport)
        window.visualViewport?.addEventListener("scroll", updateViewport)
        document.addEventListener("keydown", onKeyDown)
        document.addEventListener("fullscreenchange", onFullscreenChange)
        return () => {
            cancelAnimationFrame(rotationFrame)
            query.removeEventListener("change", onGeometryChange)
            window.removeEventListener("resize", onGeometryChange)
            window.removeEventListener("orientationchange", onRotation)
            window.screen.orientation?.removeEventListener("change", onRotation)
            window.visualViewport?.removeEventListener("resize", updateViewport)
            window.visualViewport?.removeEventListener("scroll", updateViewport)
            document.removeEventListener("keydown", onKeyDown)
            document.removeEventListener("fullscreenchange", onFullscreenChange)
            mounted.current = false
            clear(false)
            void leaveNativeFullscreen(mountedRoot)
        }
    }, [clear, exit, leaveNativeFullscreen, start, updateViewport])

    return { rootRef, isImmersive, enter, exit }
}
