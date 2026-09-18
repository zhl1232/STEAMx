import { describe, expect, it } from 'vitest'

import {
  canTutorFabEdgeDock,
  clampTutorFabPosition,
  getDefaultTutorFabPosition,
  getTutorFabBubbleOffset,
  getTutorFabDockTransform,
  getTutorFabDockTransformOrigin,
  resolveTutorFabDockEdge,
  TUTOR_FAB_DOCK_TRANSLATE_RATIO,
} from '@/components/features/tutor/tutor-fab-position'

describe('tutor fab position', () => {
  it('uses taller mobile default for playground bottom nav', () => {
    expect(getDefaultTutorFabPosition('default', 390)).toEqual({ right: 16, bottom: 136 })
    expect(getDefaultTutorFabPosition('compact', 390)).toEqual({ right: 16, bottom: 16 })
  })

  it('clamps inside the viewport', () => {
    expect(clampTutorFabPosition({ right: -20, bottom: 9999 }, 80, 390, 700)).toEqual({
      right: 8,
      bottom: 612,
    })
  })

  it('only edge-docks on closed mobile viewports', () => {
    expect(canTutorFabEdgeDock(false, 390)).toBe(true)
    expect(canTutorFabEdgeDock(false, 767)).toBe(true)
    expect(canTutorFabEdgeDock(false, 768)).toBe(false)
    expect(canTutorFabEdgeDock(true, 390)).toBe(false)
  })

  it('picks the nearer horizontal edge for mobile perch', () => {
    expect(resolveTutorFabDockEdge({ right: 16, bottom: 136 }, 80, 390)).toBe('right')
    expect(resolveTutorFabDockEdge({ right: 302, bottom: 136 }, 80, 390)).toBe('left')
    expect(resolveTutorFabDockEdge({ right: 155, bottom: 136 }, 80, 390)).toBe('right')
    expect(resolveTutorFabDockEdge({ right: 156, bottom: 136 }, 80, 390)).toBe('left')
  })

  it('does not let a docked visual offset leak into stored clamp coordinates', () => {
    const fullRight = { right: 16, bottom: 136 }
    expect(clampTutorFabPosition(fullRight, 80, 390, 700)).toEqual(fullRight)

    const peekPx = Math.round(80 * TUTOR_FAB_DOCK_TRANSLATE_RATIO)
    const leakedRight = clampTutorFabPosition(
      { right: fullRight.right - peekPx, bottom: fullRight.bottom },
      80,
      390,
      700,
    )
    expect(leakedRight.right).toBe(8)
    expect(leakedRight.bottom).toBe(136)

    const fullLeft = { right: 302, bottom: 136 }
    expect(clampTutorFabPosition(fullLeft, 80, 390, 700)).toEqual(fullLeft)

    const leakedLeft = clampTutorFabPosition(
      { right: fullLeft.right + peekPx, bottom: fullLeft.bottom },
      80,
      390,
      700,
    )
    expect(leakedLeft.right).toBe(302)
    expect(leakedLeft.bottom).toBe(136)
  })

  it('perches the mascot head-in on the nearer edge', () => {
    expect(TUTOR_FAB_DOCK_TRANSLATE_RATIO).toBeGreaterThanOrEqual(0.62)
    expect(TUTOR_FAB_DOCK_TRANSLATE_RATIO).toBeLessThanOrEqual(0.72)
    expect(getTutorFabDockTransform('right')).toBe('translateX(70%) rotate(15deg) scale(0.92)')
    expect(getTutorFabDockTransform('left')).toBe('translateX(-70%) rotate(-15deg) scale(0.92)')
    expect(getTutorFabDockTransformOrigin('right')).toBe('72% 18%')
    expect(getTutorFabDockTransformOrigin('left')).toBe('28% 18%')
  })

  it('keeps a left-docked voice bubble on-screen over the visible stub', () => {
    expect(
      getTutorFabBubbleOffset({ right: 302, bottom: 136 }, 80, {
        docked: true,
        edge: 'left',
        viewportWidth: 390,
      }),
    ).toEqual({ left: 8, right: 'auto' })
  })

  it('keeps a right-docked voice bubble aligned with the visible stub', () => {
    expect(
      getTutorFabBubbleOffset({ right: 16, bottom: 136 }, 80, {
        docked: true,
        edge: 'right',
        viewportWidth: 390,
      }),
    ).toEqual({ right: 22 })
  })

  it('does not shift the bubble when the fab is not docked', () => {
    expect(
      getTutorFabBubbleOffset({ right: 16, bottom: 136 }, 80, {
        docked: false,
        edge: 'right',
        viewportWidth: 390,
      }),
    ).toEqual({ right: 12 })
  })
})
