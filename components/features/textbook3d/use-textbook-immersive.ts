"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type ImmersiveSession = { element: HTMLElement; exit: () => void }
// Desktop/mobile readers can coexist in the project DOM. Only one may own the
// document locks, including before React has committed its state update.
let activeSession: ImmersiveSession | null = null

function isLayoutVisible(element: HTMLElement) {
  if (!element.isConnected) return false
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = window.getComputedStyle(node)
    if (node.hidden || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false
  }
  return true
}

function restoreFocus(button: HTMLButtonElement | null) {
  if (!button?.isConnected) return
  if (isLayoutVisible(button) && !button.closest("[inert]")) {
    button.focus({ preventScroll: true })
    return
  }
  // Rotation can hide the return button. Move focus out of that hidden branch.
  let target: HTMLElement | null = button.parentElement
  while (target && (!isLayoutVisible(target) || target.closest("[inert]"))) target = target.parentElement
  if (!target) return
  const tabIndex = target.getAttribute("tabindex")
  target.setAttribute("tabindex", "-1")
  target.focus({ preventScroll: true })
  if (tabIndex === null) target.removeAttribute("tabindex")
  else target.setAttribute("tabindex", tabIndex)
}

/** Shared by the native reader and legacy iframe. Never remounts their canvas. */
export function useTextbookImmersive() {
  const box = useRef<HTMLDivElement>(null)
  const fullscreenButton = useRef<HTMLButtonElement>(null)
  const [session, setSession] = useState<ImmersiveSession | null>(null)
  const immersive = session !== null
  const immersiveRequested = useRef(false)
  const fullscreenRequest = useRef(0)
  const nativeSession = useRef(false)
  const releaseLocks = useRef<(() => void) | null>(null)
  const exitImmersive = useCallback(() => {
    immersiveRequested.current = false
    fullscreenRequest.current += 1
    nativeSession.current = false
    // Synchronous release matters when the now-visible sibling enters before
    // the old instance's React effect cleanup runs.
    releaseLocks.current?.()
    if (activeSession?.element === box.current) activeSession = null
    setSession(null)
    if (document.fullscreenElement === box.current) {
      void document.exitFullscreen?.().catch(() => undefined)
    }
  }, [])

  const enterImmersive = async () => {
    const element = box.current
    if (!element || !isLayoutVisible(element) || immersiveRequested.current) return
    if (activeSession && activeSession.element !== element) {
      if (isLayoutVisible(activeSession.element)) return
      activeSession.exit()
    }
    // Respect unrelated dialogs and pre-existing inert ancestors.
    if (element.closest("[inert]")) return
    const request = ++fullscreenRequest.current
    immersiveRequested.current = true
    const nextSession = { element, exit: exitImmersive }
    activeSession = nextSession
    setSession(nextSession)
    try {
      await element.requestFullscreen?.({ navigationUI: "hide" })
      // 原生请求可能在退出或切课后才完成，不能重新打开已结束的会话。
      if (request !== fullscreenRequest.current && !immersiveRequested.current && document.fullscreenElement === element) {
        await document.exitFullscreen?.()
      }
    } catch {
      // 保留页面内全屏：iPhone 等没有元素全屏 API 的浏览器也能使用。
    }
  }

  useEffect(() => {
    const element = box.current
    const onFullscreenChange = () => {
      if (document.fullscreenElement === element) {
        if (!immersiveRequested.current) {
          void document.exitFullscreen?.().catch(() => undefined)
          return
        }
        nativeSession.current = true
      } else if (nativeSession.current) exitImmersive()
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      immersiveRequested.current = false
      fullscreenRequest.current += 1
      releaseLocks.current?.()
      if (activeSession?.element === element) activeSession = null
      if (document.fullscreenElement === element) void document.exitFullscreen?.().catch(() => undefined)
    }
  }, [exitImmersive])

  useEffect(() => {
    if (!session || activeSession !== session) return
    const element = session.element
    // The external layout may change between the input event and this effect.
    // oxlint-disable-next-line react/set-state-in-effect
    if (!isLayoutVisible(element)) { exitImmersive(); return }
    const scroll = { top: window.scrollY, left: window.scrollX }
    const previousBodyOverflow = document.body.style.overflow
    const previousRootOverflow = document.documentElement.style.overflow
    const button = fullscreenButton.current
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"
    // 保留同一个 iframe/WebGL；只让课本外的内容暂时不可聚焦。
    const siblings = new Map<HTMLElement, boolean>()
    let node: HTMLElement | null = element
    while (node && node !== document.body) {
      for (const sibling of node.parentElement?.children ?? []) {
        if (sibling !== node && sibling instanceof HTMLElement) {
          siblings.set(sibling, sibling.hasAttribute("inert"))
          sibling.setAttribute("inert", "")
        }
      }
      node = node.parentElement
    }
    let released = false
    const checkLayout = () => {
      if (!released && !isLayoutVisible(element)) exitImmersive()
    }
    const resize = typeof ResizeObserver === "function" ? new ResizeObserver(checkLayout) : null
    resize?.observe(element)
    const mutation = new MutationObserver(checkLayout)
    // Class/style changes can hide an ancestor without a viewport resize.
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      mutation.observe(ancestor, { attributes: true, attributeFilter: ["class", "style", "hidden"] })
    }
    window.addEventListener("resize", checkLayout)
    window.addEventListener("orientationchange", checkLayout)
    window.visualViewport?.addEventListener("resize", checkLayout)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) exitImmersive()
    }
    document.addEventListener("keydown", onKeyDown)
    button?.focus({ preventScroll: true })
    const release = () => {
      if (released) return
      released = true
      resize?.disconnect()
      mutation.disconnect()
      window.removeEventListener("resize", checkLayout)
      window.removeEventListener("orientationchange", checkLayout)
      window.visualViewport?.removeEventListener("resize", checkLayout)
      document.removeEventListener("keydown", onKeyDown)
      siblings.forEach((inert, sibling) => { if (!inert) sibling.removeAttribute("inert") })
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousRootOverflow
      window.scrollTo?.({ ...scroll, behavior: "instant" })
      restoreFocus(button)
      if (releaseLocks.current === release) releaseLocks.current = null
    }
    releaseLocks.current = release
    return () => {
      release()
      if (activeSession === session) activeSession = null
    }
  }, [session, exitImmersive])

  return { box, fullscreenButton, immersive, immersiveRequested, enterImmersive, exitImmersive }
}
