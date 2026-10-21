/** 手机看课件：横竖屏判断、双指缩放、左右滑翻页的纯函数（便于单测）。 */

export const SLIDE_MIN_ZOOM = 1
export const SLIDE_MAX_ZOOM = 4
/** 滑动超过这个距离（px）才算翻页 */
export const SWIPE_THRESHOLD_PX = 48

export const PORTRAIT_PHONE_QUERY = "(orientation: portrait) and (max-width: 767px)"
export const LANDSCAPE_PHONE_QUERY = "(orientation: landscape) and (max-height: 600px)"

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
}): boolean {
  return input.wasPortrait && input.isLandscapePhone && !input.isImmersive && input.isSlidePage
}
