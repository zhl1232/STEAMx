"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { CheckCircle2, Loader2, Maximize2, Minimize2, RotateCcw } from "lucide-react"

import styles from "./textbook-frame.module.css"
import { useTextbookImmersive } from "./use-textbook-immersive"

/** 子页上报的高度只作参考，限制在合理范围内，避免异常值撑破页面。 */
export function clampTextbookHeight(height: unknown) {
  if (typeof height !== "number" || !Number.isFinite(height)) return null
  return Math.max(420, Math.min(1400, Math.ceil(height)))
}

function requestHeight(target: Window | null | undefined) {
  try {
    target?.postMessage({ type: "steamx-textbook-height-request", version: 1 }, window.location.origin)
  } catch {
    // 子页尚未导航到同源地址时忽略；加载完成后 onLoad 会再请求一次。
  }
}

type Progress = { page: number; pages: number }
type Props = { lessonId: string; src: string; title: string; onComplete?: () => void }

const PlantLesson = dynamic(() => import("./native/plant-lesson"), {
  ssr: false,
  loading: () => <div className="flex min-h-[640px] items-center justify-center bg-card" role="status">正在准备植物课本…</div>,
})

/**
 * 同源 iframe 嵌入 3D 课本。协议见 docs/textbook3d.md：
 * 子页发 steamx-textbook-ready/height/progress/complete，父页发 height-request/goto。
 */
export default function TextbookFrame(props: Props) {
  return <TextbookRenderer key={`${props.lessonId}:${props.src}`} {...props} />
}

function TextbookRenderer(props: Props) {
  const [legacy, setLegacy] = useState(false)
  if (props.lessonId !== "p1a-1-1") return <LegacyTextbookFrame {...props} />
  if (!legacy) return <PlantLesson title={props.title} onComplete={props.onComplete} onUseLegacy={() => setLegacy(true)} />
  return <>
    <button type="button" className="min-h-11 px-4 text-sm font-semibold text-primary underline underline-offset-4" onClick={() => setLegacy(false)}>返回新版植物课本</button>
    <LegacyTextbookFrame {...props} />
  </>
}

/** Explicit legacy fallback; also used by existing iframe protocol tests. */
export function LegacyTextbookFrame(props: Props) {
  return <TextbookFrameSession key={`${props.lessonId}:${props.src}`} {...props} />
}

function TextbookFrameSession({ lessonId, src, title, onComplete }: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(640)
  const [ready, setReady] = useState(false)
  const [failure, setFailure] = useState<"load" | "webgl" | null>(null)
  const [attempt, setAttempt] = useState(0)
  const childCleanup = useRef<(() => void) | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [complete, setComplete] = useState(false)
  const completed = useRef(false)
  const completeRef = useRef(onComplete)
  useEffect(() => { completeRef.current = onComplete }, [onComplete])
  // 只在课本真正可见（接近视口且没被 display:none 隐藏）时才创建 iframe：
  // 项目页同时渲染电脑版和手机版两套布局，不这样做会开两个 WebGL，也会多下一遍运行时。
  const [shown, setShown] = useState(false)

  const { box, fullscreenButton, immersive, immersiveRequested, enterImmersive, exitImmersive } = useTextbookImmersive()

  useEffect(() => () => childCleanup.current?.(), [])
  useEffect(() => { requestHeight(frame.current?.contentWindow) }, [immersive])

  function onFrameLoad() {
    childCleanup.current?.()
    childCleanup.current = null
    requestHeight(frame.current?.contentWindow)
    try {
      const child = frame.current?.contentWindow
      const body = child?.document.body
      if (!child || !body) return
      const checkWebGL = () => {
        if (body.classList.contains("nogl")) setFailure("webgl")
      }
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape" && !event.defaultPrevented && immersiveRequested.current) exitImmersive()
      }
      const onContextLost = () => setFailure("webgl")
      const onContextRestored = () => setFailure(null)
      const canvas = child.document.querySelector("canvas")
      const observer = new MutationObserver(checkWebGL)
      observer.observe(body, { attributes: true, attributeFilter: ["class"] })
      child.addEventListener("keydown", onKeyDown)
      canvas?.addEventListener("webglcontextlost", onContextLost)
      canvas?.addEventListener("webglcontextrestored", onContextRestored)
      checkWebGL()
      childCleanup.current = () => {
        observer.disconnect()
        child.removeEventListener("keydown", onKeyDown)
        canvas?.removeEventListener("webglcontextlost", onContextLost)
        canvas?.removeEventListener("webglcontextrestored", onContextRestored)
      }
    } catch {
      // 仅检查同源课本；导航/网络错误页交给载入超时处理。
    }
  }

  useEffect(() => {
    if (!shown || ready || failure) return
    const timer = window.setTimeout(() => setFailure("load"), 20_000)
    return () => window.clearTimeout(timer)
  }, [shown, ready, failure, attempt])
  useEffect(() => {
    const el = box.current
    if (!el || typeof window.IntersectionObserver !== "function") {
      setShown(true)
      return
    }
    const observer = new window.IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShown(true)
        observer.disconnect()
      }
    }, { rootMargin: "400px 0px" })
    observer.observe(el)
    return () => observer.disconnect()
  }, [box])

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return
      const message = event.data
      if (message?.version !== 1 || message.lesson !== lessonId || typeof message.type !== "string") return
      const markReady = () => {
        setReady(true)
        setFailure((current) => current === "load" ? null : current)
      }
      if (message.type === "steamx-textbook-ready") markReady()
      if (message.type === "steamx-textbook-height") {
        const next = clampTextbookHeight(message.height)
        if (next) setHeight(next)
      }
      if (message.type === "steamx-textbook-progress" && Number.isInteger(message.page) && Number.isInteger(message.pages) && message.pages > 0 && message.page >= 0 && message.page < message.pages) {
        markReady()
        setProgress({ page: message.page, pages: message.pages })
      }
      if (message.type === "steamx-textbook-complete") {
        if (completed.current) return
        completed.current = true
        setComplete(true)
        completeRef.current?.()
      }
    }
    window.addEventListener("message", receive)
    // iframe 可能在水合前就加载完，错过 onLoad；挂载后再要一次高度。
    requestHeight(frame.current?.contentWindow)
    return () => window.removeEventListener("message", receive)
  }, [lessonId, shown])

  return (
    <div ref={box} className={styles.frame} data-immersive={immersive || undefined}>
      <div className={styles.toolbar}>
        <div className={styles.status} role="status" aria-live="polite">
          {failure ? <span className="font-semibold">{failure === "webgl" ? "3D 画面暂不可用" : "课本还没有打开"}</span> :
          !ready ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 aria-hidden className="h-5 w-5 animate-spin motion-reduce:animate-none" />正在打开 3D 课本…
            </span>
          ) : progress ? (
            <span className="font-semibold text-foreground">第 {progress.page + 1} / {progress.pages} 页</span>
          ) : (
            <span className="font-semibold text-foreground">课本已打开</span>
          )}
          {complete && (
            <span className="flex items-center gap-1.5 font-semibold text-(--status-success)">
              <CheckCircle2 aria-hidden className="h-5 w-5" />{lessonId === "p1a-1-1" ? "已探索" : "挑战完成"}
            </span>
          )}
        </div>
        <button ref={fullscreenButton} type="button" className={styles.fullscreenButton} aria-pressed={immersive} onClick={immersive ? exitImmersive : enterImmersive}>
          {immersive ? <Minimize2 aria-hidden size={18} /> : <Maximize2 aria-hidden size={18} />}
          {immersive ? "退出全屏" : "全屏阅读"}
        </button>
      </div>
      <div className={styles.viewport} style={immersive ? undefined : { height }}>
        {shown ? <iframe key={attempt}
          ref={frame}
          src={src}
          title={title}
          allow="fullscreen"
          allowFullScreen
          onLoad={onFrameLoad}
          onError={() => setFailure("load")}
          className={styles.content}
          style={immersive ? undefined : { height }}
        /> : <div aria-hidden className={styles.content} />}
        {failure && <div className={styles.failure} role="alert">
          <p className="text-lg font-semibold">{failure === "webgl" ? "暂时无法显示 3D 画面" : "课本加载时间有点长"}</p>
          <p className="text-base text-muted-foreground">{failure === "webgl" ? "可以重试，或换用支持 WebGL 的浏览器打开。" : "请检查网络，再试一次。"}</p>
          <button type="button" className={styles.fullscreenButton} onClick={() => {
            childCleanup.current?.()
            childCleanup.current = null
            setReady(false)
            setFailure(null)
            setProgress(null)
            setAttempt((value) => value + 1)
          }}><RotateCcw aria-hidden size={18} />重新加载</button>
        </div>}
      </div>
    </div>
  )
}
