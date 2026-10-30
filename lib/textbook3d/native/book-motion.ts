export type BookPage = 0 | 1
export type BookPose = { page: BookPage; fold: number; leafAngle: number; turning: boolean }
export const BOOK_TURN_MS = 820
const clamp = (value: number) => Math.min(1, Math.max(0, value))
const ease = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }

/** A finite timeline driven by the scene's one demand-render RAF, never its own loop. */
export function createBookMotion(initialPage: BookPage, apply: (pose: BookPose) => void, onBusy: (busy: boolean) => void) {
  let page = initialPage
  let transition: { from: BookPage; to: BookPage; start: number } | null = null
  let disposed = false
  function finish() {
    if (disposed) return
    const wasTurning = transition !== null
    if (transition) page = transition.to
    transition = null
    apply({ page, fold: 1, leafAngle: 0, turning: false })
    if (wasTurning) onBusy(false)
  }
  return {
    turnTo(next: BookPage, now: number, reducedMotion: boolean) {
      if (disposed || transition || next === page) return false
      transition = { from: page, to: next, start: now }
      if (reducedMotion) { finish(); return true }
      onBusy(true)
      return true
    },
    update(now: number) {
      if (disposed || !transition) return false
      const progress = clamp((now - transition.start) / BOOK_TURN_MS)
      if (progress >= 1) { finish(); return false }
      const turn = ease((progress - 0.18) / 0.54)
      apply({
        page: progress < 0.5 ? transition.from : transition.to,
        fold: progress < 0.18 ? 1 - ease(progress / 0.18) : ease((progress - 0.72) / 0.28),
        leafAngle: (transition.to > transition.from ? turn : 1 - turn) * Math.PI,
        turning: progress >= 0.18 && progress <= 0.72,
      })
      return true
    },
    finish,
    get busy() { return transition !== null },
    get page() { return transition?.to ?? page },
    dispose() { disposed = true; transition = null },
  }
}
