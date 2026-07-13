"use client"

import { useId, useMemo } from "react"

import { cn } from "@/lib/utils"

type PixelPalette = {
    background: string
    backgroundAccent: string
    main: string
    light: string
    shade: string
    glow: string
}

const PALETTES: Record<string, PixelPalette> = {
    plus: {
        background: "#eaf3ff",
        backgroundAccent: "#bfdbfe",
        main: "#3b82f6",
        light: "#93c5fd",
        shade: "#1d4ed8",
        glow: "rgba(59,130,246,0.32)",
    },
    smile: {
        background: "#fff8dc",
        backgroundAccent: "#fde68a",
        main: "#fbbf24",
        light: "#fde68a",
        shade: "#d97706",
        glow: "rgba(245,158,11,0.34)",
    },
    heart: {
        background: "#fff0f3",
        backgroundAccent: "#fecdd3",
        main: "#fb7185",
        light: "#fda4af",
        shade: "#be123c",
        glow: "rgba(244,63,94,0.34)",
    },
    tree: {
        background: "#edfcf4",
        backgroundAccent: "#bbf7d0",
        main: "#22c55e",
        light: "#86efac",
        shade: "#15803d",
        glow: "rgba(34,197,94,0.3)",
    },
    cat: {
        background: "#fff5e9",
        backgroundAccent: "#fed7aa",
        main: "#f97316",
        light: "#fdba74",
        shade: "#c2410c",
        glow: "rgba(249,115,22,0.3)",
    },
    castle: {
        background: "#f3f7fb",
        backgroundAccent: "#cbd5e1",
        main: "#94a3b8",
        light: "#cbd5e1",
        shade: "#475569",
        glow: "rgba(100,116,139,0.28)",
    },
    fish: {
        background: "#ecfeff",
        backgroundAccent: "#a5f3fc",
        main: "#06b6d4",
        light: "#67e8f9",
        shade: "#0e7490",
        glow: "rgba(6,182,212,0.3)",
    },
    robot: {
        background: "#f1f3ff",
        backgroundAccent: "#c7d2fe",
        main: "#818cf8",
        light: "#c7d2fe",
        shade: "#4f46e5",
        glow: "rgba(99,102,241,0.3)",
    },
    house: {
        background: "#fff7ed",
        backgroundAccent: "#fed7aa",
        main: "#fb923c",
        light: "#fdba74",
        shade: "#c2410c",
        glow: "rgba(234,88,12,0.28)",
    },
    duck: {
        background: "#fffbdf",
        backgroundAccent: "#fef08a",
        main: "#facc15",
        light: "#fef08a",
        shade: "#ca8a04",
        glow: "rgba(234,179,8,0.3)",
    },
    mug: {
        background: "#fff7ed",
        backgroundAccent: "#fed7aa",
        main: "#f97316",
        light: "#fdba74",
        shade: "#c2410c",
        glow: "rgba(234,88,12,0.28)",
    },
    star: {
        background: "#fffbea",
        backgroundAccent: "#fde68a",
        main: "#fbbf24",
        light: "#fef08a",
        shade: "#d97706",
        glow: "rgba(245,158,11,0.36)",
    },
    boat: {
        background: "#eff7ff",
        backgroundAccent: "#bfdbfe",
        main: "#60a5fa",
        light: "#dbeafe",
        shade: "#1d4ed8",
        glow: "rgba(37,99,235,0.28)",
    },
    "letter-a": {
        background: "#faf5ff",
        backgroundAccent: "#e9d5ff",
        main: "#a855f7",
        light: "#d8b4fe",
        shade: "#6b21a8",
        glow: "rgba(168,85,247,0.3)",
    },
    anchor: {
        background: "#eff6ff",
        backgroundAccent: "#bfdbfe",
        main: "#3b82f6",
        light: "#93c5fd",
        shade: "#1e3a8a",
        glow: "rgba(37,99,235,0.3)",
    },
    mushroom: {
        background: "#fff1f2",
        backgroundAccent: "#fecdd3",
        main: "#f43f5e",
        light: "#fda4af",
        shade: "#9f1239",
        glow: "rgba(244,63,94,0.3)",
    },
    crab: {
        background: "#fff7ed",
        backgroundAccent: "#fed7aa",
        main: "#ea580c",
        light: "#fdba74",
        shade: "#9a3412",
        glow: "rgba(234,88,12,0.3)",
    },
    ghost: {
        background: "#f8fafc",
        backgroundAccent: "#e2e8f0",
        main: "#94a3b8",
        light: "#cbd5e1",
        shade: "#475569",
        glow: "rgba(100,116,139,0.28)",
    },
    alien: {
        background: "#f0fdf4",
        backgroundAccent: "#bbf7d0",
        main: "#22c55e",
        light: "#86efac",
        shade: "#166534",
        glow: "rgba(34,197,94,0.3)",
    },
    skull: {
        background: "#fafafa",
        backgroundAccent: "#e7e5e4",
        main: "#a8a29e",
        light: "#d6d3d1",
        shade: "#57534e",
        glow: "rgba(120,113,108,0.28)",
    },
    rocket: {
        background: "#eef2ff",
        backgroundAccent: "#c7d2fe",
        main: "#6366f1",
        light: "#a5b4fc",
        shade: "#3730a3",
        glow: "rgba(99,102,241,0.3)",
    },
    owl: {
        background: "#fffbeb",
        backgroundAccent: "#fde68a",
        main: "#d97706",
        light: "#fbbf24",
        shade: "#92400e",
        glow: "rgba(217,119,6,0.3)",
    },
    dragon: {
        background: "#ecfdf5",
        backgroundAccent: "#a7f3d0",
        main: "#10b981",
        light: "#6ee7b7",
        shade: "#047857",
        glow: "rgba(16,185,129,0.3)",
    },
    temple: {
        background: "#faf5ff",
        backgroundAccent: "#e9d5ff",
        main: "#9333ea",
        light: "#c084fc",
        shade: "#6b21a8",
        glow: "rgba(147,51,234,0.3)",
    },
    spaceship: {
        background: "#ecfeff",
        backgroundAccent: "#a5f3fc",
        main: "#0891b2",
        light: "#67e8f9",
        shade: "#155e75",
        glow: "rgba(8,145,178,0.3)",
    },
    phoenix: {
        background: "#fff7ed",
        backgroundAccent: "#fed7aa",
        main: "#f97316",
        light: "#fdba74",
        shade: "#c2410c",
        glow: "rgba(249,115,22,0.32)",
    },
    labyrinth: {
        background: "#f8fafc",
        backgroundAccent: "#cbd5e1",
        main: "#64748b",
        light: "#94a3b8",
        shade: "#334155",
        glow: "rgba(71,85,105,0.28)",
    },
    galaxy: {
        background: "#0f172a",
        backgroundAccent: "#1e293b",
        main: "#38bdf8",
        light: "#7dd3fc",
        shade: "#0369a1",
        glow: "rgba(56,189,248,0.35)",
    },
}

const FALLBACK_PALETTE: PixelPalette = {
    background: "#f8fafc",
    backgroundAccent: "#cbd5e1",
    main: "#64748b",
    light: "#cbd5e1",
    shade: "#334155",
    glow: "rgba(71,85,105,0.24)",
}

export function filled(solution: number[][], row: number, col: number) {
    return solution[row]?.[col] === 1
}

function getSpecialPixelColor(levelId: string, row: number, col: number, size: number): string | null {
    if (levelId === "smile") {
        if (row === 0) return "#7c2d12"
        if (row === 2) return "#fb923c"
    }
    if (levelId === "tree" && row >= 3) return row === size - 1 ? "#78350f" : "#a16207"
    if (levelId === "cat" && row === 2 && col === Math.floor(size / 2)) return "#fb7185"
    if (levelId === "fish" && row === Math.floor(size / 2) && col === 0) return "#164e63"
    if (levelId === "robot" && row === 1 && col !== Math.floor(size / 2)) return "#22d3ee"
    if (levelId === "house") {
        if (row <= 3) return row === 3 ? "#c2410c" : "#f97316"
        if (col === Math.floor(size / 2)) return "#92400e"
        return "#fdba74"
    }
    if (levelId === "duck" && row === 2 && col === 1) return "#f97316"
    if (levelId === "mug" && col >= 5) return "#fb923c"
    if (levelId === "boat") {
        if (row <= 5) return col < size / 2 ? "#dbeafe" : "#93c5fd"
        return row === 8 ? "#93c5fd" : "#2563eb"
    }
    if (levelId === "mushroom" && row <= 3) return row % 2 === 0 ? "#fb7185" : "#fff1f2"
    if (levelId === "ghost" && row === 2) return "#1e293b"
    if (levelId === "alien" && row === 3) return "#14532d"
    if (levelId === "skull" && (row === 2 || row === 3)) return "#1c1917"
    if (levelId === "rocket" && row >= size - 2) return "#f97316"
    if (levelId === "owl" && row === 4) return "#1c1917"
    if (levelId === "phoenix" && (col <= 1 || col >= size - 2)) return "#ef4444"
    if (levelId === "galaxy") {
        if ((row + col) % 7 === 0) return "#f472b6"
        if ((row * 3 + col) % 11 === 0) return "#c4b5fd"
    }
    return null
}

function getPixelColor({
    levelId,
    solution,
    row,
    col,
    palette,
}: {
    levelId: string
    solution: number[][]
    row: number
    col: number
    palette: PixelPalette
}) {
    const size = solution.length
    const special = getSpecialPixelColor(levelId, row, col, size)
    if (special) return special

    const topExposed = !filled(solution, row - 1, col)
    const leftExposed = !filled(solution, row, col - 1)
    const bottomExposed = !filled(solution, row + 1, col)
    const rightExposed = !filled(solution, row, col + 1)

    if (topExposed || leftExposed) return palette.light
    if (bottomExposed || rightExposed) return palette.shade
    return palette.main
}

function PixelSparkle({
    x,
    y,
    size,
    color,
}: {
    x: number
    y: number
    size: number
    color: string
}) {
    return (
        <path
            d={`M ${x} ${y - size} L ${x + size * 0.28} ${y - size * 0.28} L ${x + size} ${y} L ${
                x + size * 0.28
            } ${y + size * 0.28} L ${x} ${y + size} L ${x - size * 0.28} ${y + size * 0.28} L ${
                x - size
            } ${y} L ${x - size * 0.28} ${y - size * 0.28} Z`}
            fill={color}
            opacity="0.72"
        />
    )
}

export function NonogramVictoryArt({
    levelId,
    solution,
    name,
    className,
}: {
    levelId: string
    solution: number[][]
    name: string
    className?: string
}) {
    const uid = useId().replace(/:/g, "")
    const palette = PALETTES[levelId] ?? FALLBACK_PALETTE
    const size = solution.length
    const backdropId = `nonogram-backdrop-${uid}`
    const gridId = `nonogram-grid-${uid}`

    const pixels = useMemo(
        () =>
            solution.flatMap((row, rowIndex) =>
                row.flatMap((bit, colIndex) => {
                    if (bit !== 1) return []
                    return [
                        {
                            row: rowIndex,
                            col: colIndex,
                            color: getPixelColor({
                                levelId,
                                solution,
                                row: rowIndex,
                                col: colIndex,
                                palette,
                            }),
                        },
                    ]
                }),
            ),
        [levelId, palette, solution],
    )

    return (
        <div
            role="img"
            aria-label={`${name}像素作品`}
            className={cn("absolute inset-0 overflow-hidden rounded-[4px]", className)}
            style={{ boxShadow: `0 10px 30px -16px ${palette.glow}, 0 0 26px ${palette.glow}` }}
        >
            <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" aria-hidden="true">
                <defs>
                    <radialGradient id={backdropId} cx="38%" cy="30%" r="85%">
                        <stop offset="0%" stopColor={palette.background} />
                        <stop offset="100%" stopColor={palette.backgroundAccent} />
                    </radialGradient>
                    <pattern id={gridId} width="1" height="1" patternUnits="userSpaceOnUse">
                        <path
                            d="M 1 0 L 0 0 0 1"
                            fill="none"
                            stroke={palette.shade}
                            strokeWidth={Math.max(0.012, 0.024 - size * 0.0008)}
                            opacity="0.09"
                        />
                    </pattern>
                </defs>

                <rect width={size} height={size} fill={`url(#${backdropId})`} />
                <circle
                    cx={size * 0.18}
                    cy={size * 0.2}
                    r={size * 0.24}
                    fill={palette.light}
                    opacity="0.1"
                />
                <circle
                    cx={size * 0.86}
                    cy={size * 0.78}
                    r={size * 0.31}
                    fill={palette.main}
                    opacity="0.08"
                />
                <rect width={size} height={size} fill={`url(#${gridId})`} />

                {pixels.map(({ row, col, color }) => (
                    <g key={`${row}-${col}`}>
                        <rect
                            x={col + 0.08}
                            y={row + 0.11}
                            width="0.84"
                            height="0.84"
                            rx="0.15"
                            fill={palette.shade}
                            opacity="0.3"
                        />
                        <rect
                            x={col + 0.06}
                            y={row + 0.04}
                            width="0.88"
                            height="0.88"
                            rx="0.15"
                            fill={color}
                            stroke={palette.shade}
                            strokeWidth="0.025"
                            strokeOpacity="0.22"
                        />
                        <path
                            d={`M ${col + 0.2} ${row + 0.18} H ${col + 0.58}`}
                            fill="none"
                            stroke={palette.background}
                            strokeWidth="0.07"
                            strokeLinecap="round"
                            opacity="0.4"
                        />
                    </g>
                ))}

                <PixelSparkle
                    x={size * 0.16}
                    y={size * 0.74}
                    size={Math.max(0.13, size * 0.025)}
                    color={palette.main}
                />
                <PixelSparkle
                    x={size * 0.82}
                    y={size * 0.2}
                    size={Math.max(0.16, size * 0.03)}
                    color={palette.shade}
                />
            </svg>
        </div>
    )
}

export function countFilledCells(solution: number[][]) {
    return solution.reduce(
        (sum, row) => sum + row.reduce((rowSum, value) => rowSum + (value === 1 ? 1 : 0), 0),
        0,
    )
}
