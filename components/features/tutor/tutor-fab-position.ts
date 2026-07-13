export const TUTOR_FAB_POSITION_STORAGE_KEY = 'xiaodi:fab-position:v1'
export const TUTOR_FAB_DRAG_THRESHOLD_PX = 10

export type TutorFabPlacement = 'default' | 'compact'

export type TutorFabPosition = {
  right: number
  bottom: number
}

const EDGE_PADDING_PX = 8

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
