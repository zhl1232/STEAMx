"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

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

/**
 * 同源 iframe 嵌入 3D 课本。协议见 docs/textbook3d.md：
 * 子页发 steamx-textbook-ready/height/progress/complete，父页发 height-request/goto。
 */
export default function TextbookFrame({ lessonId, src, title, onComplete }: { lessonId: string; src: string; title: string; onComplete?: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(640)
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [complete, setComplete] = useState(false)
  const completeRef = useRef(onComplete)
  useEffect(() => { completeRef.current = onComplete }, [onComplete])
  // 只在课本真正可见（接近视口且没被 display:none 隐藏）时才创建 iframe：
  // 项目页同时渲染电脑版和手机版两套布局，不这样做会开两个 WebGL，也会多下一遍运行时。
  const box = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
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
  }, [])

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return
      const message = event.data
      if (message?.version !== 1 || message.lesson !== lessonId || typeof message.type !== "string") return
      if (message.type === "steamx-textbook-ready") setReady(true)
      if (message.type === "steamx-textbook-height") {
        const next = clampTextbookHeight(message.height)
        if (next) setHeight(next)
        setReady(true)
      }
      if (message.type === "steamx-textbook-progress" && Number.isInteger(message.page) && Number.isInteger(message.pages) && message.pages > 0) {
        setReady(true)
        setProgress({ page: message.page, pages: message.pages })
      }
      if (message.type === "steamx-textbook-complete") {
        setComplete((done) => {
          if (!done) completeRef.current?.()
          return true
        })
      }
    }
    window.addEventListener("message", receive)
    // iframe 可能在水合前就加载完，错过 onLoad；挂载后再要一次高度。
    requestHeight(frame.current?.contentWindow)
    return () => window.removeEventListener("message", receive)
  }, [lessonId, shown])

  return (
    <div ref={box} className="overflow-hidden border-y bg-card md:rounded-lg md:border">
      <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2 text-base" role="status">
        {!ready ? (
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
            <CheckCircle2 aria-hidden className="h-5 w-5" />挑战完成
          </span>
        )}
      </div>
      {shown ? <iframe
        ref={frame}
        src={src}
        title={title}
        allow="fullscreen"
        onLoad={(event) => requestHeight(event.currentTarget.contentWindow)}
        className="block w-full border-0 bg-[#f4ecd9]"
        style={{ height }}
      /> : <div aria-hidden className="w-full bg-[#f4ecd9]" style={{ height }} />}
    </div>
  )
}
