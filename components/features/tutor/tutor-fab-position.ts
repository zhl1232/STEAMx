export const TUTOR_FAB_POSITION_STORAGE_KEY = 'xiaodi:fab-position:v1'
export const TUTOR_FAB_DRAG_THRESHOLD_PX = 10
export const TUTOR_FAB_MOBILE_BREAKPOINT_PX = 768
export const TUTOR_FAB_CLOSED_SIZE_PX = 80
export const TUTOR_FAB_DOCK_IDLE_MS = 3000
/** Head-in perch: ~30% of the closed FAB stays in view; body sits mostly off-screen. */
export const TUTOR_FAB_DOCK_TRANSLATE_RATIO = 0.7
/** Clockwise on the right edge, counterclockwise on the left; within 12–18deg. */
export const TUTOR_FAB_DOCK_ROTATE_DEG = 15
export const TUTOR_FAB_DOCK_SCALE = 0.92
/** Pivot on the edge-adjacent head / upper body so rotation peeks the head in. */
export const TUTOR_FAB_DOCK_ORIGIN_RIGHT = '72% 18%'
export const TUTOR_FAB_DOCK_ORIGIN_LEFT = '28% 18%'

export type TutorFabPlacement = 'default' | 'compact'
export type TutorFabDockEdge = 'left' | 'right'

export type TutorFabPosition = {
  right: number
  bottom: number
}

export type TutorFabBubbleOffset = {
  right: number | 'auto'
  left?: number
}

const EDGE_PADDING_PX = 8
const BUBBLE_MIN_INSET_PX = 12

export function getDefaultTutorFabPosition(
  placement: TutorFabPlacement,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390,
): TutorFabPosition {
  const isMd = viewportWidth >= 768
  const right = isMd ? 24 : 16
  if (placement === 'compact') {
    return { right, bottom: isMd ? 96 : 16 }
  }
  return { right, bottom: isMd ? 24 : 136 }
}

export function clampTutorFabPosition(
  position: TutorFabPosition,
  fabSizePx: number,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390,
  viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 844,
): TutorFabPosition {
  const maxRight = Math.max(EDGE_PADDING_PX, viewportWidth - fabSizePx - EDGE_PADDING_PX)
  const maxBottom = Math.max(EDGE_PADDING_PX, viewportHeight - fabSizePx - EDGE_PADDING_PX)
  return {
    right: Math.min(maxRight, Math.max(EDGE_PADDING_PX, position.right)),
    bottom: Math.min(maxBottom, Math.max(EDGE_PADDING_PX, position.bottom)),
  }
}

export function readTutorFabPosition(): TutorFabPosition | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(TUTOR_FAB_POSITION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TutorFabPosition>
    if (typeof parsed.right !== 'number' || typeof parsed.bottom !== 'number') return null
    if (!Number.isFinite(parsed.right) || !Number.isFinite(parsed.bottom)) return null
    return { right: parsed.right, bottom: parsed.bottom }
  } catch {
    return null
  }
}

export function writeTutorFabPosition(position: TutorFabPosition) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TUTOR_FAB_POSITION_STORAGE_KEY, JSON.stringify(position))
  } catch {
    // ignore quota / private mode
  }
}

export function canTutorFabEdgeDock(open: boolean, viewportWidth: number) {
  return !open && viewportWidth < TUTOR_FAB_MOBILE_BREAKPOINT_PX
}

/** Nearer horizontal distance wins; a tie prefers the default right edge. */
export function resolveTutorFabDockEdge(
  position: TutorFabPosition,
  fabSizePx: number,
  viewportWidth: number,
): TutorFabDockEdge {
  const left = viewportWidth - position.right - fabSizePx
  return left < position.right ? 'left' : 'right'
}

export function getTutorFabDockTransform(edge: TutorFabDockEdge): string {
  const dir = edge === 'right' ? 1 : -1
  const translatePercent = Math.round(TUTOR_FAB_DOCK_TRANSLATE_RATIO * 100)
  return `translateX(${dir * translatePercent}%) rotate(${dir * TUTOR_FAB_DOCK_ROTATE_DEG}deg) scale(${TUTOR_FAB_DOCK_SCALE})`
}

export function getTutorFabDockTransformOrigin(edge: TutorFabDockEdge): string {
  return edge === 'right' ? TUTOR_FAB_DOCK_ORIGIN_RIGHT : TUTOR_FAB_DOCK_ORIGIN_LEFT
}

function dockVisibleStubPx(fabSizePx: number) {
  const peekPx = Math.round(fabSizePx * TUTOR_FAB_DOCK_TRANSLATE_RATIO)
  return Math.max(0, fabSizePx - peekPx)
}

/**
 * Voice-hint / feedback bubble stays aligned with the visible stub.
 * Dock translate is visual-only and must not be written to storage.
 */
export function getTutorFabBubbleOffset(
  position: TutorFabPosition,
  fabSizePx: number,
  options: {
    docked: boolean
    edge: TutorFabDockEdge
    viewportWidth: number
  },
): TutorFabBubbleOffset {
  const baseRight = Math.max(BUBBLE_MIN_INSET_PX, position.right - 4)

  if (options.docked && options.edge === 'left') {
    const visiblePx = dockVisibleStubPx(fabSizePx)
    return {
      left: Math.max(EDGE_PADDING_PX, Math.round(visiblePx * 0.28)),
      right: 'auto',
    }
  }

  const extra = options.docked && options.edge === 'right' ? Math.round(dockVisibleStubPx(fabSizePx) * 0.4) : 0
  return { right: baseRight + extra }
}
