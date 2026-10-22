/** 手机看课件：横竖屏判断、双指缩放、左右滑翻页的纯函数（便于单测）。 */

export const SLIDE_MIN_ZOOM = 1
export const SLIDE_MAX_ZOOM = 4
/** 滑动超过这个距离（px）才算翻页 */
export const SWIPE_THRESHOLD_PX = 48

export const PORTRAIT_PHONE_QUERY = "(orientation: portrait) and (max-width: 767px)"
/** 横着拿的手机：横屏、高度很矮、且有触屏（粗指针）。加触屏条件是为了不把矮窗口的电脑当成手机。 */
export const LANDSCAPE_PHONE_QUERY = "(orientation: landscape) and (max-height: 600px) and (any-pointer: coarse)"

export type Point = { x: number; y: number }

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return SLIDE_MIN_ZOOM
  return Math.min(SLIDE_MAX_ZOOM, Math.max(SLIDE_MIN_ZOOM, scale))
}

export function pointerDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** 双指缩放：按两指距离变化比例缩放 */
export function pinchScale(startScale: number, startDistance: number, currentDistance: number): number {
  if (startDistance <= 0) return clampZoom(startScale)
  return clampZoom(startScale * (currentDistance / startDistance))
}

/**
 * 放大后拖动的边界：图片放大 scale 倍后，最多能拖动 (scale-1)/2 个容器宽/高，
 * 避免拖出空白。
 */
export function clampPan(offset: Point, scale: number, size: { width: number; height: number }): Point {
  const maxX = ((scale - 1) * size.width) / 2
  const maxY = ((scale - 1) * size.height) / 2
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  }
}

/**
 * 左右滑翻页：没放大时、横向位移够大且明显大于纵向时才翻。
 * 返回 1 = 下一页（向左滑），-1 = 上一页（向右滑），0 = 不翻。
 */
export function swipePageDelta(start: Point, end: Point, scale: number): -1 | 0 | 1 {
  if (scale > SLIDE_MIN_ZOOM + 0.01) return 0
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return 0
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return 0
  return dx < 0 ? 1 : -1
}

/** 第一次竖屏看课件的「横过来看更清楚」轻提示只弹一次 */
export const ROTATE_TIP_STORAGE_KEY = "steamx:lesson-rotate-tip-shown"

/** 是否该显示「横过来看更清楚」提示 */
export function shouldShowRotateHint(input: {
  isPortraitPhone: boolean
  isImmersive: boolean
  isSlidePage: boolean
  dismissed: boolean
}): boolean {
  return input.isPortraitPhone && !input.isImmersive && input.isSlidePage && !input.dismissed
}

/** 手机从竖屏转到横屏时，是否自动进入全屏 */
export function shouldAutoEnterImmersive(input: {
  wasPortrait: boolean
  isLandscapePhone: boolean
  isImmersive: boolean
  isSlidePage: boolean
  /** 打开页面时手机已经是横着的（还没自动进入过一次） */
  isFirstLandscapeLoad?: boolean
}): boolean {
  return (input.wasPortrait || input.isFirstLandscapeLoad === true)
    && input.isLandscapePhone && !input.isImmersive && input.isSlidePage
}

/** 全屏时点按位置：左边 25% = 上一页，右边 25% = 下一页，中间 = 显示/隐藏控制条 */
export const EDGE_TAP_RATIO = 0.25
export const OVERLAY_AUTO_HIDE_MS = 3000
export const PAGE_INDICATOR_MS = 1200

export function tapZoneAction(xRatio: number, zoomed: boolean): "prev" | "next" | "toggle" {
  // 放大时点按只切换控制条，不翻页
  if (zoomed) return "toggle"
  if (xRatio < EDGE_TAP_RATIO) return "prev"
  if (xRatio > 1 - EDGE_TAP_RATIO) return "next"
  return "toggle"
}

/** 键盘翻页：← 上一页，→ 下一页；在输入框/可编辑区域里或按着修饰键时不翻 */
export function keyboardPageDelta(event: {
  key: string
  target?: EventTarget | null
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  defaultPrevented?: boolean
}): -1 | 0 | 1 {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return 0
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return 0
  const target = event.target as (HTMLElement & { isContentEditable?: boolean }) | null | undefined
  const tag = target && typeof target === "object" && "tagName" in target ? String(target.tagName).toUpperCase() : ""
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return 0
  if (target && typeof (target as HTMLElement).closest === "function" && (target as HTMLElement).closest('[role="slider"],[contenteditable="true"]')) return 0
  return event.key === "ArrowLeft" ? -1 : 1
}
