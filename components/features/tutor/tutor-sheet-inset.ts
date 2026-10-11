/** Measure bottom obstructions in layout-viewport coordinates, without mutating the DOM. */
export function measureTutorSheetBottomInset(doc: Document, viewportHeight: number): number {
  const view = doc.defaultView
  if (!view || !doc.body || viewportHeight <= 0) return 0
  const viewportWidth = doc.documentElement.clientWidth || view.innerWidth
  const styles = new Map<Element, CSSStyleDeclaration>()
  const styleFor = (element: Element) => {
    let style = styles.get(element)
    if (!style) {
      style = view.getComputedStyle(element)
      styles.set(element, style)
    }
    return style
  }
  let inset = 0
  for (const element of doc.body.querySelectorAll('*')) {
    if (element.closest('section[role="dialog"], [data-tutor-ui]')) continue
    const style = styleFor(element)
    if (style.position !== 'fixed' && style.position !== 'sticky') continue
    if (style.pointerEvents === 'none') continue
    const rect = element.getBoundingClientRect()
    if (rect.width < viewportWidth * 0.5 || rect.height <= 0 || rect.height > viewportHeight * 0.4) continue
    if (rect.bottom < viewportHeight - 12 || rect.top >= viewportHeight || rect.right <= 0 || rect.left >= viewportWidth) continue
    let visible = true
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      const ancestorStyle = styleFor(ancestor)
      if (ancestorStyle.display === 'none' || ancestorStyle.visibility === 'hidden' || ancestorStyle.visibility === 'collapse' || ancestorStyle.opacity === '0') {
        visible = false
        break
      }
    }
    if (visible) inset = Math.max(inset, viewportHeight - rect.top)
  }
  return inset
}
