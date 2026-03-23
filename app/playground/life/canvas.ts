export type CanvasMetrics = {
    cssWidth: number
    cssHeight: number
    pixelWidth: number
    pixelHeight: number
    cellWidth: number
    cellHeight: number
    dpr: number
}

export function getCanvasMetrics(
    containerWidth: number,
    rows: number,
    cols: number,
    devicePixelRatio = 1,
): CanvasMetrics {
    const cssWidth = Math.max(containerWidth, 1)
    const cssHeight = cssWidth * (rows / cols)
    const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1

    return {
        cssWidth,
        cssHeight,
        pixelWidth: Math.round(cssWidth * dpr),
        pixelHeight: Math.round(cssHeight * dpr),
        cellWidth: cssWidth / cols,
        cellHeight: cssHeight / rows,
        dpr,
    }
}
