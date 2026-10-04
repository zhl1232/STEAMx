import { describe, expect, it } from 'vitest'

import {
  canTutorFabEdgeDock,
  clampTutorFabPosition,
  getDefaultTutorFabPosition,
  getTutorFabBubbleOffset,
  getTutorFabDockTransform,
  getTutorFabDockTranslateX,
  resolveTutorFabDockEdge,
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

  it('keeps a page footer clear when clamping a dragged position', () => {
    expect(clampTutorFabPosition({ right: 16, bottom: 0 }, 80, 390, 700, 76)).toEqual({
      right: 16,
      bottom: 84,
    })
    expect(clampTutorFabPosition({ right: 16, bottom: 9999 }, 80, 390, 700, 76).bottom).toBe(612)
  })

  it('keeps the FAB onscreen when the viewport cannot fit the footer inset', () => {
    expect(clampTutorFabPosition({ right: 16, bottom: 0 }, 80, 390, 100, 76)).toEqual({
      right: 16,
      bottom: 12,
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

  it.each([
    [320, { right: 16, bottom: 136 }, 'right', 16],
    [390, { right: 302, bottom: 136 }, 'left', -8],
    [767, { right: 607, bottom: 136 }, 'left', -80],
  ] as const)('anchors the full 80px FAB at the nearest edge (%dpx)', (viewportWidth, position, edge, expectedX) => {
    expect(getTutorFabDockTranslateX(edge, position, 80, viewportWidth)).toBe(expectedX)
    expect(getTutorFabDockTransform(edge, position, 80, viewportWidth)).toBe(`translateX(${expectedX}px)`)
  })

  it('supports a custom middle position without changing the persisted base', () => {
    const position = { right: 120, bottom: 204 }
    expect(resolveTutorFabDockEdge(position, 80, 390)).toBe('right')
    expect(getTutorFabDockTranslateX('right', position, 80, 390)).toBe(120)
    expect(clampTutorFabPosition(position, 80, 390, 700)).toEqual(position)
  })

  it('keeps a left-docked voice bubble on-screen over the visible stub', () => {
    expect(
      getTutorFabBubbleOffset({ right: 302, bottom: 136 }, 80, {
        docked: true,
        edge: 'left',
        viewportWidth: 390,
      }),
    ).toEqual({ left: 12, right: 'auto' })
  })

  it('keeps a right-docked voice bubble aligned with the visible stub', () => {
    expect(
      getTutorFabBubbleOffset({ right: 16, bottom: 136 }, 80, {
        docked: true,
        edge: 'right',
        viewportWidth: 390,
      }),
    ).toEqual({ right: 12 })
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
