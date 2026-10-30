/** One scheduled frame at most. Idle, hidden and disposed scenes do no work. */
export function createDemandRenderer(
  draw: () => void,
  clock: { request: (callback: FrameRequestCallback) => number; cancel: (id: number) => void } = {
    request: (callback) => requestAnimationFrame(callback),
    cancel: (id) => cancelAnimationFrame(id),
  },
) {
  let pending: number | null = null
  let visible = true
  let disposed = false
  let dirty = false
  function invalidate() {
    if (disposed) return
    dirty = true
    if (!visible || pending !== null) return
    pending = clock.request(() => {
      pending = null
      if (disposed || !visible) return
      dirty = false
      draw()
    })
  }
  return {
    invalidate,
    setVisible(next: boolean) {
      if (disposed || next === visible) return
      visible = next
      if (!visible && pending !== null) { clock.cancel(pending); pending = null }
      if (visible && dirty) invalidate()
    },
    dispose() {
      disposed = true
      if (pending !== null) clock.cancel(pending)
      pending = null
    },
    get pending() { return pending !== null },
  }
}
