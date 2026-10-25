import type { FunctionWarsCoverRect } from "./renderer"

/** Convert visible HUD boxes into canvas-local CSS pixels for label placement. */
export function readFunctionWarsLabelExclusions(canvas: HTMLCanvasElement): FunctionWarsCoverRect[] {
    const root = canvas.closest(".function-wars-page")
    if (!root) return []
    const viewport = canvas.getBoundingClientRect()
    if (viewport.width <= 0 || viewport.height <= 0) return []

    const selectors = [
        ".function-wars-immersive-toggle",
        ".function-wars-operations-trigger",
        ".function-wars-immersive-status",
        ".function-wars-online-status",
        ".function-wars-input-error",
        ".function-wars-mission-chips",
        ".function-wars-feedback",
        ".function-wars-weapon-notice",
        ".function-wars-obstacle-legend",
    ].join(",")
    return Array.from(root.querySelectorAll<HTMLElement>(selectors)).flatMap((element) => {
        const rect = element.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return []
        const left = Math.max(0, rect.left - viewport.left)
        const top = Math.max(0, rect.top - viewport.top)
        const right = Math.min(viewport.width, rect.right - viewport.left)
        const bottom = Math.min(viewport.height, rect.bottom - viewport.top)
        return right > left && bottom > top
            ? [{ x: left, y: top, width: right - left, height: bottom - top }]
            : []
    })
}
