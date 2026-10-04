export const TUTOR_FAB_POSITION_STORAGE_KEY = 'xiaodi:fab-position:v1'
export const TUTOR_FAB_DRAG_THRESHOLD_PX = 10
export const TUTOR_FAB_MOBILE_BREAKPOINT_PX = 768
export const TUTOR_FAB_CLOSED_SIZE_PX = 80
export const TUTOR_FAB_DOCK_IDLE_MS = 3000

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
  bottomInset = 0,
): TutorFabPosition {
  const maxRight = Math.max(EDGE_PADDING_PX, viewportWidth - fabSizePx - EDGE_PADDING_PX)
  const safeBottomInset = Math.max(0, bottomInset)
  const maxBottom = Math.max(EDGE_PADDING_PX, viewportHeight - fabSizePx - EDGE_PADDING_PX)
  const minBottom = Math.min(EDGE_PADDING_PX + safeBottomInset, maxBottom)
  return {
    right: Math.min(maxRight, Math.max(EDGE_PADDING_PX, position.right)),
    bottom: Math.min(maxBottom, Math.max(minBottom, position.bottom)),
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

/** Pixel translation needed to place the full FAB flush against the selected viewport edge. */
export function getTutorFabDockTranslateX(
  edge: TutorFabDockEdge,
  position: TutorFabPosition,
  fabSizePx: number,
  viewportWidth: number,
): number {
  const edgeRight = edge === 'right' ? 0 : Math.max(0, viewportWidth - fabSizePx)
  // CSS translateX moves the box after `right` is applied; positive X
  // therefore decreases its computed right inset.
  return position.right - edgeRight
}

export function getTutorFabDockTransform(
  edge: TutorFabDockEdge,
  position: TutorFabPosition,
  fabSizePx: number,
  viewportWidth: number,
): string {
  return `translateX(${getTutorFabDockTranslateX(edge, position, fabSizePx, viewportWidth)}px)`
}

/**
 * Voice-hint / feedback bubble stays inside the viewport at the actual dock edge.
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
    return { left: BUBBLE_MIN_INSET_PX, right: 'auto' }
  }

  if (options.docked && options.edge === 'right') return { right: BUBBLE_MIN_INSET_PX }
  return { right: baseRight }
}
